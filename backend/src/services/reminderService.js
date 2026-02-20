const { Goal, GroupGoal, Participation, User } = require('../models');
const { notifyProgressReminder } = require('./notificationService');

/**
 * Calculate goal duration category based on start date and deadline
 * @param {Object} goal - The goal object
 * @returns {string} - 'weekly' (≤14 days), 'monthly' (15-60 days), or 'yearly' (>60 days)
 */
function calculateGoalDuration(goal) {
  const startDate = goal.startDate || goal.createdAt;
  const deadline = new Date(goal.deadline);
  const start = new Date(startDate);
  
  const durationMs = deadline.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  if (durationDays <= 14) {
    return 'weekly'; // Short-term goals: daily reminders
  } else if (durationDays <= 60) {
    return 'monthly'; // Medium-term goals: weekly reminders
  } else {
    return 'yearly'; // Long-term goals: monthly reminders
  }
}

/**
 * Get the effective reminder frequency for a goal
 * Priority: per-goal setting > user default > auto-determined from duration
 * @param {Object} goal - The goal object
 * @param {Object} user - The user object
 * @returns {string} - 'daily', 'weekly', or 'monthly'
 */
function getReminderFrequency(goal, user) {
  // Check per-goal override first
  if (goal.reminderSettings?.frequency) {
    return goal.reminderSettings.frequency;
  }
  
  // Check user default
  if (user?.reminderPreferences?.defaultFrequency) {
    return user.reminderPreferences.defaultFrequency;
  }
  
  // Auto-determine from goal duration
  const durationCategory = calculateGoalDuration(goal);
  switch (durationCategory) {
    case 'weekly':
      return 'daily';
    case 'monthly':
      return 'weekly';
    case 'yearly':
      return 'monthly';
    default:
      return 'daily';
  }
}

/**
 * Get the effective reminder time for a user
 * Priority: participation setting > goal setting > user default > system default
 * @param {Object} participation - Optional participation object
 * @param {Object} goal - The goal object
 * @param {Object} user - The user object
 * @returns {string} - HH:mm format time string
 */
function getReminderTime(participation, goal, user) {
  // Check participation-specific setting first (for participants)
  if (participation?.reminderTime) {
    return participation.reminderTime;
  }
  
  // Check per-goal setting
  if (goal.reminderSettings?.reminderTime) {
    return goal.reminderSettings.reminderTime;
  }
  
  // Check user default
  if (user?.reminderPreferences?.defaultReminderTime) {
    return user.reminderPreferences.defaultReminderTime;
  }
  
  // System default: 9:00 AM
  return '09:00';
}

/**
 * Check if the current time matches the reminder time window (within 1 hour)
 * @param {string} reminderTime - HH:mm format
 * @param {string} timezone - User timezone (optional)
 * @returns {boolean}
 */
function isReminderTimeWindow(reminderTime, timezone = null) {
  const now = new Date();
  const [targetHour, targetMinute] = reminderTime.split(':').map(Number);
  
  // Get current hour in user's timezone if provided
  let currentHour;
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone
      });
      currentHour = parseInt(formatter.format(now), 10);
    } catch (e) {
      currentHour = now.getHours();
    }
  } else {
    currentHour = now.getHours();
  }
  
  // Check if current hour matches target hour (within 1-hour window)
  return currentHour === targetHour;
}

/**
 * Check if a reminder was already sent today (date comparison)
 * @param {Date} lastReminderSent - Last reminder timestamp
 * @returns {boolean}
 */
function wasReminderSentToday(lastReminderSent) {
  if (!lastReminderSent) return false;
  
  const today = new Date();
  const lastSent = new Date(lastReminderSent);
  
  return today.toDateString() === lastSent.toDateString();
}

/**
 * Check if enough time has passed based on frequency
 * @param {Date} lastReminderSent - Last reminder timestamp
 * @param {string} frequency - 'daily', 'weekly', or 'monthly'
 * @returns {boolean}
 */
function isFrequencyIntervalPassed(lastReminderSent, frequency) {
  if (!lastReminderSent) return true;
  
  const now = new Date();
  const lastSent = new Date(lastReminderSent);
  const diffMs = now.getTime() - lastSent.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  switch (frequency) {
    case 'daily':
      return diffDays >= 1;
    case 'weekly':
      return diffDays >= 7;
    case 'monthly':
      return diffDays >= 30;
    default:
      return diffDays >= 1;
  }
}

/**
 * Check if a reminder should be sent to a user for a goal
 * @param {Object} goal - The goal object
 * @param {Object} user - The user object
 * @param {string} role - 'seeker' or 'participant'
 * @param {Object} participation - Optional participation object (for participants)
 * @returns {boolean}
 */
function shouldSendReminder(goal, user, role, participation = null) {
  // Check if goal is active
  if (goal.status !== 'active') {
    return false;
  }
  
  // Check if global reminders are enabled for user
  if (user?.reminderPreferences?.enabled === false) {
    return false;
  }
  
  // Check if goal-level reminders are enabled
  if (goal.reminderSettings?.enabled === false) {
    return false;
  }
  
  // For participants, check participation-level setting
  if (role === 'participant' && participation?.reminderEnabled === false) {
    return false;
  }
  
  // Get appropriate lastReminderSent based on role
  let lastReminderSent;
  if (role === 'participant' && participation) {
    lastReminderSent = participation.lastReminderSent;
  } else {
    lastReminderSent = goal.reminderSettings?.lastReminderSent;
  }
  
  // Check if reminder was already sent today (one per day constraint)
  if (wasReminderSentToday(lastReminderSent)) {
    return false;
  }
  
  // Check if frequency interval has passed
  const frequency = getReminderFrequency(goal, user);
  if (!isFrequencyIntervalPassed(lastReminderSent, frequency)) {
    return false;
  }
  
  // Check if current time matches reminder time window
  const reminderTime = getReminderTime(participation, goal, user);
  const timezone = user?.reminderPreferences?.timezone;
  if (!isReminderTimeWindow(reminderTime, timezone)) {
    return false;
  }
  
  return true;
}

/**
 * Generate contextual reminder message based on goal and role
 * @param {Object} goal - The goal object
 * @param {string} role - 'seeker' or 'participant'
 * @returns {Object} - { title, body }
 */
function generateReminderMessage(goal, role) {
  const now = new Date();
  const deadline = new Date(goal.deadline);
  const timeRemaining = deadline.getTime() - now.getTime();
  
  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
  const weeksRemaining = Math.ceil(daysRemaining / 7);
  const monthsRemaining = Math.ceil(daysRemaining / 30);
  
  const duration = calculateGoalDuration(goal);
  
  if (role === 'seeker') {
    // Messages for goal seekers
    if (duration === 'weekly') {
      // Short-term goal messages
      if (daysRemaining <= 1) {
        return {
          title: '⚡ Final Day!',
          body: `Today is the last day for "${goal.title}". You can do this!`
        };
      } else if (daysRemaining <= 3) {
        return {
          title: '🔥 Almost There!',
          body: `Only ${daysRemaining} days left for "${goal.title}". Keep pushing!`
        };
      } else {
        return {
          title: '💪 Keep Going!',
          body: `You have ${daysRemaining} days to complete "${goal.title}". You've got this!`
        };
      }
    } else if (duration === 'monthly') {
      // Medium-term goal messages
      if (weeksRemaining <= 1) {
        return {
          title: '⏰ Final Week!',
          body: `Less than a week left for "${goal.title}". Time to finish strong!`
        };
      } else {
        return {
          title: '📅 Weekly Check-in',
          body: `Don't forget about "${goal.title}". ${weeksRemaining} weeks remaining to achieve your goal!`
        };
      }
    } else {
      // Long-term goal messages
      if (monthsRemaining <= 1) {
        return {
          title: '🎯 Final Month!',
          body: `Less than a month left for "${goal.title}". Make it count!`
        };
      } else {
        return {
          title: '🌟 Progress Check',
          body: `Long-term progress check: "${goal.title}" - ${monthsRemaining} months to go. Stay consistent!`
        };
      }
    }
  } else {
    // Messages for participants
    const isGroupGoal = goal.goalType === 'group';
    
    if (isGroupGoal) {
      return {
        title: '👥 Group Goal Reminder',
        body: `Your group goal "${goal.title}" has ${daysRemaining} days remaining. Keep working together!`
      };
    } else {
      if (daysRemaining <= 3) {
        return {
          title: '🤝 Final Stretch Support',
          body: `The goal "${goal.title}" you're supporting has ${daysRemaining} days left. Send some encouragement!`
        };
      } else {
        return {
          title: '💫 Supporter Check-in',
          body: `The goal you're supporting "${goal.title}" has ${daysRemaining} days remaining. Cheer them on!`
        };
      }
    }
  }
}

/**
 * Send a progress reminder to a user for a goal
 * @param {Object} goal - The goal object
 * @param {string} userId - User ID
 * @param {string} role - 'seeker' or 'participant'
 * @param {Object} participation - Optional participation object
 */
async function sendProgressReminder(goal, userId, role, participation = null) {
  const message = generateReminderMessage(goal, role);
  
  await notifyProgressReminder(
    userId,
    goal,
    role,
    message.title,
    message.body
  );
  
  // Update lastReminderSent based on role
  if (role === 'participant' && participation) {
    participation.lastReminderSent = new Date();
    await participation.save();
  } else {
    if (!goal.reminderSettings) {
      goal.reminderSettings = {};
    }
    goal.reminderSettings.lastReminderSent = new Date();
    if (!goal.reminderSettings.reminderHistory) {
      goal.reminderSettings.reminderHistory = [];
    }
    goal.reminderSettings.reminderHistory.push(new Date());
    await goal.save();
  }
}

/**
 * Get the seeker user ID for a goal
 * @param {Object} goal - The goal object
 * @returns {string|null} - User ID of the seeker
 */
function getSeekerId(goal) {
  // For gift goals, the seeker is the person receiving the goal (seekerId)
  // For self goals, the seeker is the creator
  // For group goals, there's no single seeker (handled separately)
  if (goal.goalType === 'gift' && goal.seekerId) {
    return goal.seekerId.toString();
  }
  if (goal.goalType === 'self') {
    return goal.creatorId.toString();
  }
  return null;
}

/**
 * Main function to check and send reminders for all active goals
 * Called by cron job
 */
async function checkAndSendReminders() {
  try {
    console.log('Starting reminder check...');
    const now = new Date();
    
    // Find all active goals
    const activeGoals = await Goal.find({
      status: 'active',
      deadline: { $gt: now }
    }).populate('creatorId seekerId groupParticipantId');
    
    let remindersSent = 0;
    
    for (const goal of activeGoals) {
      try {
        if (goal.goalType === 'group') {
          // Group goal: all participants are seekers, send individual reminders
          const participations = await Participation.find({
            goalId: goal._id,
            status: 'active'
          }).populate('userId');
          
          for (const participation of participations) {
            const user = participation.userId;
            if (!user) continue;
            
            if (shouldSendReminder(goal, user, 'seeker', participation)) {
              await sendProgressReminder(goal, user._id, 'seeker', participation);
              remindersSent++;
              console.log(`Sent group goal reminder to ${user._id} for goal ${goal._id}`);
            }
          }
        } else {
          // Non-group goal: send to seeker and participants separately
          
          // Send to seeker
          const seekerId = getSeekerId(goal);
          if (seekerId) {
            const seeker = goal.seekerId || goal.creatorId;
            const seekerUser = typeof seeker === 'object' ? seeker : await User.findById(seekerId);
            
            if (seekerUser && shouldSendReminder(goal, seekerUser, 'seeker')) {
              await sendProgressReminder(goal, seekerId, 'seeker');
              remindersSent++;
              console.log(`Sent seeker reminder to ${seekerId} for goal ${goal._id}`);
            }
          }
          
          // Send to participants (excluding the seeker to avoid duplicates)
          const participations = await Participation.find({
            goalId: goal._id,
            status: 'active'
          }).populate('userId');
          
          for (const participation of participations) {
            const user = participation.userId;
            if (!user) continue;
            
            // Skip if this participant is the seeker (avoid double notification)
            if (seekerId && user._id.toString() === seekerId) {
              continue;
            }
            
            if (shouldSendReminder(goal, user, 'participant', participation)) {
              await sendProgressReminder(goal, user._id, 'participant', participation);
              remindersSent++;
              console.log(`Sent participant reminder to ${user._id} for goal ${goal._id}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing reminder for goal ${goal._id}:`, error);
      }
    }
    
    if (remindersSent > 0) {
      console.log(`Sent ${remindersSent} progress reminders`);
    }
    
    return remindersSent;
  } catch (error) {
    console.error('Error checking reminders:', error);
    throw error;
  }
}

module.exports = {
  calculateGoalDuration,
  getReminderFrequency,
  getReminderTime,
  shouldSendReminder,
  generateReminderMessage,
  sendProgressReminder,
  checkAndSendReminders,
  isReminderTimeWindow,
  wasReminderSentToday,
  isFrequencyIntervalPassed,
};


