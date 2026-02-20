const express = require("express");
const { body, param } = require("express-validator");
const { validate } = require("../middleware/validate");
const { auth } = require("../middleware/auth");
const {
  Goal,
  GroupGoal,
  Verification,
  Participation,
  VerificationChat,
} = require("../models");
const {
  verifyGoalWithAI,
  generateAIResponseMessage,
} = require("../services/aiVerificationService");
const { distributeGoalFunds } = require("../services/goalService");
const multer = require("multer");

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"), false);
    }
  },
});

// Get chat history for a goal
router.get("/:goalId/chat", auth, async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    // Check if user has access (creator, seeker, or participant)
    const isCreator = goal.creatorId.toString() === req.user._id.toString();
    const isSeeker =
      goal.seekerId && goal.seekerId.toString() === req.user._id.toString();
    const participation = await Participation.findOne({
      goalId: goal._id,
      userId: req.user._id,
    });
    const isParticipant = !!participation;

    if (!isCreator && !isSeeker && !isParticipant) {
      return res.status(403).json({
        error: "You do not have access to this goal's verification chat",
      });
    }

    // Get or create chat
    const chat = await VerificationChat.getOrCreateForGoal(goal);

    // Populate sender info for messages
    await chat.populate("messages.senderId", "name email profileImage");
    await chat.populate("messages.reactions.userId", "name profileImage");

    // Determine user's role
    const userRole = isSeeker
      ? "seeker"
      : isCreator && !goal.seekerId
      ? "seeker"
      : "participant";
    const canSubmitVerification =
      userRole === "seeker" || (goal.goalType === "group" && isParticipant);

    res.json({
      chat: {
        _id: chat._id,
        goalId: chat.goalId,
        messages: chat.messages,
        initialSummary: chat.initialSummary,
        completionConfirmed: chat.completionConfirmed,
        completionConfirmedAt: chat.completionConfirmedAt,
      },
      goal: {
        _id: goal._id,
        title: goal.title,
        status: goal.status,
        deadline: goal.deadline,
        goalType: goal.goalType,
      },
      userRole,
      canSubmitVerification,
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
});

// Submit verification proof for a goal (supports image, text, and attachments)
router.post(
  "/:goalId",
  auth,
  upload.single("proofImage"),
  [
    body("proofData").optional().isObject(),
    body("proofText").optional().trim(),
    body("attachments").optional(),
  ],
  validate,
  async (req, res) => {
    try {
      const { goalId } = req.params;
      let { proofData, proofText, attachments } = req.body;

      // Parse attachments if it's a string
      if (typeof attachments === "string") {
        try {
          attachments = JSON.parse(attachments);
        } catch (e) {
          attachments = [];
        }
      }

      // Find goal
      const goal = await Goal.findById(goalId);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      const isGroupGoal = goal.goalType === "group";

      // Check if this is a GroupGoal-based group goal
      let groupGoal = null;
      if (goal.groupGoalId) {
        groupGoal = await GroupGoal.findById(goal.groupGoalId);
      }

      // Determine who can submit verification
      if (isGroupGoal) {
        // For group goals, any participant can submit verification
        const participation = await Participation.findOne({
          goalId: goal._id,
          userId: req.user._id,
        });

        if (!participation) {
          return res.status(403).json({
            error: "Only participants can submit verification for group goals",
          });
        }

        // Check if deadline hasn't passed (use GroupGoal deadline if available)
        const deadline = groupGoal ? groupGoal.deadline : goal.deadline;
        if (new Date() > deadline) {
          return res.status(400).json({
            error:
              "Deadline has passed. Verification can no longer be submitted.",
          });
        }
      } else {
        // For non-group goals, only seeker or creator can submit
        const canSubmit = goal.seekerId
          ? goal.seekerId.toString() === req.user._id.toString()
          : goal.creatorId.toString() === req.user._id.toString();

        if (!canSubmit) {
          const expectedSubmitter = goal.seekerId
            ? "goal seeker"
            : "goal creator";
          return res.status(403).json({
            error: `Only ${expectedSubmitter} can submit verification`,
          });
        }

        // Check deadline for non-group goals too
        if (new Date() > goal.deadline) {
          return res.status(400).json({
            error:
              "Deadline has passed. Verification can no longer be submitted.",
          });
        }
      }

      // Check if goal is active
      if (goal.status !== "active") {
        return res
          .status(400)
          .json({ error: `Goal is already ${goal.status}` });
      }

      // Require at least one form of proof
      if (
        !req.file &&
        !proofText &&
        (!attachments || attachments.length === 0)
      ) {
        return res.status(400).json({
          error: "Please provide proof (image, text, or attachments)",
        });
      }

      // Convert image to base64 for AI processing
      let imageBase64 = null;
      let proofImageUrl = null;
      if (req.file) {
        imageBase64 = req.file.buffer.toString("base64");
        proofImageUrl = `data:${req.file.mimetype};base64,${imageBase64}`;
      }

      // Get or create chat for this goal
      const chat = await VerificationChat.getOrCreateForGoal(goal);

      // Create verification record
      const verification = new Verification({
        goalId,
        submittedBy: req.user._id,
        proofImageUrl,
        proofText,
        attachments: attachments || [],
        proofData,
      });

      // Perform AI verification with all context
      const aiResult = await verifyGoalWithAI(
        goal,
        imageBase64,
        req.file?.mimetype,
        proofData,
        proofText,
        attachments
      );

      verification.aiVerificationResult = aiResult;

      // Determine final status based on AI confidence and result
      const CONFIDENCE_THRESHOLD = 70;

      // Process verification status - goal stays active until user confirms completion
      if (
        aiResult.confidence >= CONFIDENCE_THRESHOLD &&
        aiResult.verificationStatus === "completed"
      ) {
        verification.finalStatus = "verified";
        verification.manualReviewStatus = "not_required";
        // Goal stays active - user must confirm completion to change status
      } else if (
        aiResult.confidence >= CONFIDENCE_THRESHOLD &&
        aiResult.verificationStatus === "not_related"
      ) {
        verification.finalStatus = "rejected";
        verification.manualReviewStatus = "not_required";
        // Goal stays active - let them try again with relevant proof
      } else {
        // Progress or low confidence - keep verification as pending
        verification.finalStatus = "pending";
        verification.manualReviewStatus =
          aiResult.confidence < CONFIDENCE_THRESHOLD
            ? "pending"
            : "not_required";
        // Goal stays active - they're making progress but not done yet
      }

      await verification.save();

      // Add user's verification message to chat
      const userMessageContent = {
        verificationId: verification._id,
      };
      if (proofText) userMessageContent.text = proofText;
      if (proofImageUrl) userMessageContent.imageUrl = proofImageUrl;
      if (attachments && attachments.length > 0)
        userMessageContent.attachments = attachments;

      chat.messages.push({
        type: "verification",
        senderId: req.user._id,
        content: userMessageContent,
        createdAt: new Date(),
      });

      // Add AI response message to chat
      const aiResponseText = generateAIResponseMessage(aiResult);
      chat.messages.push({
        type: "ai_response",
        content: { text: aiResponseText },
        aiResult: {
          status: aiResult.verificationStatus,
          reasoning: aiResult.reasoning,
          confidence: aiResult.confidence,
        },
        createdAt: new Date(),
      });

      await chat.save();

      res.json({
        message: "Verification submitted",
        verification: {
          id: verification._id,
          aiResult: {
            verified: aiResult.verified,
            verificationStatus: aiResult.verificationStatus,
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
          },
          finalStatus: verification.finalStatus,
          needsManualReview: verification.manualReviewStatus === "pending",
        },
        goalStatus: goal.status,
        canConfirmCompletion:
          aiResult.verificationStatus === "completed" &&
          !chat.completionConfirmed,
      });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ error: "Failed to process verification" });
    }
  }
);

// Add reaction to a message
router.post(
  "/:goalId/chat/react",
  auth,
  [
    body("messageId").notEmpty().withMessage("Message ID is required"),
    body("emoji").notEmpty().withMessage("Emoji is required"),
  ],
  validate,
  async (req, res) => {
    try {
      const { goalId } = req.params;
      const { messageId, emoji } = req.body;

      const goal = await Goal.findById(goalId);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Check if user has access
      const isCreator = goal.creatorId.toString() === req.user._id.toString();
      const isSeeker =
        goal.seekerId && goal.seekerId.toString() === req.user._id.toString();
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      if (!isCreator && !isSeeker && !participation) {
        return res.status(403).json({
          error: "You do not have access to this goal's verification chat",
        });
      }

      const chat = await VerificationChat.findOne({ goalId });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      await chat.addReaction(messageId, req.user._id, emoji);

      // Get the updated message
      const message = chat.messages.id(messageId);

      res.json({
        message: "Reaction updated",
        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Add reaction error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to add reaction" });
    }
  }
);

// Add participant comment (AI will not respond)
router.post(
  "/:goalId/chat/comment",
  auth,
  [body("text").notEmpty().trim().withMessage("Comment text is required")],
  validate,
  async (req, res) => {
    try {
      const { goalId } = req.params;
      const { text } = req.body;

      const goal = await Goal.findById(goalId);
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }

      // Check if user has access (must be participant, creator, or seeker)
      const isCreator = goal.creatorId.toString() === req.user._id.toString();
      const isSeeker =
        goal.seekerId && goal.seekerId.toString() === req.user._id.toString();
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });

      if (!isCreator && !isSeeker && !participation) {
        return res.status(403).json({
          error: "You do not have access to this goal's verification chat",
        });
      }

      const chat = await VerificationChat.findOne({ goalId });
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      // Add participant comment - AI will NOT respond to this
      const newMessage = {
        type: "participant_comment",
        senderId: req.user._id,
        content: { text },
        createdAt: new Date(),
      };

      chat.messages.push(newMessage);
      await chat.save();

      // Populate the sender info
      await chat.populate("messages.senderId", "name email profileImage");
      const addedMessage = chat.messages[chat.messages.length - 1];

      res.json({
        message: "Comment added",
        chatMessage: addedMessage,
      });
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  }
);

// Goal seeker confirms completion
router.post("/:goalId/confirm-complete", auth, async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const isGroupGoal = goal.goalType === "group";

    // Only seeker or creator (if no seeker) can confirm completion
    const canConfirm = goal.seekerId
      ? goal.seekerId.toString() === req.user._id.toString()
      : goal.creatorId.toString() === req.user._id.toString();

    // For group goals, any verified participant can confirm their own completion
    if (isGroupGoal) {
      const participation = await Participation.findOne({
        goalId: goal._id,
        userId: req.user._id,
      });
      if (!participation) {
        return res.status(403).json({
          error: "Only participants can confirm completion for group goals",
        });
      }
    } else if (!canConfirm) {
      return res
        .status(403)
        .json({ error: "Only the goal seeker can confirm completion" });
    }

    // Check if there's a verified submission
    const verifiedSubmission = await Verification.findOne({
      goalId,
      submittedBy: req.user._id,
      "aiVerificationResult.verificationStatus": "completed",
    });

    if (!verifiedSubmission) {
      return res.status(400).json({
        error:
          "No completed verification found. Please submit proof that shows goal completion first.",
      });
    }

    const chat = await VerificationChat.findOne({ goalId });
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Mark completion as confirmed in chat
    chat.completionConfirmed = true;
    chat.completionConfirmedAt = new Date();
    chat.completionConfirmedBy = req.user._id;

    // Add system message about confirmation
    chat.messages.push({
      type: "system",
      content: {
        text: "🎊 **Goal completion confirmed!** Congratulations on achieving your goal!",
      },
      createdAt: new Date(),
    });

    await chat.save();

    // For non-group goals, complete the goal and distribute funds
    if (!isGroupGoal) {
      goal.status = "completed";
      goal.completedAt = new Date();
      await goal.save();

      // Distribute funds
      await distributeGoalFunds(goal, true);

      res.json({
        message: "Goal completed! Funds have been distributed.",
        goalStatus: "completed",
        completionConfirmed: true,
      });
    } else {
      // For group goals, keep active until deadline
      // The user's individual completion is recorded
      res.json({
        message:
          "Your completion has been confirmed! After the deadline, successful participants will receive their share.",
        goalStatus: goal.status,
        completionConfirmed: true,
      });
    }
  } catch (error) {
    console.error("Confirm completion error:", error);
    res.status(500).json({ error: "Failed to confirm completion" });
  }
});

// Get verification status for a goal
router.get("/:goalId", auth, async (req, res) => {
  try {
    const { goalId } = req.params;

    const verifications = await Verification.find({ goalId })
      .sort({ createdAt: -1 })
      .lean();

    if (verifications.length === 0) {
      return res
        .status(404)
        .json({ error: "No verification found for this goal" });
    }

    // Return all verifications for multiple submission support
    res.json({
      verification: verifications[0], // Latest for backward compatibility
      verifications,
      count: verifications.length,
    });
  } catch (error) {
    console.error("Get verification error:", error);
    res.status(500).json({ error: "Failed to get verification" });
  }
});

// Admin: Manual review (would need admin auth in production)
router.post(
  "/:verificationId/review",
  auth,
  [
    body("approved").isBoolean().withMessage("Approval status required"),
    body("notes").optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { verificationId } = req.params;
      const { approved, notes } = req.body;

      const verification = await Verification.findById(verificationId);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      if (verification.manualReviewStatus !== "pending") {
        return res
          .status(400)
          .json({ error: "Verification is not pending review" });
      }

      // Update verification
      verification.manualReviewStatus = approved ? "approved" : "rejected";
      verification.finalStatus = approved ? "verified" : "rejected";
      verification.manualReviewNotes = notes;
      verification.manualReviewedBy = req.user._id;
      verification.manualReviewedAt = new Date();

      // Update the AI result status based on manual review
      if (verification.aiVerificationResult) {
        verification.aiVerificationResult.verificationStatus = approved
          ? "completed"
          : "not_related";
      }

      await verification.save();

      // Update goal
      const goal = await Goal.findById(verification.goalId);

      // For group goals (especially GroupGoal-based), don't immediately complete/fail
      const isGroupGoal = goal.goalType === "group";

      if (!isGroupGoal && approved) {
        // For non-group goals, wait for user to confirm completion
        // Don't auto-complete here
      }

      // Add message to chat about manual review
      const chat = await VerificationChat.findOne({
        goalId: verification.goalId,
      });
      if (chat) {
        chat.messages.push({
          type: "system",
          content: {
            text: approved
              ? "✅ Your submission has been manually reviewed and approved!"
              : `❌ Your submission has been manually reviewed. ${
                  notes || "Please try submitting new proof."
                }`,
          },
          createdAt: new Date(),
        });
        await chat.save();
      }

      res.json({
        message: `Verification ${approved ? "approved" : "rejected"}`,
        verification,
        goalStatus: goal.status,
        note: isGroupGoal
          ? "Group goal funds will be distributed after deadline"
          : undefined,
      });
    } catch (error) {
      console.error("Manual review error:", error);
      res.status(500).json({ error: "Failed to process review" });
    }
  }
);

// Get all verifications for a group goal
router.get("/group/:groupGoalId", auth, async (req, res) => {
  try {
    const { groupGoalId } = req.params;

    const groupGoal = await GroupGoal.findById(groupGoalId);
    if (!groupGoal) {
      return res.status(404).json({ error: "Group goal not found" });
    }

    // Get all verifications based on mode
    let verifications = [];
    if (groupGoal.goalMode === "common") {
      verifications = await Verification.find({
        goalId: groupGoal.commonGoalId,
      })
        .populate("submittedBy", "name email profileImage")
        .sort({ createdAt: -1 })
        .lean();
    } else {
      for (const goalId of groupGoal.participantGoalIds) {
        const goalVerifications = await Verification.find({ goalId })
          .populate("submittedBy", "name email profileImage")
          .lean();

        // Add goal info to each verification
        const goal = await Goal.findById(goalId)
          .select("title groupParticipantId")
          .lean();
        for (const v of goalVerifications) {
          v.goalTitle = goal.title;
          v.goalId = goalId;
        }
        verifications.push(...goalVerifications);
      }
      verifications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    // Calculate summary with new status types
    const summary = {
      total: verifications.length,
      verified: verifications.filter((v) => v.finalStatus === "verified")
        .length,
      rejected: verifications.filter((v) => v.finalStatus === "rejected")
        .length,
      pending: verifications.filter((v) => v.finalStatus === "pending").length,
      // New breakdown by AI status
      byStatus: {
        completed: verifications.filter(
          (v) => v.aiVerificationResult?.verificationStatus === "completed"
        ).length,
        progress: verifications.filter(
          (v) => v.aiVerificationResult?.verificationStatus === "progress"
        ).length,
        not_related: verifications.filter(
          (v) => v.aiVerificationResult?.verificationStatus === "not_related"
        ).length,
      },
    };

    res.json({
      groupGoal: {
        _id: groupGoal._id,
        groupName: groupGoal.groupName,
        goalMode: groupGoal.goalMode,
        deadline: groupGoal.deadline,
        status: groupGoal.status,
      },
      verifications,
      summary,
    });
  } catch (error) {
    console.error("Get group verifications error:", error);
    res.status(500).json({ error: "Failed to get group verifications" });
  }
});

module.exports = router;
