const {
  Goal,
  GroupGoal,
  Participation,
  User,
  Transaction,
  Verification,
} = require("../models");
const {
  notifyGoalCompleted,
  notifyGoalFailed,
  notifyPaymentReceived,
  notifyDeadlineReminder,
} = require("./notificationService");

/**
 * Activate the next goal in a recurring series
 * Called when a recurring goal completes or fails
 * @param {Object} completedGoal - The goal that just completed or failed
 */
async function activateNextRecurringGoal(completedGoal) {
  try {
    // Only process recurring goals
    if (!completedGoal.isRecurring || !completedGoal.recurringGroupId) {
      return null;
    }

    // Find the next goal in the series (next recurringIndex with status 'not_started')
    const nextGoal = await Goal.findOne({
      recurringGroupId: completedGoal.recurringGroupId,
      recurringIndex: completedGoal.recurringIndex + 1,
      status: "not_started",
    });

    if (!nextGoal) {
      console.log(
        `No more goals in recurring series ${completedGoal.recurringGroupId}`
      );
      return null;
    }

    const creator = await User.findById(nextGoal.creatorId);

    // Check if creator has sufficient balance for the next goal
    if (creator.walletBalance < nextGoal.seedAmount) {
      console.log(
        `Creator has insufficient balance for next recurring goal. Required: ${nextGoal.seedAmount}, Available: ${creator.walletBalance}`
      );
      // Mark the next goal as failed due to insufficient funds
      nextGoal.status = "failed";
      nextGoal.failedAt = new Date();
      await nextGoal.save();

      // Continue to try activating the following goals
      return activateNextRecurringGoal(nextGoal);
    }

    // Determine the status (pending_acceptance for gift goals, active otherwise)
    const newStatus = nextGoal.seekerEmail ? "pending_acceptance" : "active";

    // Activate the goal
    nextGoal.status = newStatus;
    nextGoal.totalPot = nextGoal.seedAmount;
    await nextGoal.save();

    // Deduct seed amount from creator's wallet
    creator.walletBalance -= nextGoal.seedAmount;
    await creator.save();

    // Create transaction
    await Transaction.create({
      userId: creator._id,
      type: "goal_contribution",
      amount: nextGoal.seedAmount,
      direction: "debit",
      goalId: nextGoal._id,
      description: `Seed money for recurring goal: ${nextGoal.title} (${nextGoal.recurringIndex} of series)`,
    });

    // For group goals, automatically create participation for creator
    if (nextGoal.goalType === "group") {
      await Participation.create({
        goalId: nextGoal._id,
        userId: creator._id,
        contributionAmount: nextGoal.seedAmount,
      });
    }

    // If the completed goal had participants (for gift goals), replicate participation for recurring gift goals
    if (nextGoal.seekerEmail && completedGoal.seekerId) {
      // Set the seeker from the previous goal
      nextGoal.seekerId = completedGoal.seekerId;
      nextGoal.acceptedAt = new Date();
      nextGoal.status = "active";
      await nextGoal.save();

      // Create participation for the creator (they're the sponsor)
      await Participation.create({
        goalId: nextGoal._id,
        userId: creator._id,
        contributionAmount: nextGoal.seedAmount,
      });
    }

    console.log(
      `Activated next recurring goal ${nextGoal._id} (index ${nextGoal.recurringIndex}) in series ${nextGoal.recurringGroupId}`
    );
    return nextGoal;
  } catch (error) {
    console.error("Error activating next recurring goal:", error);
    throw error;
  }
}

/**
 * Distribute funds for GroupGoal-based group goals
 * Uses GroupGoal.sharedPot and handles both common and individual modes
 * @param {Object} goal - The goal object (can be the common goal or an individual goal)
 * @param {boolean} success - Whether the goal was completed successfully
 */
async function distributeGroupGoalFunds(goal, success) {
  try {
    const groupGoal = await GroupGoal.findById(goal.groupGoalId);
    if (!groupGoal) {
      console.error(`GroupGoal not found for goal ${goal._id}`);
      return;
    }

    const creator = await User.findById(groupGoal.creatorId);
    const platformFeePercentage =
      parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;

    // Get all verifications and participations based on mode
    let allVerifications = [];
    let allParticipations = [];
    let allParticipantUserIds = [];

    if (groupGoal.goalMode === "common") {
      // Common mode: all verifications are for the single shared goal
      allVerifications = await Verification.find({
        goalId: groupGoal.commonGoalId,
      });
      allParticipations = await Participation.find({
        goalId: groupGoal.commonGoalId,
      });
      allParticipantUserIds = allParticipations.map((p) => p.userId.toString());
    } else {
      // Individual mode: get verifications for all participant goals
      for (const goalId of groupGoal.participantGoalIds) {
        const verifications = await Verification.find({ goalId });
        allVerifications.push(...verifications);

        const participations = await Participation.find({ goalId });
        allParticipations.push(...participations);
      }

      // Get all participant user IDs from individual goals
      const participantGoals = await Goal.find({
        _id: { $in: groupGoal.participantGoalIds },
      });
      allParticipantUserIds = participantGoals.map((g) =>
        g.groupParticipantId.toString()
      );
    }

    if (success) {
      // Find all participants with verified verifications (submitted before deadline)
      const successfulVerifications = allVerifications.filter((v) => {
        const submittedBeforeDeadline =
          new Date(v.createdAt) <= groupGoal.deadline;
        const isVerified =
          v.finalStatus === "verified" ||
          (v.manualReviewStatus === "approved" && v.finalStatus === "verified");
        return submittedBeforeDeadline && isVerified;
      });

      const successfulParticipantIds = successfulVerifications.map((v) =>
        v.submittedBy.toString()
      );

      if (successfulParticipantIds.length === 0) {
        // No successful participants - forfeit entire pot to platform
        groupGoal.platformFeeAmount = groupGoal.sharedPot;
        groupGoal.status = "failed";
        groupGoal.failedAt = new Date();
        await groupGoal.save();

        await Transaction.create({
          userId: creator._id,
          type: "platform_fee",
          amount: groupGoal.sharedPot,
          direction: "debit",
          goalId: goal._id,
          description: `Forfeited pot (no successful participants): ${groupGoal.groupName}`,
        });

        // Update all participations
        for (const p of allParticipations) {
          p.status = "distributed";
          await p.save();
        }

        // Update all goals in the group
        if (groupGoal.goalMode === "common") {
          await Goal.updateOne(
            { _id: groupGoal.commonGoalId },
            { status: "failed", failedAt: new Date() }
          );
        } else {
          await Goal.updateMany(
            { _id: { $in: groupGoal.participantGoalIds } },
            { status: "failed", failedAt: new Date() }
          );
        }

        console.log(
          `Group goal ${groupGoal._id} failed. No successful participants. Entire pot forfeited.`
        );
        return;
      }

      // Calculate equal share for each successful participant
      const platformFee = Math.floor(
        groupGoal.sharedPot * (platformFeePercentage / 100)
      );
      const netPayout = groupGoal.sharedPot - platformFee;
      const sharePerParticipant = Math.floor(
        netPayout / successfulParticipantIds.length
      );
      const remainder =
        netPayout - sharePerParticipant * successfulParticipantIds.length;

      groupGoal.platformFeeAmount = platformFee;
      groupGoal.status = "completed";
      groupGoal.completedAt = new Date();
      await groupGoal.save();

      // Distribute to each successful participant
      for (let i = 0; i < successfulParticipantIds.length; i++) {
        const participantId = successfulParticipantIds[i];
        const participant = await User.findById(participantId);

        // First participant gets any remainder from rounding
        const share =
          i === 0 ? sharePerParticipant + remainder : sharePerParticipant;

        participant.walletBalance += share;
        await participant.save();

        await Transaction.create({
          userId: participant._id,
          type: "goal_payout",
          amount: share,
          direction: "credit",
          goalId: goal._id,
          description: `Group goal completed: ${groupGoal.groupName}`,
        });

        await notifyPaymentReceived(
          participant._id,
          share,
          `Group "${groupGoal.groupName}" completed!`
        );
      }

      // Record platform fee transaction
      await Transaction.create({
        userId: creator._id,
        type: "platform_fee",
        amount: platformFee,
        direction: "debit",
        goalId: goal._id,
        description: `Platform fee (${platformFeePercentage}%)`,
      });

      // Update all participations
      for (const p of allParticipations) {
        p.status = "distributed";
        await p.save();
      }

      // Update all goals in the group to completed
      if (groupGoal.goalMode === "common") {
        await Goal.updateOne(
          { _id: groupGoal.commonGoalId },
          { status: "completed", completedAt: new Date() }
        );
      } else {
        await Goal.updateMany(
          { _id: { $in: groupGoal.participantGoalIds } },
          { status: "completed", completedAt: new Date() }
        );
      }

      console.log(
        `Group goal ${groupGoal._id} completed. ${successfulParticipantIds.length} participants received payout. Platform fee: ${platformFee} cents`
      );
    } else {
      // Group goal failed - forfeit entire pot to platform
      groupGoal.platformFeeAmount = groupGoal.sharedPot;
      groupGoal.status = "failed";
      groupGoal.failedAt = new Date();
      await groupGoal.save();

      await Transaction.create({
        userId: creator._id,
        type: "platform_fee",
        amount: groupGoal.sharedPot,
        direction: "debit",
        goalId: goal._id,
        description: `Forfeited pot (goal failed): ${groupGoal.groupName}`,
      });

      // Update all participations
      for (const p of allParticipations) {
        p.status = "distributed";
        await p.save();
      }

      // Update all goals in the group to failed
      if (groupGoal.goalMode === "common") {
        await Goal.updateOne(
          { _id: groupGoal.commonGoalId },
          { status: "failed", failedAt: new Date() }
        );
      } else {
        await Goal.updateMany(
          { _id: { $in: groupGoal.participantGoalIds } },
          { status: "failed", failedAt: new Date() }
        );
      }

      console.log(
        `Group goal ${groupGoal._id} failed. Entire pot forfeited to platform.`
      );
    }

    // Handle synchronized recurring cycles for group goals
    if (groupGoal.isRecurring) {
      await activateNextGroupGoalCycle(groupGoal);
    }
  } catch (error) {
    console.error("Error distributing group goal funds:", error);
    throw error;
  }
}

/**
 * Activate the next cycle for a synchronized recurring group goal
 * Only activates when ALL participants have completed the current cycle
 * @param {Object} groupGoal - The GroupGoal object
 */
async function activateNextGroupGoalCycle(groupGoal) {
  try {
    // Check if there are more cycles
    if (!groupGoal.isRecurring || !groupGoal.recurrenceEndDate) {
      return null;
    }

    // Calculate next deadline
    let nextDeadline = new Date(groupGoal.deadline);
    switch (groupGoal.recurrencePattern) {
      case "daily":
        nextDeadline.setDate(nextDeadline.getDate() + 1);
        break;
      case "weekly":
        nextDeadline.setDate(nextDeadline.getDate() + 7);
        break;
      case "monthly":
        nextDeadline.setMonth(nextDeadline.getMonth() + 1);
        break;
    }

    // Check if next deadline is past the end date
    if (nextDeadline > new Date(groupGoal.recurrenceEndDate)) {
      console.log(
        `Recurring group goal ${groupGoal._id} has completed all cycles`
      );
      return null;
    }

    const creator = await User.findById(groupGoal.creatorId);

    // Create new GroupGoal for next cycle
    const nextGroupGoal = new GroupGoal({
      groupName: groupGoal.groupName,
      creatorId: groupGoal.creatorId,
      goalMode: groupGoal.goalMode,
      deadline: nextDeadline,
      startDate: groupGoal.deadline, // Start from previous deadline
      isRecurring: true,
      recurrencePattern: groupGoal.recurrencePattern,
      recurrenceEndDate: groupGoal.recurrenceEndDate,
      currentCycle: groupGoal.currentCycle + 1,
      sharedPot: 0,
      minSeedAmount: groupGoal.minSeedAmount,
      status: "active",
    });

    // Get all participants from the current cycle
    let participantUserIds = [];
    if (groupGoal.goalMode === "common") {
      const participations = await Participation.find({
        goalId: groupGoal.commonGoalId,
      });
      participantUserIds = participations.map((p) => ({
        userId: p.userId,
        contribution: groupGoal.minSeedAmount,
      }));
    } else {
      const participantGoals = await Goal.find({
        _id: { $in: groupGoal.participantGoalIds },
      });
      for (const g of participantGoals) {
        participantUserIds.push({
          userId: g.groupParticipantId,
          contribution: groupGoal.minSeedAmount,
          title: g.title,
          description: g.description,
          verificationCriteria: g.verificationCriteria,
        });
      }
    }

    // Check if all participants have sufficient balance
    let totalRequired = 0;
    const participantsWithBalance = [];
    for (const p of participantUserIds) {
      const user = await User.findById(p.userId);
      if (user.walletBalance >= groupGoal.minSeedAmount) {
        participantsWithBalance.push({ ...p, user });
        totalRequired += groupGoal.minSeedAmount;
      } else {
        console.log(
          `Participant ${p.userId} has insufficient balance for next cycle`
        );
      }
    }

    if (participantsWithBalance.length === 0) {
      console.log(
        `No participants have sufficient balance for next cycle of group goal ${groupGoal._id}`
      );
      return null;
    }

    await nextGroupGoal.save();

    if (groupGoal.goalMode === "common") {
      // Create the shared goal for next cycle
      const commonGoal = new Goal({
        creatorId: groupGoal.creatorId,
        title: (await Goal.findById(groupGoal.commonGoalId)).title,
        description: (await Goal.findById(groupGoal.commonGoalId)).description,
        startDate: groupGoal.deadline,
        deadline: nextDeadline,
        seedAmount: groupGoal.minSeedAmount,
        totalPot: 0,
        verificationType: "image",
        verificationCriteria: (await Goal.findById(groupGoal.commonGoalId))
          .verificationCriteria,
        status: "active",
        goalType: "group",
        groupGoalId: nextGroupGoal._id,
      });
      await commonGoal.save();
      nextGroupGoal.commonGoalId = commonGoal._id;

      // Create participations and deduct from wallets
      for (const p of participantsWithBalance) {
        p.user.walletBalance -= groupGoal.minSeedAmount;
        await p.user.save();

        await Participation.create({
          goalId: commonGoal._id,
          userId: p.userId,
          contributionAmount: groupGoal.minSeedAmount,
        });

        await Transaction.create({
          userId: p.userId,
          type: "goal_contribution",
          amount: groupGoal.minSeedAmount,
          direction: "debit",
          goalId: commonGoal._id,
          description: `Recurring contribution to group: ${groupGoal.groupName} (Cycle ${nextGroupGoal.currentCycle})`,
        });

        nextGroupGoal.sharedPot += groupGoal.minSeedAmount;
      }

      commonGoal.totalPot = nextGroupGoal.sharedPot;
      await commonGoal.save();
    } else {
      // Individual mode: create individual goals for all participants
      for (const p of participantsWithBalance) {
        const individualGoal = new Goal({
          creatorId: groupGoal.creatorId,
          title: p.title,
          description: p.description,
          startDate: groupGoal.deadline,
          deadline: nextDeadline,
          seedAmount: groupGoal.minSeedAmount,
          totalPot: groupGoal.minSeedAmount,
          verificationType: "image",
          verificationCriteria: p.verificationCriteria,
          status: "active",
          goalType: "group",
          groupGoalId: nextGroupGoal._id,
          groupParticipantId: p.userId,
        });
        await individualGoal.save();

        nextGroupGoal.participantGoalIds.push(individualGoal._id);

        p.user.walletBalance -= groupGoal.minSeedAmount;
        await p.user.save();

        await Participation.create({
          goalId: individualGoal._id,
          userId: p.userId,
          contributionAmount: groupGoal.minSeedAmount,
        });

        await Transaction.create({
          userId: p.userId,
          type: "goal_contribution",
          amount: groupGoal.minSeedAmount,
          direction: "debit",
          goalId: individualGoal._id,
          description: `Recurring contribution to group: ${groupGoal.groupName} (Cycle ${nextGroupGoal.currentCycle})`,
        });

        nextGroupGoal.sharedPot += groupGoal.minSeedAmount;
      }
    }

    await nextGroupGoal.save();

    console.log(
      `Activated next cycle (${nextGroupGoal.currentCycle}) for group goal ${groupGoal._id} with ${participantsWithBalance.length} participants`
    );
    return nextGroupGoal;
  } catch (error) {
    console.error("Error activating next group goal cycle:", error);
    throw error;
  }
}

/**
 * Distribute funds when a goal is completed or failed
 * @param {Object} goal - The goal object
 * @param {boolean} success - Whether the goal was completed successfully
 */
async function distributeGoalFunds(goal, success) {
  try {
    const participations = await Participation.find({ goalId: goal._id });
    const creator = await User.findById(goal.creatorId);
    const isGroupGoal = goal.goalType === "group";

    // Check if this is a GroupGoal-based group goal
    if (isGroupGoal && goal.groupGoalId) {
      await distributeGroupGoalFunds(goal, success);
      return;
    }

    // Legacy group goal distribution logic (for backward compatibility)
    if (isGroupGoal) {
      // Group goal distribution logic
      if (success) {
        // Find all participants with verified verifications (submitted before deadline)
        const allVerifications = await Verification.find({ goalId: goal._id });
        const successfulVerifications = allVerifications.filter((v) => {
          const submittedBeforeDeadline =
            new Date(v.createdAt) <= goal.deadline;
          const isVerified =
            v.finalStatus === "verified" ||
            (v.manualReviewStatus === "approved" &&
              v.finalStatus === "verified");
          return submittedBeforeDeadline && isVerified;
        });

        const successfulParticipantIds = successfulVerifications.map((v) =>
          v.submittedBy.toString()
        );
        const successfulParticipations = participations.filter((p) =>
          successfulParticipantIds.includes(p.userId.toString())
        );

        if (successfulParticipations.length === 0) {
          // No successful participants - forfeit entire pot to platform
          const platformFeePercentage =
            parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;
          const platformFee = Math.floor(
            goal.totalPot * (platformFeePercentage / 100)
          );
          goal.platformFeeAmount = goal.totalPot; // Entire pot forfeited
          await goal.save();

          await Transaction.create({
            userId: creator._id,
            type: "platform_fee",
            amount: goal.totalPot,
            direction: "debit",
            goalId: goal._id,
            description: `Forfeited pot (no successful participants): ${goal.title}`,
          });

          await Participation.updateMany(
            { goalId: goal._id },
            { status: "distributed" }
          );

          await notifyGoalFailed(goal, participations);
          console.log(
            `Group goal ${goal._id} failed. No successful participants. Entire pot forfeited.`
          );
          return;
        }

        // Calculate equal share for each successful participant
        const platformFeePercentage =
          parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;
        const platformFee = Math.floor(
          goal.totalPot * (platformFeePercentage / 100)
        );
        const netPayout = goal.totalPot - platformFee;
        const sharePerParticipant = Math.floor(
          netPayout / successfulParticipations.length
        );
        const remainder =
          netPayout - sharePerParticipant * successfulParticipations.length;

        goal.platformFeeAmount = platformFee;
        await goal.save();

        // Distribute to each successful participant
        for (let i = 0; i < successfulParticipations.length; i++) {
          const participation = successfulParticipations[i];
          const participant = await User.findById(participation.userId);

          // First participant gets any remainder from rounding
          const share =
            i === 0 ? sharePerParticipant + remainder : sharePerParticipant;

          participant.walletBalance += share;
          await participant.save();

          await Transaction.create({
            userId: participant._id,
            type: "goal_payout",
            amount: share,
            direction: "credit",
            goalId: goal._id,
            description: `Group goal completed: ${goal.title}`,
          });

          await notifyPaymentReceived(
            participant._id,
            share,
            `Group goal "${goal.title}" completed!`
          );
        }

        // Record platform fee transaction
        await Transaction.create({
          userId: creator._id,
          type: "platform_fee",
          amount: platformFee,
          direction: "debit",
          goalId: goal._id,
          description: `Platform fee (${platformFeePercentage}%)`,
        });

        await Participation.updateMany(
          { goalId: goal._id },
          { status: "distributed" }
        );

        await notifyGoalCompleted(goal, participations);
        console.log(
          `Group goal ${goal._id} completed. ${successfulParticipations.length} participants received payout. Platform fee: ${platformFee} cents`
        );
      } else {
        // Group goal failed - forfeit entire pot to platform
        goal.platformFeeAmount = goal.totalPot;
        await goal.save();

        await Transaction.create({
          userId: creator._id,
          type: "platform_fee",
          amount: goal.totalPot,
          direction: "debit",
          goalId: goal._id,
          description: `Forfeited pot (goal failed): ${goal.title}`,
        });

        await Participation.updateMany(
          { goalId: goal._id },
          { status: "distributed" }
        );

        await notifyGoalFailed(goal, participations);
        console.log(
          `Group goal ${goal._id} failed. Entire pot forfeited to platform.`
        );
      }

      // Activate next goal in recurring series if applicable
      if (goal.isRecurring && goal.recurringGroupId) {
        await activateNextRecurringGoal(goal);
      }
      return;
    }

    // Non-group goal distribution (existing logic)
    // Determine who receives payout on success
    // If goal has a seeker, they receive the payout; otherwise, creator receives it
    const payoutRecipient = goal.seekerId
      ? await User.findById(goal.seekerId)
      : creator;
    const recipientLabel = goal.seekerId ? "Seeker" : "Creator";

    if (success) {
      // Goal completed successfully
      // Platform fee is calculated on gross amount (Option A)
      const platformFeePercentage =
        parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 5;
      const platformFee = Math.floor(
        goal.totalPot * (platformFeePercentage / 100)
      );
      const payout = goal.totalPot - platformFee;

      // Update goal with fee info
      goal.platformFeeAmount = platformFee;
      await goal.save();

      // Add payout to recipient's wallet (seeker or creator)
      payoutRecipient.walletBalance += payout;
      await payoutRecipient.save();

      // Record payout transaction
      await Transaction.create({
        userId: payoutRecipient._id,
        type: "goal_payout",
        amount: payout,
        direction: "credit",
        goalId: goal._id,
        description: `Goal completed: ${goal.title}`,
      });

      // Record platform fee transaction (for tracking, attributed to recipient)
      await Transaction.create({
        userId: payoutRecipient._id,
        type: "platform_fee",
        amount: platformFee,
        direction: "debit",
        goalId: goal._id,
        description: `Platform fee (${platformFeePercentage}%)`,
      });

      // Mark participations as distributed
      await Participation.updateMany(
        { goalId: goal._id },
        { status: "distributed" }
      );

      // Send notifications
      await notifyGoalCompleted(goal, participations);
      await notifyPaymentReceived(
        payoutRecipient._id,
        payout,
        `Goal "${goal.title}" completed!`
      );

      console.log(
        `Goal ${goal._id} completed. ${recipientLabel} received ${payout} cents. Platform fee: ${platformFee} cents`
      );
    } else {
      // Goal failed
      // Refund participants their contributions
      for (const participation of participations) {
        if (participation.contributionAmount > 0) {
          const participant = await User.findById(participation.userId);
          participant.walletBalance += participation.contributionAmount;
          await participant.save();

          await Transaction.create({
            userId: participant._id,
            type: "refund",
            amount: participation.contributionAmount,
            direction: "credit",
            goalId: goal._id,
            description: `Refund from failed goal: ${goal.title}`,
          });
        }
      }

      // Creator's seed money goes to participants (split equally)
      if (participations.length > 0) {
        const sharePerParticipant = Math.floor(
          goal.seedAmount / participations.length
        );
        const remainder =
          goal.seedAmount - sharePerParticipant * participations.length;

        for (let i = 0; i < participations.length; i++) {
          const participation = participations[i];
          const participant = await User.findById(participation.userId);

          // First participant gets any remainder from rounding
          const share =
            i === 0 ? sharePerParticipant + remainder : sharePerParticipant;

          participant.walletBalance += share;
          await participant.save();

          await Transaction.create({
            userId: participant._id,
            type: "goal_payout",
            amount: share,
            direction: "credit",
            goalId: goal._id,
            description: `Share from failed goal: ${goal.title}`,
          });
        }
      } else {
        // No participants - creator loses their seed money (goes to platform)
        // This is a policy decision - could also return to creator
        await Transaction.create({
          userId: creator._id,
          type: "platform_fee",
          amount: goal.seedAmount,
          direction: "debit",
          goalId: goal._id,
          description: `Forfeited seed money (no participants): ${goal.title}`,
        });
      }

      // Mark participations as refunded
      await Participation.updateMany(
        { goalId: goal._id },
        { status: "refunded" }
      );

      // Send notifications
      await notifyGoalFailed(goal, participations);

      console.log(
        `Goal ${goal._id} failed. Funds distributed to ${participations.length} participants`
      );
    }

    // Activate next goal in recurring series if applicable
    if (goal.isRecurring && goal.recurringGroupId) {
      await activateNextRecurringGoal(goal);
    }
  } catch (error) {
    console.error("Error distributing goal funds:", error);
    throw error;
  }
}

/**
 * Check for expired goals and mark them as failed
 * Called by cron job
 */
async function checkExpiredGoals() {
  try {
    const now = new Date();

    // Find active goals past their deadline
    const expiredGoals = await Goal.find({
      status: "active",
      deadline: { $lt: now },
    });

    // Also check for expired GroupGoals
    const expiredGroupGoals = await GroupGoal.find({
      status: "active",
      deadline: { $lt: now },
    });

    console.log(
      `Found ${expiredGoals.length} expired goals and ${expiredGroupGoals.length} expired group goals`
    );

    // Process expired GroupGoals first
    for (const groupGoal of expiredGroupGoals) {
      try {
        // Get all verifications based on mode
        let allVerifications = [];
        if (groupGoal.goalMode === "common") {
          allVerifications = await Verification.find({
            goalId: groupGoal.commonGoalId,
          });
        } else {
          for (const goalId of groupGoal.participantGoalIds) {
            const verifications = await Verification.find({ goalId });
            allVerifications.push(...verifications);
          }
        }

        // Check if any participants successfully completed before deadline
        const successfulVerifications = allVerifications.filter((v) => {
          const submittedBeforeDeadline =
            new Date(v.createdAt) <= groupGoal.deadline;
          const isVerified =
            v.finalStatus === "verified" ||
            (v.manualReviewStatus === "approved" &&
              v.finalStatus === "verified");
          return submittedBeforeDeadline && isVerified;
        });

        // Get a representative goal for the distribution function
        const representativeGoal =
          groupGoal.goalMode === "common"
            ? await Goal.findById(groupGoal.commonGoalId)
            : await Goal.findById(groupGoal.participantGoalIds[0]);

        if (successfulVerifications.length > 0) {
          console.log(
            `Expired group goal ${groupGoal._id} completed. ${successfulVerifications.length} participants succeeded.`
          );
          await distributeGroupGoalFunds(representativeGoal, true);
        } else {
          console.log(
            `Expired group goal ${groupGoal._id} failed. No successful participants.`
          );
          await distributeGroupGoalFunds(representativeGoal, false);
        }
      } catch (error) {
        console.error(
          `Error processing expired group goal ${groupGoal._id}:`,
          error
        );
      }
    }

    // Process expired individual goals (excluding those already handled by GroupGoal)
    for (const goal of expiredGoals) {
      try {
        // Skip if this goal is part of a GroupGoal (already handled above)
        if (goal.groupGoalId) {
          continue;
        }

        const isGroupGoal = goal.goalType === "group";

        if (isGroupGoal) {
          // Legacy group goals - check all verifications submitted before deadline
          const allVerifications = await Verification.find({
            goalId: goal._id,
          });
          const verificationsBeforeDeadline = allVerifications.filter(
            (v) => new Date(v.createdAt) <= goal.deadline
          );

          // Check if any participants successfully completed
          const successfulVerifications = verificationsBeforeDeadline.filter(
            (v) => {
              const isVerified =
                v.finalStatus === "verified" ||
                (v.manualReviewStatus === "approved" &&
                  v.finalStatus === "verified");
              return isVerified;
            }
          );

          if (successfulVerifications.length > 0) {
            // Some participants succeeded - mark as completed
            goal.status = "completed";
            goal.completedAt = now;
            await goal.save();

            // Distribute funds (success case)
            await distributeGoalFunds(goal, true);
            console.log(
              `Expired group goal ${goal._id} completed. ${successfulVerifications.length} participants succeeded.`
            );
          } else {
            // No successful participants - mark as failed
            goal.status = "failed";
            goal.failedAt = now;
            await goal.save();

            // Distribute funds (failure case - forfeit to platform)
            await distributeGoalFunds(goal, false);
            console.log(
              `Expired group goal ${goal._id} failed. No successful participants.`
            );
          }
        } else {
          // Non-group goals - mark as failed
          goal.status = "failed";
          goal.failedAt = now;
          await goal.save();

          // Distribute funds for failed goal
          await distributeGoalFunds(goal, false);

          console.log(
            `Expired goal ${goal._id} marked as failed and funds distributed`
          );
        }
      } catch (error) {
        console.error(`Error processing expired goal ${goal._id}:`, error);
      }
    }

    return expiredGoals.length + expiredGroupGoals.length;
  } catch (error) {
    console.error("Error checking expired goals:", error);
    throw error;
  }
}

/**
 * Check for goals approaching deadline and send reminders
 * Called by cron job
 * Sends reminders at: 7 days, 3 days, 1 day, and 12 hours before deadline
 */
async function checkUpcomingDeadlines() {
  try {
    const now = new Date();

    // Find active goals that haven't passed their deadline
    const activeGoals = await Goal.find({
      status: "active",
      deadline: { $gt: now },
    });

    let remindersSent = 0;

    for (const goal of activeGoals) {
      try {
        const timeUntilDeadline = goal.deadline.getTime() - now.getTime();
        const daysUntilDeadline = Math.ceil(
          timeUntilDeadline / (1000 * 60 * 60 * 24)
        );
        const hoursUntilDeadline = Math.ceil(
          timeUntilDeadline / (1000 * 60 * 60)
        );

        // Initialize remindersSent array if not present
        if (!goal.remindersSent) {
          goal.remindersSent = [];
        }

        // Check for 7-day reminder (between 7.5 and 6.5 days)
        if (
          daysUntilDeadline <= 7.5 &&
          daysUntilDeadline >= 6.5 &&
          !goal.remindersSent.includes("7d")
        ) {
          await notifyDeadlineReminder(goal, 7);
          goal.remindersSent.push("7d");
          await goal.save();
          remindersSent++;
          console.log(`Sent 7-day reminder for goal ${goal._id}`);
        }
        // Check for 3-day reminder (between 3.5 and 2.5 days)
        else if (
          daysUntilDeadline <= 3.5 &&
          daysUntilDeadline >= 2.5 &&
          !goal.remindersSent.includes("3d")
        ) {
          await notifyDeadlineReminder(goal, 3);
          goal.remindersSent.push("3d");
          await goal.save();
          remindersSent++;
          console.log(`Sent 3-day reminder for goal ${goal._id}`);
        }
        // Check for 1-day reminder (between 30 and 18 hours, roughly 1.25 to 0.75 days)
        else if (
          hoursUntilDeadline <= 30 &&
          hoursUntilDeadline >= 18 &&
          !goal.remindersSent.includes("1d")
        ) {
          await notifyDeadlineReminder(goal, 1);
          goal.remindersSent.push("1d");
          await goal.save();
          remindersSent++;
          console.log(`Sent 1-day reminder for goal ${goal._id}`);
        }
        // Check for 12-hour reminder (between 12 and 6 hours)
        else if (
          hoursUntilDeadline <= 12 &&
          hoursUntilDeadline >= 6 &&
          !goal.remindersSent.includes("12h")
        ) {
          // Show as "1 day" for simplicity (notification function uses days)
          await notifyDeadlineReminder(goal, 1);
          goal.remindersSent.push("12h");
          await goal.save();
          remindersSent++;
          console.log(`Sent 12-hour reminder for goal ${goal._id}`);
        }
      } catch (error) {
        console.error(`Error processing reminder for goal ${goal._id}:`, error);
      }
    }

    if (remindersSent > 0) {
      console.log(`Sent ${remindersSent} deadline reminders`);
    }

    return remindersSent;
  } catch (error) {
    console.error("Error checking upcoming deadlines:", error);
    throw error;
  }
}

/**
 * Get the verification progress status for a goal
 * Based on the best AI verification result
 * @param {string} goalId - The goal ID
 * @returns {Promise<string>} - 'no_update', 'good_progress', or 'fully_completed'
 */
async function getVerificationProgress(goalId) {
  try {
    const verifications = await Verification.find({ goalId });

    if (verifications.length === 0) {
      return "no_update";
    }

    // Find best result based on AI verification status
    const hasCompleted = verifications.some(
      (v) => v.aiVerificationResult?.verificationStatus === "completed"
    );
    if (hasCompleted) {
      return "fully_completed";
    }

    const hasProgress = verifications.some(
      (v) => v.aiVerificationResult?.verificationStatus === "progress"
    );
    if (hasProgress) {
      return "good_progress";
    }

    // Has verifications but none showing progress or completion (all 'not_related')
    return "no_update";
  } catch (error) {
    console.error("Error getting verification progress:", error);
    return "no_update";
  }
}

/**
 * Get verification progress for multiple goals
 * @param {string[]} goalIds - Array of goal IDs
 * @returns {Promise<Object>} - Map of goalId to progress status
 */
async function getVerificationProgressBatch(goalIds) {
  try {
    const verifications = await Verification.find({ goalId: { $in: goalIds } });

    // Group verifications by goal
    const verificationsByGoal = {};
    for (const v of verifications) {
      const goalIdStr = v.goalId.toString();
      if (!verificationsByGoal[goalIdStr]) {
        verificationsByGoal[goalIdStr] = [];
      }
      verificationsByGoal[goalIdStr].push(v);
    }

    // Calculate progress for each goal
    const progressMap = {};
    for (const goalId of goalIds) {
      const goalIdStr = goalId.toString();
      const goalVerifications = verificationsByGoal[goalIdStr] || [];

      if (goalVerifications.length === 0) {
        progressMap[goalIdStr] = "no_update";
        continue;
      }

      const hasCompleted = goalVerifications.some(
        (v) => v.aiVerificationResult?.verificationStatus === "completed"
      );
      if (hasCompleted) {
        progressMap[goalIdStr] = "fully_completed";
        continue;
      }

      const hasProgress = goalVerifications.some(
        (v) => v.aiVerificationResult?.verificationStatus === "progress"
      );
      if (hasProgress) {
        progressMap[goalIdStr] = "good_progress";
        continue;
      }

      progressMap[goalIdStr] = "no_update";
    }

    return progressMap;
  } catch (error) {
    console.error("Error getting verification progress batch:", error);
    return {};
  }
}

module.exports = {
  distributeGoalFunds,
  distributeGroupGoalFunds,
  checkExpiredGoals,
  checkUpcomingDeadlines,
  activateNextRecurringGoal,
  activateNextGroupGoalCycle,
  getVerificationProgress,
  getVerificationProgressBatch,
};
