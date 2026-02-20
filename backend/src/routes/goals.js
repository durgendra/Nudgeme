const express = require("express");
const { body, param, query } = require("express-validator");
const { validate } = require("../middleware/validate");
const { auth, optionalAuth } = require("../middleware/auth");
const {
  Goal,
  GroupGoal,
  Participation,
  User,
  Transaction,
} = require("../models");
const { v4: uuidv4 } = require("uuid");
const {
  evaluateGoal,
  generateConfirmation,
} = require("../services/aiGoalEvaluationService");
const {
  assistGoalCreation,
  evaluateTitleWithAI,
  evaluateGoalWithAI,
} = require("../services/aiGoalCreationService");
const {
  getVerificationProgress,
  getVerificationProgressBatch,
} = require("../services/goalService");

const router = express.Router();

// Helper function to calculate recurring deadlines
function calculateRecurringDeadlines(startDeadline, pattern, endDate) {
  const deadlines = [new Date(startDeadline)];
  let currentDate = new Date(startDeadline);
  const end = new Date(endDate);

  while (currentDate < end) {
    let nextDate = new Date(currentDate);

    switch (pattern) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    if (nextDate <= end) {
      deadlines.push(new Date(nextDate));
      currentDate = nextDate;
    } else {
      break;
    }
  }

  return deadlines;
}

// Evaluate goal with AI before creation
router.post(
  "/evaluate",
  auth,
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").optional().trim(),
    body("verificationCriteria").optional().trim(),
    body("previousClarifications")
      .optional()
      .isArray()
      .withMessage("Previous clarifications must be an array"),
    body("latestAnswer")
      .optional()
      .isObject()
      .withMessage("Latest answer must be an object"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        title,
        description,
        verificationCriteria,
        previousClarifications = [],
        latestAnswer,
      } = req.body;

      // Build the clarifications array including the latest answer
      let clarifications = [...previousClarifications];
      if (latestAnswer && latestAnswer.question && latestAnswer.answer) {
        clarifications.push({
          question: latestAnswer.question,
          answer: latestAnswer.answer,
          answeredAt: new Date(),
        });
      }

      // Evaluate the goal with AI
      const evaluationResult = await evaluateGoal(
        { title, description, verificationCriteria },
        clarifications
      );

      if (evaluationResult.needsClarification) {
        // AI needs more information - return the question
        return res.json({
          status: "needs_clarification",
          question: evaluationResult.question,
          clarifications: clarifications,
        });
      }

      // AI has all information - return confirmation
      const confirmation = generateConfirmation(
        evaluationResult.summary,
        { title, description, verificationCriteria },
        clarifications
      );

      return res.json({
        status: "ready",
        confirmation: confirmation,
        clarifications: clarifications,
        evaluatedCriteria: evaluationResult.summary,
      });
    } catch (error) {
      console.error("Goal evaluation error:", error);
      res.status(500).json({ error: "Failed to evaluate goal" });
    }
  }
);

// Assist goal creation with AI
router.post(
  "/assist-create",
  auth,
  [
    body("conversationHistory")
      .optional()
      .isArray()
      .withMessage("Conversation history must be an array"),
    body("latestAnswer")
      .optional()
      .isObject()
      .withMessage("Latest answer must be an object"),
    body("collectedData")
      .optional()
      .isObject()
      .withMessage("Collected data must be an object"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        conversationHistory = [],
        latestAnswer,
        collectedData = {},
      } = req.body;

      // Process latest answer and update collected data
      let updatedCollectedData = { ...collectedData };
      let updatedConversationHistory = [...conversationHistory];
      // Track clarifications for 6-criteria evaluation
      let clarifications = updatedCollectedData.clarifications || [];

      if (latestAnswer && latestAnswer.questionId && latestAnswer.answer) {
        // Add to conversation history
        updatedConversationHistory.push({
          question: latestAnswer.questionText || latestAnswer.questionId,
          answer: latestAnswer.answer,
          answeredAt: new Date(),
        });

        // Update collected data based on answer
        updatedCollectedData = processAnswer(
          latestAnswer.questionId,
          latestAnswer.answer,
          updatedCollectedData
        );

        // Handle title clarification responses
        if (latestAnswer.questionId === "title_clarification") {
          // User responded to title clarification - update title
          if (latestAnswer.answer === "other") {
            // User wants to provide custom title - will be handled by next free text input
          } else {
            // User selected a suggested refinement - append to title
            const originalTitle = updatedCollectedData.title || "";
            updatedCollectedData.title = `${originalTitle} - ${latestAnswer.answer}`;
          }
          updatedCollectedData.titleEvaluated = true;
        }

        // Handle evaluation clarification responses
        if (latestAnswer.questionId.startsWith("eval_")) {
          clarifications.push({
            question: latestAnswer.questionText || latestAnswer.questionId,
            answer: latestAnswer.answer,
            answeredAt: new Date(),
          });
          updatedCollectedData.clarifications = clarifications;
        }
      }

      // SMART AI EVALUATION: After title is collected, evaluate it
      if (
        latestAnswer &&
        latestAnswer.questionId === "title" &&
        updatedCollectedData.title &&
        !updatedCollectedData.titleEvaluated
      ) {
        const titleEvaluation = await evaluateTitleWithAI(
          updatedCollectedData.title,
          updatedCollectedData.goalType || "self",
          updatedConversationHistory
        );

        if (titleEvaluation.needsClarification && titleEvaluation.question) {
          // Title is vague - ask clarifying question
          return res.json({
            status: "needs_info",
            question: titleEvaluation.question,
            collectedData: updatedCollectedData,
            conversationHistory: updatedConversationHistory,
          });
        } else {
          // Title is clear - mark as evaluated
          updatedCollectedData.titleEvaluated = true;
          if (titleEvaluation.improvedTitle) {
            updatedCollectedData.title = titleEvaluation.improvedTitle;
          }
        }
      }

      // Get next question or check if ready
      const result = await assistGoalCreation(
        updatedConversationHistory,
        updatedCollectedData
      );

      // SMART AI EVALUATION: Before returning "ready", run 6-criteria evaluation
      if (
        result.status === "ready" &&
        !updatedCollectedData.evaluatedCriteria
      ) {
        const goalEvaluation = await evaluateGoalWithAI(
          updatedCollectedData,
          clarifications
        );

        if (goalEvaluation.needsClarification && goalEvaluation.question) {
          // Need more info for proper evaluation
          return res.json({
            status: "needs_info",
            question: goalEvaluation.question,
            collectedData: updatedCollectedData,
            conversationHistory: updatedConversationHistory,
          });
        } else if (goalEvaluation.evaluatedCriteria) {
          // Got all info - store evaluated criteria
          updatedCollectedData.evaluatedCriteria =
            goalEvaluation.evaluatedCriteria;
          updatedCollectedData.clarifications = clarifications;
        }
      }

      return res.json({
        status: result.status,
        question: result.question,
        collectedData: updatedCollectedData,
        summary: result.summary || null,
        evaluatedCriteria: updatedCollectedData.evaluatedCriteria || null,
        conversationHistory: updatedConversationHistory,
      });
    } catch (error) {
      console.error("Goal creation assistance error:", error);
      res.status(500).json({ error: "Failed to assist goal creation" });
    }
  }
);

// Helper function to process answers and update collected data
function processAnswer(questionId, answer, collectedData) {
  const updated = { ...collectedData };

  switch (questionId) {
    case "goal_type":
      updated.goalType = answer;
      break;

    case "title":
      updated.title = answer;
      break;

    case "description":
      if (answer === "yes") {
        // Don't set description yet - AI will ask for the text next
        // Keep it undefined so AI service knows to ask for it
      } else if (answer === "no") {
        // Set to empty string to mark that user declined (don't ask again)
        updated.description = "";
      } else {
        // Direct text input
        updated.description = answer;
      }
      break;

    case "startDate":
      if (answer === "today") {
        updated.startDate = new Date().toISOString();
      } else if (answer === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        updated.startDate = tomorrow.toISOString();
      } else if (answer === "custom") {
        // Will need to handle custom date input
      }
      break;

    case "deadline":
      if (answer === "week") {
        const week = new Date();
        week.setDate(week.getDate() + 7);
        updated.deadline = week.toISOString();
      } else if (answer === "month") {
        const month = new Date();
        month.setMonth(month.getMonth() + 1);
        updated.deadline = month.toISOString();
      } else if (answer === "3months") {
        const threeMonths = new Date();
        threeMonths.setMonth(threeMonths.getMonth() + 3);
        updated.deadline = threeMonths.toISOString();
      } else if (answer === "custom") {
        // Will need to handle custom date input
      }
      break;

    case "isRecurring":
      updated.isRecurring = answer === "yes";
      if (answer === "no") {
        // Clear recurring fields if not recurring
        updated.recurrencePattern = undefined;
        updated.recurrenceEndDate = undefined;
      }
      break;

    case "recurrencePattern":
      updated.recurrencePattern = answer;
      break;

    case "recurrenceEndDate":
      if (answer === "month") {
        const month = new Date();
        month.setMonth(month.getMonth() + 1);
        updated.recurrenceEndDate = month.toISOString();
      } else if (answer === "3months") {
        const threeMonths = new Date();
        threeMonths.setMonth(threeMonths.getMonth() + 3);
        updated.recurrenceEndDate = threeMonths.toISOString();
      } else if (answer === "6months") {
        const sixMonths = new Date();
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        updated.recurrenceEndDate = sixMonths.toISOString();
      } else if (answer === "custom") {
        // Will need to handle custom date input
      }
      break;

    case "seedAmount":
      if (answer === "custom") {
        // Will need to handle custom amount input
      } else {
        updated.seedAmount = parseInt(answer) * 100; // Convert to cents
      }
      break;

    case "seekerEmail":
      if (answer === "yes") {
        // Don't set seekerEmail yet - AI will ask for the email next
        // Keep it undefined so AI service knows to ask for it
      } else if (answer === "no") {
        // Set to empty string to mark that user declined (don't ask again)
        updated.seekerEmail = "";
      } else {
        // Direct email input
        updated.seekerEmail = answer;
      }
      break;

    case "groupName":
      updated.groupName = answer;
      break;

    case "goalMode":
      updated.goalMode = answer;
      break;

    case "verificationCriteria":
      if (answer === "yes") {
        // Don't set verificationCriteria yet - AI will ask for the text next
      } else if (answer === "no") {
        // Set to empty string to mark that user declined (don't ask again)
        updated.verificationCriteria = "";
      } else {
        // Direct text input
        updated.verificationCriteria = answer;
      }
      break;

    default:
      // Handle free text answers
      if (
        questionId === "title" ||
        questionId === "description" ||
        questionId === "verificationCriteria" ||
        questionId === "seekerEmail" ||
        questionId === "groupName"
      ) {
        updated[questionId] = answer;
      } else if (questionId.startsWith("date_")) {
        // Handle custom date inputs
        const dateType = questionId.replace("date_", "");
        if (dateType === "startDate") {
          updated.startDate = answer;
        } else if (dateType === "deadline") {
          updated.deadline = answer;
        } else if (dateType === "recurrenceEndDate") {
          updated.recurrenceEndDate = answer;
        }
      } else if (questionId.startsWith("amount_")) {
        // Handle custom amount input
        const amount = parseFloat(answer);
        if (!isNaN(amount) && amount >= 1) {
          updated.seedAmount = Math.round(amount * 100); // Convert to cents
        }
      } else if (questionId.startsWith("email_")) {
        // Handle email input
        updated.seekerEmail = answer;
      }
  }

  return updated;
}

// Create a new goal
router.post(
  "/",
  auth,
  [
    body("title")
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("Title is required (max 200 chars)"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be max 2000 chars"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Valid start date required"),
    body("deadline").isISO8601().withMessage("Valid deadline date required"),
    body("seedAmount")
      .isInt({ min: 100 })
      .withMessage("Seed amount must be at least $1 (100 cents)"),
    body("verificationType")
      .optional()
      .isIn(["image", "data"])
      .withMessage("Invalid verification type"),
    body("verificationCriteria").optional().trim().isLength({ max: 500 }),
    body("seekerEmail")
      .optional()
      .trim()
      .isEmail()
      .withMessage("Invalid seeker email format"),
    body("goalType")
      .optional()
      .isIn(["self", "gift", "group"])
      .withMessage("Invalid goal type"),
    // Group goal fields
    body("groupName")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Group name must be max 200 chars"),
    body("goalMode")
      .optional()
      .isIn(["common", "individual"])
      .withMessage("Invalid goal mode"),
    // Recurring goal fields
    body("isRecurring")
      .optional()
      .isBoolean()
      .withMessage("isRecurring must be a boolean"),
    body("recurrencePattern")
      .optional()
      .isIn(["daily", "weekly", "monthly"])
      .withMessage("Invalid recurrence pattern"),
    body("recurrenceEndDate")
      .optional()
      .isISO8601()
      .withMessage("Valid recurrence end date required"),
    // AI evaluation fields
    body("clarifications")
      .optional()
      .isArray()
      .withMessage("Clarifications must be an array"),
    body("evaluatedCriteria")
      .optional()
      .isObject()
      .withMessage("Evaluated criteria must be an object"),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        title,
        description,
        startDate,
        deadline,
        seedAmount,
        verificationType,
        verificationCriteria,
        seekerEmail,
        goalType,
        groupName,
        goalMode,
        isRecurring,
        recurrencePattern,
        recurrenceEndDate,
        clarifications,
        evaluatedCriteria,
      } = req.body;

      // Determine goal type - default to 'gift' if seekerEmail provided, otherwise 'self'
      const finalGoalType = goalType || (seekerEmail ? "gift" : "self");

      // Validate start date (default to now if not provided)
      const effectiveStartDate = startDate ? new Date(startDate) : new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateNormalized = new Date(effectiveStartDate);
      startDateNormalized.setHours(0, 0, 0, 0);

      if (startDateNormalized < today) {
        return res
          .status(400)
          .json({ error: "Start date must be today or in the future" });
      }

      // Check if deadline is in the future
      if (new Date(deadline) <= new Date()) {
        return res
          .status(400)
          .json({ error: "Deadline must be in the future" });
      }

      // For non-recurring goals, validate that deadline is after start date
      if (!isRecurring && new Date(deadline) <= effectiveStartDate) {
        return res
          .status(400)
          .json({ error: "Deadline must be after the start date" });
      }

      // Validate recurring goal fields
      if (isRecurring) {
        if (!recurrencePattern) {
          return res.status(400).json({
            error: "Recurrence pattern is required for recurring goals",
          });
        }
        if (!recurrenceEndDate) {
          return res.status(400).json({
            error: "Recurrence end date is required for recurring goals",
          });
        }
        if (new Date(recurrenceEndDate) <= new Date(deadline)) {
          return res.status(400).json({
            error: "Recurrence end date must be after the first deadline",
          });
        }
      }

      // Check if user has sufficient wallet balance (only for first goal)
      if (req.user.walletBalance < seedAmount) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          required: seedAmount,
          available: req.user.walletBalance,
        });
      }

      // Determine initial status based on whether this is a goal for someone else
      const initialStatus = seekerEmail ? "pending_acceptance" : "active";

      // Handle group goals with GroupGoal model
      if (finalGoalType === "group") {
        // Validate group name is required for group goals
        if (!groupName || !groupName.trim()) {
          return res
            .status(400)
            .json({ error: "Group name is required for group goals" });
        }

        const effectiveGoalMode = goalMode || "common";

        // Create GroupGoal document
        const groupGoal = new GroupGoal({
          groupName: groupName.trim(),
          creatorId: req.user._id,
          goalMode: effectiveGoalMode,
          deadline: new Date(deadline),
          startDate: effectiveStartDate,
          isRecurring: isRecurring || false,
          recurrencePattern: isRecurring ? recurrencePattern : null,
          recurrenceEndDate: isRecurring ? new Date(recurrenceEndDate) : null,
          currentCycle: 1,
          sharedPot: seedAmount,
          minSeedAmount: seedAmount,
          status: "active",
        });

        await groupGoal.save();

        // Create the goal document (for common mode, this is the shared goal; for individual mode, this is creator's goal)
        const goal = new Goal({
          creatorId: req.user._id,
          title,
          description,
          startDate: effectiveStartDate,
          deadline: new Date(deadline),
          seedAmount,
          totalPot: seedAmount, // For display purposes, actual pot is in GroupGoal
          verificationType: verificationType || "image",
          verificationCriteria,
          status: "active",
          goalType: "group",
          groupGoalId: groupGoal._id,
          groupParticipantId:
            effectiveGoalMode === "individual" ? req.user._id : null,
          clarifications: clarifications || [],
          evaluatedCriteria: evaluatedCriteria || undefined,
        });

        await goal.save();

        // Update GroupGoal with goal reference
        if (effectiveGoalMode === "common") {
          groupGoal.commonGoalId = goal._id;
        } else {
          groupGoal.participantGoalIds.push(goal._id);
        }
        await groupGoal.save();

        // Deduct seed amount from wallet
        req.user.walletBalance -= seedAmount;
        await req.user.save();

        // Create transaction
        await Transaction.create({
          userId: req.user._id,
          type: "goal_contribution",
          amount: seedAmount,
          direction: "debit",
          goalId: goal._id,
          description: `Seed money for group goal: ${groupName}`,
        });

        // Create participation for creator
        await Participation.create({
          goalId: goal._id,
          userId: req.user._id,
          contributionAmount: seedAmount,
        });

        return res.status(201).json({
          message: "Group goal created successfully",
          goal,
          groupGoal,
          shareLink: `${process.env.FRONTEND_URL}group/${groupGoal.shareCode}`,
          goalMode: effectiveGoalMode,
        });
      }

      // Handle recurring goals (for non-group goals)
      if (isRecurring) {
        const recurringGroupId = uuidv4();
        const deadlines = calculateRecurringDeadlines(
          deadline,
          recurrencePattern,
          recurrenceEndDate
        );
        const createdGoals = [];

        for (let i = 0; i < deadlines.length; i++) {
          const isFirst = i === 0;
          // First goal is active (or pending_acceptance), rest are not_started
          const status = isFirst ? initialStatus : "not_started";

          // Calculate start date for each goal in the series
          // First goal uses provided start date, subsequent goals start when the previous deadline ends
          const goalStartDate = i === 0 ? effectiveStartDate : deadlines[i - 1];

          const goal = new Goal({
            creatorId: req.user._id,
            title,
            description,
            startDate: goalStartDate,
            deadline: deadlines[i],
            seedAmount,
            totalPot: isFirst ? seedAmount : 0, // Only first goal has initial pot
            verificationType: verificationType || "image",
            verificationCriteria,
            seekerEmail: seekerEmail || undefined,
            status,
            goalType: finalGoalType,
            isRecurring: true,
            recurrencePattern,
            recurrenceEndDate,
            recurringGroupId,
            recurringIndex: i + 1,
            clarifications: isFirst ? clarifications || [] : [], // Only first goal gets clarifications
            evaluatedCriteria: isFirst
              ? evaluatedCriteria || undefined
              : undefined,
          });

          await goal.save();
          createdGoals.push(goal);

          // Only process wallet deduction and participation for first goal
          if (isFirst) {
            // Deduct seed amount from wallet
            req.user.walletBalance -= seedAmount;
            await req.user.save();

            // Create transaction
            await Transaction.create({
              userId: req.user._id,
              type: "goal_contribution",
              amount: seedAmount,
              direction: "debit",
              goalId: goal._id,
              description: `Seed money for recurring goal: ${title} (1 of ${deadlines.length})`,
            });
          }
        }

        return res.status(201).json({
          message: `Recurring goal created successfully. ${deadlines.length} goals in series.`,
          goal: createdGoals[0], // Return first goal
          goals: createdGoals,
          totalGoals: deadlines.length,
          recurringGroupId,
          shareLink: `${process.env.FRONTEND_URL}goal/${createdGoals[0].shareCode}`,
          needsAcceptance: !!seekerEmail,
        });
      }

      // Non-recurring goal (original logic)
      const goal = new Goal({
        creatorId: req.user._id,
        title,
        description,
        startDate: effectiveStartDate,
        deadline,
        seedAmount,
        totalPot: seedAmount,
        verificationType: verificationType || "image",
        verificationCriteria,
        seekerEmail: seekerEmail || undefined,
        status: initialStatus,
        goalType: finalGoalType,
        clarifications: clarifications || [],
        evaluatedCriteria: evaluatedCriteria || undefined,
      });

      await goal.save();

      // Deduct seed amount from wallet
      req.user.walletBalance -= seedAmount;
      await req.user.save();

      // Create transaction
      await Transaction.create({
        userId: req.user._id,
        type: "goal_contribution",
        amount: seedAmount,
        direction: "debit",
        goalId: goal._id,
        description: `Seed money for goal: ${title}`,
      });

      res.status(201).json({
        message: seekerEmail
          ? "Goal created successfully. Share the link with the goal seeker."
          : "Goal created successfully",
        goal,
        shareLink: `${process.env.FRONTEND_URL}goal/${goal.shareCode}`,
        needsAcceptance: !!seekerEmail,
      });
    } catch (error) {
      console.error("Create goal error:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  }
);

// Get user's goals (created, participating, and as seeker)
router.get("/", auth, async (req, res) => {
  try {
    const { status, type } = req.query;

    let createdGoals = [];
    let participatingGoals = [];
    let seekerGoals = [];

    // Query for goals created by user
    const createdQuery = { creatorId: req.user._id };
    if (status) createdQuery.status = status;

    createdGoals = await Goal.find(createdQuery)
      .populate("seekerId", "name email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // Query for goals user is participating in (excluding goals where user is seeker)
    const participations = await Participation.find({ userId: req.user._id })
      .populate({
        path: "goalId",
        match: status ? { status } : {},
        populate: [
          { path: "creatorId", select: "name email profileImage" },
          { path: "seekerId", select: "name email profileImage" },
        ],
      })
      .lean();

    participatingGoals = participations
      .filter((p) => p.goalId !== null)
      .filter(
        (p) =>
          !p.goalId.seekerId ||
          p.goalId.seekerId._id.toString() !== req.user._id.toString()
      )
      .map((p) => ({
        ...p.goalId,
        myContribution: p.contributionAmount,
      }));

    // Query for goals where user is the seeker
    const seekerQuery = { seekerId: req.user._id };
    if (status) seekerQuery.status = status;

    seekerGoals = await Goal.find(seekerQuery)
      .populate("creatorId", "name email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // Collect all goal IDs to get verification progress
    const allGoalIds = [
      ...createdGoals.map((g) => g._id),
      ...participatingGoals.map((g) => g._id),
      ...seekerGoals.map((g) => g._id),
    ];

    // Get verification progress for all goals
    const verificationProgressMap = await getVerificationProgressBatch(
      allGoalIds
    );

    // Add verification progress to each goal
    const addProgress = (goals) =>
      goals.map((g) => ({
        ...g,
        verificationProgress:
          verificationProgressMap[g._id.toString()] || "no_update",
      }));

    const createdGoalsWithProgress = addProgress(createdGoals);
    const participatingGoalsWithProgress = addProgress(participatingGoals);
    const seekerGoalsWithProgress = addProgress(seekerGoals);

    if (type === "created") {
      return res.json({ goals: createdGoalsWithProgress });
    }
    if (type === "participating") {
      return res.json({ goals: participatingGoalsWithProgress });
    }
    if (type === "seeker") {
      return res.json({ goals: seekerGoalsWithProgress });
    }

    res.json({
      createdGoals: createdGoalsWithProgress,
      participatingGoals: participatingGoalsWithProgress,
      seekerGoals: seekerGoalsWithProgress,
    });
  } catch (error) {
    console.error("Get goals error:", error);
    res.status(500).json({ error: "Failed to get goals" });
  }
});

// Accept a goal (for goal seekers)
// Supports ?acceptAll=true to accept all goals in a recurring series
router.post("/:idOrCode/accept", auth, validate, async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const { acceptAll } = req.query;

    let goal;

    // Try to find by ID first, then by share code
    if (idOrCode.match(/^[0-9a-fA-F]{24}$/)) {
      goal = await Goal.findById(idOrCode);
    }

    if (!goal) {
      goal = await Goal.findOne({ shareCode: idOrCode.toUpperCase() });
    }

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Check if goal is pending acceptance
    if (goal.status !== "pending_acceptance") {
      if (goal.status === "active") {
        return res
          .status(400)
          .json({ error: "Goal has already been accepted" });
      }
      return res
        .status(400)
        .json({ error: `Goal cannot be accepted (status: ${goal.status})` });
    }

    // Check if user is not the creator
    if (goal.creatorId.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "Goal creator cannot accept their own goal" });
    }

    // If seekerEmail was specified, verify it matches the accepting user's email
    if (
      goal.seekerEmail &&
      goal.seekerEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        error: "This goal was created for a different user",
        expectedEmail: goal.seekerEmail,
      });
    }

    // Check if deadline has passed
    if (goal.isExpired()) {
      return res.status(400).json({ error: "Goal deadline has passed" });
    }

    // Accept the goal
    goal.seekerId = req.user._id;
    goal.acceptedAt = new Date();
    goal.status = "active";
    await goal.save();

    // Create participation record for the creator with seedAmount as contribution
    // Note: seedAmount is already in totalPot, so we don't add to totalPot here
    await Participation.create({
      goalId: goal._id,
      userId: goal.creatorId,
      contributionAmount: goal.seedAmount,
    });

    // If acceptAll=true and goal is recurring, accept all goals in the series
    let acceptedGoals = [goal];
    if (acceptAll === "true" && goal.isRecurring && goal.recurringGroupId) {
      // Find all other goals in the series (not_started or pending_acceptance)
      const otherGoals = await Goal.find({
        recurringGroupId: goal.recurringGroupId,
        _id: { $ne: goal._id },
        status: { $in: ["not_started", "pending_acceptance"] },
      }).sort({ recurringIndex: 1 });

      for (const otherGoal of otherGoals) {
        // Set seeker for all future goals in the series
        otherGoal.seekerId = req.user._id;

        // Only the pending_acceptance goals get acceptedAt (not_started ones will activate later)
        if (otherGoal.status === "pending_acceptance") {
          otherGoal.acceptedAt = new Date();
          otherGoal.status = "active";

          // Create participation for the creator for this goal
          await Participation.create({
            goalId: otherGoal._id,
            userId: otherGoal.creatorId,
            contributionAmount: otherGoal.seedAmount,
          });
        }

        await otherGoal.save();
        acceptedGoals.push(otherGoal);
      }
    }

    // Populate creator info for response
    await goal.populate("creatorId", "name email profileImage");

    res.json({
      message:
        acceptAll === "true" && goal.isRecurring
          ? `Accepted ${acceptedGoals.length} goals in the recurring series`
          : "Goal accepted successfully",
      goal,
      acceptedGoals: acceptAll === "true" ? acceptedGoals : undefined,
      totalAccepted: acceptAll === "true" ? acceptedGoals.length : 1,
    });
  } catch (error) {
    console.error("Accept goal error:", error);
    res.status(500).json({ error: "Failed to accept goal" });
  }
});

// Get goal by ID or share code
router.get("/:idOrCode", optionalAuth, async (req, res) => {
  try {
    const { idOrCode } = req.params;

    let goal;

    // Try to find by ID first, then by share code
    if (idOrCode.match(/^[0-9a-fA-F]{24}$/)) {
      goal = await Goal.findById(idOrCode)
        .populate("creatorId", "name email profileImage")
        .populate("seekerId", "name email profileImage");
    }

    if (!goal) {
      goal = await Goal.findOne({ shareCode: idOrCode.toUpperCase() })
        .populate("creatorId", "name email profileImage")
        .populate("seekerId", "name email profileImage");
    }

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Get participants
    const participations = await Participation.find({ goalId: goal._id })
      .populate("userId", "name email profileImage")
      .lean();

    const participants = participations.map((p) => ({
      user: p.userId,
      contribution: p.contributionAmount,
      joinedAt: p.createdAt,
    }));

    // Check if current user is participating
    let userParticipation = null;
    if (req.user) {
      userParticipation = participations.find(
        (p) => p.userId._id.toString() === req.user._id.toString()
      );
    }

    // Calculate platform fee preview
    const platformFeePercentage =
      parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;
    const estimatedPlatformFee = Math.floor(
      goal.totalPot * (platformFeePercentage / 100)
    );
    const estimatedSeekerPayout = goal.totalPot - estimatedPlatformFee;

    // Determine user roles
    const isCreator = req.user
      ? goal.creatorId._id.toString() === req.user._id.toString()
      : false;
    const isSeeker =
      req.user && goal.seekerId
        ? goal.seekerId._id.toString() === req.user._id.toString()
        : false;
    const needsAcceptance = goal.status === "pending_acceptance";

    // Check if current user can accept (pending goal + not creator + email matches if specified)
    let canAccept = false;
    if (req.user && needsAcceptance && !isCreator) {
      if (goal.seekerEmail) {
        canAccept =
          goal.seekerEmail.toLowerCase() === req.user.email.toLowerCase();
      } else {
        canAccept = true; // Anyone can accept if no email specified
      }
    }

    // Get recurring series info if applicable
    let recurringSeriesInfo = null;
    if (goal.isRecurring && goal.recurringGroupId) {
      const seriesGoals = await Goal.find({
        recurringGroupId: goal.recurringGroupId,
      })
        .select("_id status recurringIndex deadline")
        .sort({ recurringIndex: 1 })
        .lean();

      recurringSeriesInfo = {
        groupId: goal.recurringGroupId,
        totalGoals: seriesGoals.length,
        currentIndex: goal.recurringIndex,
        pattern: goal.recurrencePattern,
        endDate: goal.recurrenceEndDate,
        goals: seriesGoals,
      };
    }

    // Get group goal info if applicable
    let groupGoalInfo = null;
    if (goal.groupGoalId) {
      const groupGoal = await GroupGoal.findById(goal.groupGoalId)
        .populate("creatorId", "name email profileImage")
        .lean();

      if (groupGoal) {
        let participantGoals = [];
        if (groupGoal.goalMode === "individual") {
          participantGoals = await Goal.find({
            _id: { $in: groupGoal.participantGoalIds },
          })
            .populate("groupParticipantId", "name email profileImage")
            .select("_id title status groupParticipantId")
            .lean();
        }

        // Find user's goal ID in the group (for individual mode)
        let userGoalId = null;
        if (req.user && groupGoal.goalMode === "individual") {
          const userGoal = participantGoals.find(
            (g) =>
              g.groupParticipantId &&
              g.groupParticipantId._id.toString() === req.user._id.toString()
          );
          userGoalId = userGoal?._id;
        }

        groupGoalInfo = {
          groupGoal,
          participantGoals,
          participantCount:
            groupGoal.goalMode === "common"
              ? participants.length
              : groupGoal.participantGoalIds.length,
          isGroupCreator: req.user
            ? groupGoal.creatorId._id.toString() === req.user._id.toString()
            : false,
          userGoalId,
        };
      }
    }

    // Get verification progress for this goal
    const verificationProgress = await getVerificationProgress(goal._id);

    res.json({
      goal: {
        ...goal.toObject(),
        verificationProgress,
      },
      participants,
      participantCount: participants.length,
      isCreator,
      isSeeker,
      isParticipating: !!userParticipation,
      userContribution: userParticipation?.contributionAmount || 0,
      needsAcceptance,
      canAccept,
      platformFeePreview: {
        percentage: platformFeePercentage,
        estimatedFee: estimatedPlatformFee,
        estimatedSeekerPayout,
      },
      recurringSeriesInfo,
      groupGoalInfo,
    });
  } catch (error) {
    console.error("Get goal error:", error);
    res.status(500).json({ error: "Failed to get goal" });
  }
});

// Join a goal as participant
router.post(
  "/:id/join",
  auth,
  [
    body("contributionAmount")
      .isInt({ min: 0 })
      .withMessage("Contribution amount must be 0 or more cents"),
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { contributionAmount } = req.body;

      let goal;

      // Try to find by ID first, then by share code
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        goal = await Goal.findById(id);
      }

      if (!goal) {
        goal = await Goal.findOne({ shareCode: id.toUpperCase() });
      }

      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Check if goal is active
      if (goal.status !== "active") {
        return res.status(400).json({ error: "Goal is not active" });
      }

      // Check if deadline passed
      if (goal.isExpired()) {
        return res.status(400).json({ error: "Goal deadline has passed" });
      }

      const isCreator = goal.creatorId.toString() === req.user._id.toString();
      const isSeeker =
        goal.seekerId && goal.seekerId.toString() === req.user._id.toString();
      const isGroupGoal = goal.goalType === "group";

      // For group goals, creator is already a participant, so they can add more contributions
      // For non-group goals, check if user is the creator (only allowed if goal has a seeker)
      if (isCreator && !goal.seekerId && !isGroupGoal) {
        return res
          .status(400)
          .json({ error: "Cannot participate in your own goal" });
      }

      // Seeker cannot join as participant (they are the goal achiever) - except for group goals
      if (isSeeker && !isGroupGoal) {
        return res
          .status(400)
          .json({ error: "Goal seeker cannot join as participant" });
      }

      // Check if already participating
      const existingParticipation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      // For creator, allow adding more contribution to existing participation
      if (existingParticipation && isCreator) {
        // Creator already has participation (from acceptance), allow adding more
        if (contributionAmount > 0) {
          // Check wallet balance
          if (req.user.walletBalance < contributionAmount) {
            return res.status(400).json({
              error: "Insufficient wallet balance",
              required: contributionAmount,
              available: req.user.walletBalance,
            });
          }

          // Update existing participation
          existingParticipation.contributionAmount += contributionAmount;
          await existingParticipation.save();

          // Deduct from wallet
          req.user.walletBalance -= contributionAmount;
          await req.user.save();

          await Transaction.create({
            userId: req.user._id,
            type: "goal_contribution",
            amount: contributionAmount,
            direction: "debit",
            goalId: goal._id,
            description: `Additional contribution to goal: ${goal.title}`,
          });

          // Update goal total pot
          goal.totalPot += contributionAmount;
          await goal.save();

          return res.json({
            message: "Successfully added additional contribution",
            participation: existingParticipation,
          });
        }
        return res
          .status(400)
          .json({ error: "You are already participating in this goal" });
      }

      if (existingParticipation) {
        return res
          .status(400)
          .json({ error: "Already participating in this goal" });
      }

      // Check wallet balance if contributing money
      if (
        contributionAmount > 0 &&
        req.user.walletBalance < contributionAmount
      ) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          required: contributionAmount,
          available: req.user.walletBalance,
        });
      }

      // Create participation
      const participation = await Participation.create({
        goalId: goal._id,
        userId: req.user._id,
        contributionAmount,
      });

      // Deduct from wallet if contributing
      if (contributionAmount > 0) {
        req.user.walletBalance -= contributionAmount;
        await req.user.save();

        await Transaction.create({
          userId: req.user._id,
          type: "goal_contribution",
          amount: contributionAmount,
          direction: "debit",
          goalId: goal._id,
          description: `Contribution to goal: ${goal.title}`,
        });
      }

      // Update goal total pot
      goal.totalPot += contributionAmount;
      await goal.save();

      res.status(201).json({
        message: "Successfully joined goal",
        participation,
      });
    } catch (error) {
      console.error("Join goal error:", error);
      res.status(500).json({ error: "Failed to join goal" });
    }
  }
);

// Get goal participants
router.get("/:id/participants", async (req, res) => {
  try {
    const { id } = req.params;

    const participations = await Participation.find({ goalId: id })
      .populate("userId", "name email profileImage")
      .sort({ createdAt: 1 });

    const participants = participations.map((p) => ({
      user: p.userId,
      contribution: p.contributionAmount,
      contributionDollars: (p.contributionAmount / 100).toFixed(2),
      joinedAt: p.createdAt,
    }));

    const totalContributions = participations.reduce(
      (sum, p) => sum + p.contributionAmount,
      0
    );

    res.json({
      participants,
      count: participants.length,
      totalContributions,
      totalContributionsDollars: (totalContributions / 100).toFixed(2),
    });
  } catch (error) {
    console.error("Get participants error:", error);
    res.status(500).json({ error: "Failed to get participants" });
  }
});

// Get all goals in a recurring series
router.get("/recurring/:groupId", auth, async (req, res) => {
  try {
    const { groupId } = req.params;

    const goals = await Goal.find({ recurringGroupId: groupId })
      .populate("creatorId", "name email profileImage")
      .populate("seekerId", "name email profileImage")
      .sort({ recurringIndex: 1 });

    if (goals.length === 0) {
      return res.status(404).json({ error: "Recurring series not found" });
    }

    // Verify the user has access (is creator, seeker, or participant of at least one goal)
    const userId = req.user._id.toString();
    const hasAccess = goals.some(
      (g) =>
        g.creatorId._id.toString() === userId ||
        (g.seekerId && g.seekerId._id.toString() === userId)
    );

    if (!hasAccess) {
      // Check if user is a participant
      const participations = await Participation.find({
        goalId: { $in: goals.map((g) => g._id) },
        userId: req.user._id,
      });

      if (participations.length === 0) {
        return res
          .status(403)
          .json({ error: "You do not have access to this recurring series" });
      }
    }

    // Get summary statistics
    const statusCounts = {
      not_started: 0,
      pending_acceptance: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    for (const goal of goals) {
      statusCounts[goal.status]++;
    }

    // Get verification progress for all goals
    const goalIds = goals.map((g) => g._id);
    const verificationProgressMap = await getVerificationProgressBatch(goalIds);

    // Add verification progress to each goal
    const goalsWithProgress = goals.map((g) => ({
      ...g.toObject(),
      verificationProgress:
        verificationProgressMap[g._id.toString()] || "no_update",
    }));

    res.json({
      recurringGroupId: groupId,
      totalGoals: goals.length,
      recurrencePattern: goals[0].recurrencePattern,
      recurrenceEndDate: goals[0].recurrenceEndDate,
      statusCounts,
      goals: goalsWithProgress,
    });
  } catch (error) {
    console.error("Get recurring series error:", error);
    res.status(500).json({ error: "Failed to get recurring series" });
  }
});

// =====================================================
// GROUP GOAL ROUTES
// =====================================================

// Get group goal by ID or share code
router.get("/group/:idOrCode", optionalAuth, async (req, res) => {
  try {
    const { idOrCode } = req.params;

    let groupGoal;

    // Try to find by ID first, then by share code
    if (idOrCode.match(/^[0-9a-fA-F]{24}$/)) {
      groupGoal = await GroupGoal.findById(idOrCode).populate(
        "creatorId",
        "name email profileImage"
      );
    }

    if (!groupGoal) {
      groupGoal = await GroupGoal.findOne({
        shareCode: idOrCode.toUpperCase(),
      }).populate("creatorId", "name email profileImage");
    }

    if (!groupGoal) {
      return res.status(404).json({ error: "Group goal not found" });
    }

    // Get all goals in this group
    let participantGoals = [];
    let participants = [];

    if (groupGoal.goalMode === "common") {
      // For common mode, get the shared goal and its participants
      const commonGoal = await Goal.findById(groupGoal.commonGoalId).populate(
        "creatorId",
        "name email profileImage"
      );

      const participations = await Participation.find({
        goalId: commonGoal._id,
      })
        .populate("userId", "name email profileImage")
        .lean();

      participants = participations.map((p) => ({
        user: p.userId,
        contribution: p.contributionAmount,
        goalId: commonGoal._id,
        joinedAt: p.createdAt,
      }));

      participantGoals = [commonGoal];
    } else {
      // For individual mode, get all participant goals
      participantGoals = await Goal.find({
        _id: { $in: groupGoal.participantGoalIds },
      })
        .populate("creatorId", "name email profileImage")
        .populate("groupParticipantId", "name email profileImage")
        .lean();

      // Get participation for each goal
      for (const goal of participantGoals) {
        const participation = await Participation.findOne({
          goalId: goal._id,
          userId: goal.groupParticipantId._id,
        }).lean();

        participants.push({
          user: goal.groupParticipantId,
          contribution: participation?.contributionAmount || 0,
          goalId: goal._id,
          goalTitle: goal.title,
          goalStatus: goal.status,
          joinedAt: participation?.createdAt || goal.createdAt,
        });
      }
    }

    // Check user roles
    const isGroupCreator = req.user
      ? groupGoal.creatorId._id.toString() === req.user._id.toString()
      : false;
    let userGoalId = null;
    let isParticipating = false;
    let userContribution = 0;

    if (req.user) {
      if (groupGoal.goalMode === "individual") {
        // Find user's individual goal
        const userGoal = participantGoals.find(
          (g) =>
            g.groupParticipantId &&
            g.groupParticipantId._id.toString() === req.user._id.toString()
        );
        if (userGoal) {
          userGoalId = userGoal._id;
          isParticipating = true;
          const userParticipant = participants.find(
            (p) => p.user._id.toString() === req.user._id.toString()
          );
          userContribution = userParticipant?.contribution || 0;
        }
      } else {
        // For common mode, check participation
        const userParticipant = participants.find(
          (p) => p.user._id.toString() === req.user._id.toString()
        );
        if (userParticipant) {
          isParticipating = true;
          userContribution = userParticipant.contribution;
        }
      }
    }

    // Calculate platform fee preview
    const platformFeePercentage =
      parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;
    const estimatedPlatformFee = Math.floor(
      groupGoal.sharedPot * (platformFeePercentage / 100)
    );
    const estimatedPayout = groupGoal.sharedPot - estimatedPlatformFee;

    res.json({
      groupGoal,
      participantGoals,
      participants,
      participantCount: participants.length,
      isGroupCreator,
      isParticipating,
      userGoalId,
      userContribution,
      platformFeePreview: {
        percentage: platformFeePercentage,
        estimatedFee: estimatedPlatformFee,
        estimatedPayout,
        payoutPerParticipant:
          participants.length > 0
            ? Math.floor(estimatedPayout / participants.length)
            : estimatedPayout,
      },
    });
  } catch (error) {
    console.error("Get group goal error:", error);
    res.status(500).json({ error: "Failed to get group goal" });
  }
});

// Join a group goal (creates individual goal for individual mode, or participation for common mode)
router.post(
  "/group/:idOrCode/join",
  auth,
  [
    body("contributionAmount")
      .isInt({ min: 0 })
      .withMessage("Contribution amount must be 0 or more cents"),
    // For individual mode - user provides their own goal details
    body("title")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Title must be max 200 chars"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be max 2000 chars"),
    body("verificationCriteria").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { idOrCode } = req.params;
      const { contributionAmount, title, description, verificationCriteria } =
        req.body;

      // Find group goal
      let groupGoal;
      if (idOrCode.match(/^[0-9a-fA-F]{24}$/)) {
        groupGoal = await GroupGoal.findById(idOrCode);
      }
      if (!groupGoal) {
        groupGoal = await GroupGoal.findOne({
          shareCode: idOrCode.toUpperCase(),
        });
      }
      if (!groupGoal) {
        return res.status(404).json({ error: "Group goal not found" });
      }

      // Check if group is active
      if (groupGoal.status !== "active") {
        return res.status(400).json({ error: "Group goal is not active" });
      }

      // Check if deadline passed
      if (groupGoal.isExpired()) {
        return res
          .status(400)
          .json({ error: "Group goal deadline has passed" });
      }

      // Check minimum contribution
      if (contributionAmount < groupGoal.minSeedAmount) {
        return res.status(400).json({
          error: `Minimum contribution is ${(
            groupGoal.minSeedAmount / 100
          ).toFixed(2)}`,
          minSeedAmount: groupGoal.minSeedAmount,
        });
      }

      // Check wallet balance
      if (req.user.walletBalance < contributionAmount) {
        return res.status(400).json({
          error: "Insufficient wallet balance",
          required: contributionAmount,
          available: req.user.walletBalance,
        });
      }

      if (groupGoal.goalMode === "common") {
        // COMMON MODE: Create participation for the shared goal
        const commonGoal = await Goal.findById(groupGoal.commonGoalId);

        // Check if already participating
        const existingParticipation = await Participation.findOne({
          goalId: commonGoal._id,
          userId: req.user._id,
        });

        if (existingParticipation) {
          return res
            .status(400)
            .json({ error: "Already participating in this group goal" });
        }

        // Create participation
        const participation = await Participation.create({
          goalId: commonGoal._id,
          userId: req.user._id,
          contributionAmount,
        });

        // Deduct from wallet
        req.user.walletBalance -= contributionAmount;
        await req.user.save();

        // Update shared pot
        groupGoal.sharedPot += contributionAmount;
        await groupGoal.save();

        // Update goal total pot for display
        commonGoal.totalPot += contributionAmount;
        await commonGoal.save();

        // Create transaction
        await Transaction.create({
          userId: req.user._id,
          type: "goal_contribution",
          amount: contributionAmount,
          direction: "debit",
          goalId: commonGoal._id,
          description: `Contribution to group goal: ${groupGoal.groupName}`,
        });

        return res.status(201).json({
          message: "Successfully joined group goal",
          participation,
          groupGoal,
        });
      } else {
        // INDIVIDUAL MODE: Create user's own goal

        // Validate title is required for individual mode
        if (!title || !title.trim()) {
          return res
            .status(400)
            .json({ error: "Title is required for individual goals" });
        }

        // Check if user already has a goal in this group
        const existingGoal = await Goal.findOne({
          groupGoalId: groupGoal._id,
          groupParticipantId: req.user._id,
        });

        if (existingGoal) {
          return res
            .status(400)
            .json({ error: "You already have a goal in this group" });
        }

        // Create user's individual goal
        const goal = new Goal({
          creatorId: groupGoal.creatorId, // Group creator is still the goal creator
          title: title.trim(),
          description: description?.trim() || "",
          startDate: groupGoal.startDate,
          deadline: groupGoal.deadline,
          seedAmount: contributionAmount,
          totalPot: contributionAmount,
          verificationType: "image",
          verificationCriteria: verificationCriteria?.trim() || "",
          status: "active",
          goalType: "group",
          groupGoalId: groupGoal._id,
          groupParticipantId: req.user._id,
        });

        await goal.save();

        // Add to group's participant goals
        groupGoal.participantGoalIds.push(goal._id);
        groupGoal.sharedPot += contributionAmount;
        await groupGoal.save();

        // Create participation
        await Participation.create({
          goalId: goal._id,
          userId: req.user._id,
          contributionAmount,
        });

        // Deduct from wallet
        req.user.walletBalance -= contributionAmount;
        await req.user.save();

        // Create transaction
        await Transaction.create({
          userId: req.user._id,
          type: "goal_contribution",
          amount: contributionAmount,
          direction: "debit",
          goalId: goal._id,
          description: `Individual goal in group: ${groupGoal.groupName}`,
        });

        return res.status(201).json({
          message: "Successfully created your goal in the group",
          goal,
          groupGoal,
        });
      }
    } catch (error) {
      console.error("Join group goal error:", error);
      res.status(500).json({ error: "Failed to join group goal" });
    }
  }
);

// Get user's group goals
router.get("/groups/my", auth, async (req, res) => {
  try {
    // Find groups user created
    const createdGroups = await GroupGoal.find({ creatorId: req.user._id })
      .populate("creatorId", "name email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // Find groups user is participating in (via their individual goals or participations)
    const userGoals = await Goal.find({
      groupGoalId: { $exists: true, $ne: null },
      groupParticipantId: req.user._id,
    })
      .select("groupGoalId")
      .lean();

    const participatingGroupIds = userGoals.map((g) => g.groupGoalId);

    // Also check participations for common mode groups
    const participations = await Participation.find({ userId: req.user._id })
      .populate({
        path: "goalId",
        match: { groupGoalId: { $exists: true, $ne: null } },
        select: "groupGoalId",
      })
      .lean();

    for (const p of participations) {
      if (p.goalId && p.goalId.groupGoalId) {
        participatingGroupIds.push(p.goalId.groupGoalId);
      }
    }

    // Get unique group IDs excluding created groups
    const uniqueParticipatingIds = [
      ...new Set(participatingGroupIds.map((id) => id.toString())),
    ].filter((id) => !createdGroups.find((g) => g._id.toString() === id));

    const participatingGroups = await GroupGoal.find({
      _id: { $in: uniqueParticipatingIds },
    })
      .populate("creatorId", "name email profileImage")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      createdGroups,
      participatingGroups,
    });
  } catch (error) {
    console.error("Get user groups error:", error);
    res.status(500).json({ error: "Failed to get user groups" });
  }
});

// =====================================================
// REMINDER SETTINGS ROUTES
// =====================================================

// Get goal reminder settings
router.get("/:id/reminder-settings", auth, async (req, res) => {
  try {
    const { id } = req.params;

    let goal;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      goal = await Goal.findById(id);
    }
    if (!goal) {
      goal = await Goal.findOne({ shareCode: id.toUpperCase() });
    }
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Check if user has access (creator, seeker, or participant)
    const isCreator = goal.creatorId.toString() === req.user._id.toString();
    const isSeeker = goal.seekerId?.toString() === req.user._id.toString();
    const participation = await Participation.findOne({
      goalId: goal._id,
      userId: req.user._id,
    });

    if (!isCreator && !isSeeker && !participation) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Return goal-level settings for creator/seeker, participation-level for participants
    if (isCreator || isSeeker) {
      const reminderSettings = {
        enabled: goal.reminderSettings?.enabled ?? true,
        frequency: goal.reminderSettings?.frequency || null,
        reminderTime: goal.reminderSettings?.reminderTime || null,
        lastReminderSent: goal.reminderSettings?.lastReminderSent || null,
      };
      res.json({ reminderSettings, isGoalLevel: true });
    } else {
      const reminderSettings = {
        enabled: participation.reminderEnabled ?? true,
        reminderTime: participation.reminderTime || null,
        lastReminderSent: participation.lastReminderSent || null,
      };
      res.json({ reminderSettings, isGoalLevel: false });
    }
  } catch (error) {
    console.error("Get goal reminder settings error:", error);
    res.status(500).json({ error: "Failed to get reminder settings" });
  }
});

// Update goal reminder settings
router.put(
  "/:id/reminder-settings",
  auth,
  [
    body("enabled")
      .optional()
      .isBoolean()
      .withMessage("Enabled must be a boolean"),
    body("frequency")
      .optional({ nullable: true })
      .isIn(["daily", "weekly", "monthly", null])
      .withMessage("Frequency must be daily, weekly, monthly, or null"),
    body("reminderTime")
      .optional({ nullable: true })
      .custom((value) => {
        if (value === null) return true;
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      })
      .withMessage("Reminder time must be in HH:mm format or null"),
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled, frequency, reminderTime } = req.body;

      let goal;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        goal = await Goal.findById(id);
      }
      if (!goal) {
        goal = await Goal.findOne({ shareCode: id.toUpperCase() });
      }
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Check if user has access
      const isCreator = goal.creatorId.toString() === req.user._id.toString();
      const isSeeker = goal.seekerId?.toString() === req.user._id.toString();
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      if (!isCreator && !isSeeker && !participation) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update goal-level settings for creator/seeker, participation-level for participants
      if (isCreator || isSeeker) {
        // Initialize reminderSettings if not exists
        if (!goal.reminderSettings) {
          goal.reminderSettings = {
            enabled: true,
            frequency: null,
            reminderTime: null,
            lastReminderSent: null,
            reminderHistory: [],
          };
        }

        if (typeof enabled === "boolean") {
          goal.reminderSettings.enabled = enabled;
        }
        if (frequency !== undefined) {
          goal.reminderSettings.frequency = frequency;
        }
        if (reminderTime !== undefined) {
          goal.reminderSettings.reminderTime = reminderTime;
        }

        await goal.save();

        res.json({
          message: "Reminder settings updated",
          reminderSettings: {
            enabled: goal.reminderSettings.enabled,
            frequency: goal.reminderSettings.frequency,
            reminderTime: goal.reminderSettings.reminderTime,
            lastReminderSent: goal.reminderSettings.lastReminderSent,
          },
          isGoalLevel: true,
        });
      } else {
        // Update participation-level settings
        if (typeof enabled === "boolean") {
          participation.reminderEnabled = enabled;
        }
        if (reminderTime !== undefined) {
          participation.reminderTime = reminderTime;
        }

        await participation.save();

        res.json({
          message: "Reminder settings updated",
          reminderSettings: {
            enabled: participation.reminderEnabled,
            reminderTime: participation.reminderTime,
            lastReminderSent: participation.lastReminderSent,
          },
          isGoalLevel: false,
        });
      }
    } catch (error) {
      console.error("Update goal reminder settings error:", error);
      res.status(500).json({ error: "Failed to update reminder settings" });
    }
  }
);

// =====================================================
// GOAL EDITING HELPER FUNCTIONS
// =====================================================

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if user can edit goal fields within 24-hour window
 * @param {Object} goal - The goal object
 * @param {Object} user - The current user
 * @param {Object} groupGoal - Optional group goal for group goals
 * @param {Object} participation - Optional participation record
 * @returns {Object} { canEdit: boolean, reason?: string, editDeadline?: Date }
 */
function canEditGoal(goal, user, groupGoal = null, participation = null) {
  const userId = user._id.toString();
  const isCreator = goal.creatorId.toString() === userId;
  const isSeeker = goal.seekerId?.toString() === userId;
  const isGroupParticipant = goal.groupParticipantId?.toString() === userId;
  const now = new Date();

  // For self goals: only creator can edit within 24h of creation
  if (goal.goalType === "self" || !goal.goalType) {
    if (!isCreator) {
      return { canEdit: false, reason: "Only goal creator can edit this goal" };
    }
    const editDeadline = new Date(goal.createdAt.getTime() + EDIT_WINDOW_MS);
    if (now > editDeadline) {
      return {
        canEdit: false,
        reason: "24-hour editing window has expired",
        editDeadline,
      };
    }
    return { canEdit: true, editDeadline };
  }

  // For gift goals: creator can edit within 24h of creation, seeker within 24h of acceptance
  if (goal.goalType === "gift") {
    if (isCreator) {
      const editDeadline = new Date(goal.createdAt.getTime() + EDIT_WINDOW_MS);
      if (now > editDeadline) {
        return {
          canEdit: false,
          reason: "24-hour editing window has expired",
          editDeadline,
        };
      }
      return { canEdit: true, editDeadline };
    }
    if (isSeeker && goal.acceptedAt) {
      const editDeadline = new Date(goal.acceptedAt.getTime() + EDIT_WINDOW_MS);
      if (now > editDeadline) {
        return {
          canEdit: false,
          reason: "24-hour editing window has expired",
          editDeadline,
        };
      }
      return { canEdit: true, editDeadline };
    }
    return {
      canEdit: false,
      reason: "Only goal creator or seeker can edit this goal",
    };
  }

  // For group goals
  if (goal.goalType === "group") {
    // For individual mode group goals, the participant who owns the goal can edit
    if (goal.groupParticipantId && isGroupParticipant) {
      const editDeadline = new Date(goal.createdAt.getTime() + EDIT_WINDOW_MS);
      if (now > editDeadline) {
        return {
          canEdit: false,
          reason: "24-hour editing window has expired",
          editDeadline,
        };
      }
      return { canEdit: true, editDeadline };
    }
    // For common mode, only creator can edit the shared goal
    if (!goal.groupParticipantId && isCreator) {
      const editDeadline = new Date(goal.createdAt.getTime() + EDIT_WINDOW_MS);
      if (now > editDeadline) {
        return {
          canEdit: false,
          reason: "24-hour editing window has expired",
          editDeadline,
        };
      }
      return { canEdit: true, editDeadline };
    }
    return {
      canEdit: false,
      reason: "You don't have permission to edit this goal",
    };
  }

  return { canEdit: false, reason: "Unknown goal type" };
}

/**
 * Check if user can adjust seed money/contribution
 * @param {Object} goal - The goal object
 * @param {Object} user - The current user
 * @param {Object} participation - Optional participation record
 * @returns {Object} { canAdjust: boolean, adjustType?: 'seed' | 'contribution', reason?: string }
 */
function canAdjustSeedMoney(goal, user, participation = null) {
  const userId = user._id.toString();
  const isCreator = goal.creatorId.toString() === userId;
  const isSeeker = goal.seekerId?.toString() === userId;
  const isGroupParticipant = goal.groupParticipantId?.toString() === userId;

  // Goal must be active
  if (goal.status !== "active" && goal.status !== "pending_acceptance") {
    return {
      canAdjust: false,
      reason: "Can only adjust seed money for active goals",
    };
  }

  // For self goals: only creator can adjust seed
  if (goal.goalType === "self" || !goal.goalType) {
    if (isCreator) {
      return { canAdjust: true, adjustType: "seed" };
    }
    // Participants can adjust their contribution
    if (participation) {
      return { canAdjust: true, adjustType: "contribution" };
    }
    return {
      canAdjust: false,
      reason: "Only creator or participants can adjust amounts",
    };
  }

  // For gift goals: only creator can adjust seed, participants can adjust contribution
  if (goal.goalType === "gift") {
    if (isCreator) {
      return { canAdjust: true, adjustType: "seed" };
    }
    // Seeker cannot adjust seed money
    if (isSeeker) {
      return {
        canAdjust: false,
        reason: "Goal seeker cannot adjust seed money",
      };
    }
    // Participants can adjust their contribution
    if (participation) {
      return { canAdjust: true, adjustType: "contribution" };
    }
    return {
      canAdjust: false,
      reason: "Only creator or participants can adjust amounts",
    };
  }

  // For group goals
  if (goal.goalType === "group") {
    // For individual mode: participant who owns goal can adjust their seed
    if (goal.groupParticipantId && isGroupParticipant) {
      return { canAdjust: true, adjustType: "seed" };
    }
    // Creator of common goal can adjust their seed
    if (!goal.groupParticipantId && isCreator) {
      return { canAdjust: true, adjustType: "seed" };
    }
    // Participants in common mode can adjust their contribution
    if (participation && !isCreator) {
      return { canAdjust: true, adjustType: "contribution" };
    }
    return {
      canAdjust: false,
      reason: "You don't have permission to adjust amounts",
    };
  }

  return { canAdjust: false, reason: "Unknown goal type" };
}

/**
 * Check if user can edit group goal level fields
 * @param {Object} groupGoal - The group goal object
 * @param {Object} user - The current user
 * @returns {Object} { canEdit: boolean, reason?: string, editDeadline?: Date }
 */
function canEditGroupGoal(groupGoal, user) {
  const userId = user._id.toString();
  const isCreator = groupGoal.creatorId.toString() === userId;
  const now = new Date();

  if (!isCreator) {
    return {
      canEdit: false,
      reason: "Only group creator can edit group settings",
    };
  }

  const editDeadline = new Date(groupGoal.createdAt.getTime() + EDIT_WINDOW_MS);
  if (now > editDeadline) {
    return {
      canEdit: false,
      reason: "24-hour editing window has expired",
      editDeadline,
    };
  }

  return { canEdit: true, editDeadline };
}

// =====================================================
// GOAL UPDATE ENDPOINT
// =====================================================

// Update goal fields (within 24-hour window)
router.put(
  "/:id",
  auth,
  [
    body("title")
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("Title must be max 200 chars"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be max 2000 chars"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Valid start date required"),
    body("deadline")
      .optional()
      .isISO8601()
      .withMessage("Valid deadline date required"),
    body("verificationType")
      .optional()
      .isIn(["image", "data"])
      .withMessage("Invalid verification type"),
    body("verificationCriteria")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Verification criteria must be max 500 chars"),
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        startDate,
        deadline,
        verificationType,
        verificationCriteria,
      } = req.body;

      // Find goal
      let goal;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        goal = await Goal.findById(id);
      }
      if (!goal) {
        goal = await Goal.findOne({ shareCode: id.toUpperCase() });
      }
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Get group goal if applicable
      let groupGoal = null;
      if (goal.groupGoalId) {
        groupGoal = await GroupGoal.findById(goal.groupGoalId);
      }

      // Get participation if applicable
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      // Check edit permissions
      const editCheck = canEditGoal(goal, req.user, groupGoal, participation);
      if (!editCheck.canEdit) {
        return res.status(403).json({
          error: editCheck.reason,
          editDeadline: editCheck.editDeadline,
        });
      }

      // Validate deadline is in the future
      if (deadline && new Date(deadline) <= new Date()) {
        return res
          .status(400)
          .json({ error: "Deadline must be in the future" });
      }

      // Validate startDate is before deadline
      const effectiveDeadline = deadline ? new Date(deadline) : goal.deadline;
      const effectiveStartDate = startDate
        ? new Date(startDate)
        : goal.startDate;
      if (effectiveStartDate >= effectiveDeadline) {
        return res
          .status(400)
          .json({ error: "Start date must be before deadline" });
      }

      // Update allowed fields
      if (title !== undefined) goal.title = title.trim();
      if (description !== undefined) goal.description = description.trim();
      if (startDate !== undefined) goal.startDate = new Date(startDate);
      if (deadline !== undefined) goal.deadline = new Date(deadline);
      if (verificationType !== undefined)
        goal.verificationType = verificationType;
      if (verificationCriteria !== undefined)
        goal.verificationCriteria = verificationCriteria.trim();

      await goal.save();

      // Populate for response
      await goal.populate("creatorId", "name email profileImage");
      if (goal.seekerId) {
        await goal.populate("seekerId", "name email profileImage");
      }

      res.json({
        message: "Goal updated successfully",
        goal,
        editDeadline: editCheck.editDeadline,
      });
    } catch (error) {
      console.error("Update goal error:", error);
      res.status(500).json({ error: "Failed to update goal" });
    }
  }
);

// =====================================================
// SEED MONEY ADJUSTMENT ENDPOINT
// =====================================================

// Adjust seed money or contribution amount
router.put(
  "/:id/seed-amount",
  auth,
  [
    body("newAmount")
      .isInt({ min: 100 })
      .withMessage("Amount must be at least $1 (100 cents)"),
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newAmount } = req.body;

      // Find goal
      let goal;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        goal = await Goal.findById(id);
      }
      if (!goal) {
        goal = await Goal.findOne({ shareCode: id.toUpperCase() });
      }
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Check if goal is still active
      if (goal.status !== "active" && goal.status !== "pending_acceptance") {
        return res
          .status(400)
          .json({ error: "Can only adjust amounts for active goals" });
      }

      // Get participation record
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      // Check adjustment permissions
      const adjustCheck = canAdjustSeedMoney(goal, req.user, participation);
      if (!adjustCheck.canAdjust) {
        return res.status(403).json({ error: adjustCheck.reason });
      }

      // Get group goal if applicable
      let groupGoal = null;
      if (goal.groupGoalId) {
        groupGoal = await GroupGoal.findById(goal.groupGoalId);
      }

      // For group goals, check minimum seed amount
      if (groupGoal && newAmount < groupGoal.minSeedAmount) {
        return res.status(400).json({
          error: `Amount must be at least ${(
            groupGoal.minSeedAmount / 100
          ).toFixed(2)}`,
          minAmount: groupGoal.minSeedAmount,
        });
      }

      let oldAmount, difference, transactionDescription;

      if (adjustCheck.adjustType === "seed") {
        // Adjusting goal seed amount (creator)
        oldAmount = goal.seedAmount;
        difference = newAmount - oldAmount;
        transactionDescription =
          difference > 0
            ? `Added seed money to goal: ${goal.title}`
            : `Reduced seed money from goal: ${goal.title}`;

        // Check wallet balance for increases
        if (difference > 0 && req.user.walletBalance < difference) {
          return res.status(400).json({
            error: "Insufficient wallet balance",
            required: difference,
            available: req.user.walletBalance,
          });
        }

        // Update seed amount and total pot
        goal.seedAmount = newAmount;
        goal.totalPot += difference;
        await goal.save();

        // Update GroupGoal shared pot if applicable
        if (groupGoal) {
          groupGoal.sharedPot += difference;
          await groupGoal.save();
        }

        // Update wallet
        req.user.walletBalance -= difference;
        await req.user.save();

        // Create transaction
        await Transaction.create({
          userId: req.user._id,
          type: difference > 0 ? "goal_contribution" : "refund",
          amount: Math.abs(difference),
          direction: difference > 0 ? "debit" : "credit",
          goalId: goal._id,
          description: transactionDescription,
        });

        res.json({
          message: "Seed amount updated successfully",
          goal,
          oldAmount,
          newAmount,
          difference,
          walletBalance: req.user.walletBalance,
        });
      } else {
        // Adjusting participation contribution amount
        if (!participation) {
          return res
            .status(400)
            .json({ error: "You are not participating in this goal" });
        }

        oldAmount = participation.contributionAmount;
        difference = newAmount - oldAmount;
        transactionDescription =
          difference > 0
            ? `Added contribution to goal: ${goal.title}`
            : `Reduced contribution from goal: ${goal.title}`;

        // Check wallet balance for increases
        if (difference > 0 && req.user.walletBalance < difference) {
          return res.status(400).json({
            error: "Insufficient wallet balance",
            required: difference,
            available: req.user.walletBalance,
          });
        }

        // Update participation
        participation.contributionAmount = newAmount;
        await participation.save();

        // Update goal total pot
        goal.totalPot += difference;
        await goal.save();

        // Update GroupGoal shared pot if applicable
        if (groupGoal) {
          groupGoal.sharedPot += difference;
          await groupGoal.save();
        }

        // Update wallet
        req.user.walletBalance -= difference;
        await req.user.save();

        // Create transaction
        await Transaction.create({
          userId: req.user._id,
          type: difference > 0 ? "goal_contribution" : "refund",
          amount: Math.abs(difference),
          direction: difference > 0 ? "debit" : "credit",
          goalId: goal._id,
          description: transactionDescription,
        });

        res.json({
          message: "Contribution amount updated successfully",
          participation,
          oldAmount,
          newAmount,
          difference,
          walletBalance: req.user.walletBalance,
        });
      }
    } catch (error) {
      console.error("Adjust seed amount error:", error);
      res.status(500).json({ error: "Failed to adjust amount" });
    }
  }
);

// =====================================================
// GROUP GOAL UPDATE ENDPOINT
// =====================================================

// Update group goal fields (within 24-hour window)
router.put(
  "/group/:id",
  auth,
  [
    body("groupName")
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage("Group name must be max 200 chars"),
    body("startDate")
      .optional()
      .isISO8601()
      .withMessage("Valid start date required"),
    body("deadline")
      .optional()
      .isISO8601()
      .withMessage("Valid deadline date required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { groupName, startDate, deadline } = req.body;

      // Find group goal
      let groupGoal;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        groupGoal = await GroupGoal.findById(id);
      }
      if (!groupGoal) {
        groupGoal = await GroupGoal.findOne({ shareCode: id.toUpperCase() });
      }
      if (!groupGoal) {
        return res.status(404).json({ error: "Group goal not found" });
      }

      // Check edit permissions
      const editCheck = canEditGroupGoal(groupGoal, req.user);
      if (!editCheck.canEdit) {
        return res.status(403).json({
          error: editCheck.reason,
          editDeadline: editCheck.editDeadline,
        });
      }

      // Check if group goal is still active
      if (groupGoal.status !== "active") {
        return res
          .status(400)
          .json({ error: "Can only edit active group goals" });
      }

      // Validate deadline is in the future
      if (deadline && new Date(deadline) <= new Date()) {
        return res
          .status(400)
          .json({ error: "Deadline must be in the future" });
      }

      // Validate startDate is before deadline
      const effectiveDeadline = deadline
        ? new Date(deadline)
        : groupGoal.deadline;
      const effectiveStartDate = startDate
        ? new Date(startDate)
        : groupGoal.startDate;
      if (effectiveStartDate >= effectiveDeadline) {
        return res
          .status(400)
          .json({ error: "Start date must be before deadline" });
      }

      // Update allowed fields
      if (groupName !== undefined) groupGoal.groupName = groupName.trim();
      if (startDate !== undefined) groupGoal.startDate = new Date(startDate);
      if (deadline !== undefined) groupGoal.deadline = new Date(deadline);

      await groupGoal.save();

      // Also update the associated goals with new dates
      if (startDate || deadline) {
        const updateFields = {};
        if (startDate) updateFields.startDate = new Date(startDate);
        if (deadline) updateFields.deadline = new Date(deadline);

        if (groupGoal.goalMode === "common" && groupGoal.commonGoalId) {
          await Goal.findByIdAndUpdate(groupGoal.commonGoalId, updateFields);
        } else if (groupGoal.participantGoalIds?.length > 0) {
          await Goal.updateMany(
            { _id: { $in: groupGoal.participantGoalIds } },
            updateFields
          );
        }
      }

      // Populate for response
      await groupGoal.populate("creatorId", "name email profileImage");

      res.json({
        message: "Group goal updated successfully",
        groupGoal,
        editDeadline: editCheck.editDeadline,
      });
    } catch (error) {
      console.error("Update group goal error:", error);
      res.status(500).json({ error: "Failed to update group goal" });
    }
  }
);

// =====================================================
// GET EDIT PERMISSIONS ENDPOINT
// =====================================================

// Get edit permissions for a goal
router.get("/:id/edit-permissions", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Find goal
    let goal;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      goal = await Goal.findById(id);
    }
    if (!goal) {
      goal = await Goal.findOne({ shareCode: id.toUpperCase() });
    }
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Get group goal if applicable
    let groupGoal = null;
    if (goal.groupGoalId) {
      groupGoal = await GroupGoal.findById(goal.groupGoalId);
    }

    // Get participation if applicable
    const participation = await Participation.findOne({
      goalId: goal._id,
      userId: req.user._id,
    });

    // Check edit permissions
    const editCheck = canEditGoal(goal, req.user, groupGoal, participation);
    const adjustCheck = canAdjustSeedMoney(goal, req.user, participation);

    // Check group goal edit permissions if applicable
    let groupEditCheck = null;
    if (groupGoal) {
      groupEditCheck = canEditGroupGoal(groupGoal, req.user);
    }

    res.json({
      canEditGoal: editCheck.canEdit,
      editGoalReason: editCheck.reason,
      editGoalDeadline: editCheck.editDeadline,
      canAdjustAmount: adjustCheck.canAdjust,
      adjustType: adjustCheck.adjustType,
      adjustAmountReason: adjustCheck.reason,
      canEditGroupGoal: groupEditCheck?.canEdit || false,
      editGroupGoalReason: groupEditCheck?.reason,
      editGroupGoalDeadline: groupEditCheck?.editDeadline,
      currentSeedAmount: goal.seedAmount,
      currentContribution: participation?.contributionAmount || 0,
      minAmount: groupGoal?.minSeedAmount || 100,
    });
  } catch (error) {
    console.error("Get edit permissions error:", error);
    res.status(500).json({ error: "Failed to get edit permissions" });
  }
});

module.exports = router;
