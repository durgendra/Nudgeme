const { User } = require('../models');

/**
 * Send push notification via Expo
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data to include
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken) {
    console.log('No push token provided');
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data?.status === 'error') {
      console.error('Push notification error:', result.data.message);
    } else {
      console.log('Push notification sent successfully');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    throw error;
  }
}

/**
 * Send notification to a user by ID
 */
async function notifyUser(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId);
    if (user?.pushToken) {
      await sendPushNotification(user.pushToken, title, body, data);
    }
  } catch (error) {
    console.error('Error notifying user:', error);
  }
}

/**
 * Notify goal creator about new participant
 */
async function notifyParticipantJoined(goal, participant, contribution) {
  const contributionText = contribution > 0 
    ? ` with $${(contribution / 100).toFixed(2)}`
    : '';
  
  await notifyUser(
    goal.creatorId,
    '🎉 New Participant!',
    `${participant.name} joined your goal "${goal.title}"${contributionText}`,
    { type: 'participant_joined', goalId: goal._id.toString() }
  );
}

/**
 * Notify all participants about goal completion
 */
async function notifyGoalCompleted(goal, participants) {
  // Notify creator
  await notifyUser(
    goal.creatorId,
    '🏆 Goal Completed!',
    `Congratulations! Your goal "${goal.title}" has been verified. Check your wallet for your payout!`,
    { type: 'goal_completed', goalId: goal._id.toString() }
  );

  // Notify participants
  for (const participation of participants) {
    await notifyUser(
      participation.userId,
      '✅ Goal Completed',
      `The goal "${goal.title}" you supported has been completed!`,
      { type: 'goal_completed', goalId: goal._id.toString() }
    );
  }
}

/**
 * Notify all participants about goal failure
 */
async function notifyGoalFailed(goal, participants) {
  // Notify creator
  await notifyUser(
    goal.creatorId,
    '❌ Goal Failed',
    `Your goal "${goal.title}" was not completed by the deadline.`,
    { type: 'goal_failed', goalId: goal._id.toString() }
  );

  // Notify participants about their refund + bonus
  for (const participation of participants) {
    await notifyUser(
      participation.userId,
      '💰 Refund + Bonus',
      `The goal "${goal.title}" failed. Your contribution has been refunded plus a share of the seed money!`,
      { type: 'goal_failed', goalId: goal._id.toString() }
    );
  }
}

/**
 * Send deadline reminder notification
 */
async function notifyDeadlineReminder(goal, daysRemaining) {
  const dayText = daysRemaining === 1 ? 'day' : 'days';
  
  await notifyUser(
    goal.creatorId,
    '⏰ Deadline Reminder',
    `Your goal "${goal.title}" is due in ${daysRemaining} ${dayText}!`,
    { type: 'goal_deadline_reminder', goalId: goal._id.toString() }
  );
}

/**
 * Notify user about payment received
 */
async function notifyPaymentReceived(userId, amount, description) {
  await notifyUser(
    userId,
    '💵 Payment Received',
    `$${(amount / 100).toFixed(2)} has been added to your wallet. ${description}`,
    { type: 'payment_received' }
  );
}

/**
 * Notify user about verification result
 */
async function notifyVerificationResult(userId, goalTitle, verified, needsReview) {
  if (needsReview) {
    await notifyUser(
      userId,
      '⏳ Manual Review Required',
      `Your proof for "${goalTitle}" needs manual review. We'll update you within 24-48 hours.`,
      { type: 'verification_result' }
    );
  } else if (verified) {
    await notifyUser(
      userId,
      '✅ Verification Successful',
      `Your goal "${goalTitle}" has been verified!`,
      { type: 'verification_result' }
    );
  } else {
    await notifyUser(
      userId,
      '❌ Verification Failed',
      `Your proof for "${goalTitle}" could not be verified. You can try again with different proof.`,
      { type: 'verification_result' }
    );
  }
}

/**
 * Send progress reminder notification to a user
 * @param {string} userId - User ID to notify
 * @param {Object} goal - The goal object
 * @param {string} role - 'seeker' or 'participant'
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 */
async function notifyProgressReminder(userId, goal, role, title, body) {
  await notifyUser(
    userId,
    title,
    body,
    { 
      type: 'progress_reminder', 
      goalId: goal._id.toString(),
      role: role
    }
  );
}

module.exports = {
  sendPushNotification,
  notifyUser,
  notifyParticipantJoined,
  notifyGoalCompleted,
  notifyGoalFailed,
  notifyDeadlineReminder,
  notifyPaymentReceived,
  notifyVerificationResult,
  notifyProgressReminder,
};

