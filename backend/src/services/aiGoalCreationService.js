const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Assist users in creating a goal by asking sequential questions
 * @param {Array} conversationHistory - Previous Q&A pairs
 * @param {Object} collectedData - Data collected so far
 * @returns {Object} Next question or confirmation
 */
async function assistGoalCreation(conversationHistory = [], collectedData = {}) {
  try {
    // Build conversation context
    const conversationContext = conversationHistory.length > 0
      ? `\n\nCONVERSATION HISTORY:\n${conversationHistory.map((c, idx) => 
          `Q${idx + 1}: ${c.question}\nA${idx + 1}: ${c.answer}`
        ).join('\n\n')}`
      : '';

    // Determine what information is still needed
    const requiredFields = getRequiredFields(collectedData);
    const missingFields = requiredFields.filter(field => !collectedData[field.field]);

    // If all required fields are collected, return confirmation
    if (missingFields.length === 0) {
      return {
        status: 'ready',
        question: null,
        collectedData: collectedData,
        summary: generateSummary(collectedData)
      };
    }

    // Get the next question to ask
    const nextQuestion = getNextQuestion(missingFields, collectedData, conversationHistory);

    // Use AI to refine the question if needed, or use predefined questions
    const aiRefinedQuestion = await refineQuestionWithAI(
      nextQuestion,
      collectedData,
      conversationHistory
    );

    return {
      status: 'needs_info',
      question: aiRefinedQuestion,
      collectedData: collectedData
    };

  } catch (error) {
    console.error('Goal creation assistance error:', error);
    
    // Fallback to basic question
    const requiredFields = getRequiredFields(collectedData);
    const missingFields = requiredFields.filter(field => !collectedData[field.field]);
    
    if (missingFields.length === 0) {
      return {
        status: 'ready',
        question: null,
        collectedData: collectedData,
        summary: generateSummary(collectedData)
      };
    }

    const nextQuestion = getNextQuestion(missingFields, collectedData, conversationHistory);
    
    return {
      status: 'needs_info',
      question: nextQuestion,
      collectedData: collectedData,
      error: error.message
    };
  }
}

/**
 * Get required fields based on goal type
 */
function getRequiredFields(collectedData) {
  const baseFields = [
    { field: 'goalType', label: 'Goal Type', priority: 1 },
    { field: 'title', label: 'Goal Title', priority: 2 },
    { field: 'startDate', label: 'Start Date', priority: 3 },
    { field: 'deadline', label: 'Deadline', priority: 4 },
    { field: 'seedAmount', label: 'Seed Money', priority: 5 },
  ];

  // Add goal type specific fields
  if (collectedData.goalType === 'gift') {
    // Only ask for seekerEmail if it hasn't been answered yet (not set at all)
    // If it's an empty string, user already declined, so don't ask again
    if (collectedData.seekerEmail === undefined) {
      baseFields.push({ field: 'seekerEmail', label: 'Seeker Email (Optional)', priority: 6 });
    }
  }

  if (collectedData.goalType === 'group') {
    baseFields.push({ field: 'groupName', label: 'Group Name', priority: 6 });
    baseFields.push({ field: 'goalMode', label: 'Goal Mode', priority: 7 });
  }

  // Recurring goal fields
  if (collectedData.isRecurring) {
    if (!collectedData.recurrencePattern) {
      baseFields.push({ field: 'recurrencePattern', label: 'Recurrence Pattern', priority: 8 });
    }
    if (!collectedData.recurrenceEndDate) {
      baseFields.push({ field: 'recurrenceEndDate', label: 'Recurrence End Date', priority: 9 });
    }
  } else if (collectedData.goalType && !collectedData.isRecurring && collectedData.isRecurring === undefined) {
    // Ask about recurring if goal type is set but recurring status is not
    baseFields.push({ field: 'isRecurring', label: 'Is Recurring', priority: 7 });
  }

  // Optional fields (lower priority)
  // Only ask if not set yet (undefined). Empty string means user declined.
  if (collectedData.goalType && collectedData.description === undefined) {
    baseFields.push({ field: 'description', label: 'Description (Optional)', priority: 10 });
  }
  if (collectedData.goalType && collectedData.verificationCriteria === undefined) {
    baseFields.push({ field: 'verificationCriteria', label: 'Verification Criteria (Optional)', priority: 11 });
  }

  return baseFields.sort((a, b) => a.priority - b.priority);
}

/**
 * Get the next question to ask
 */
function getNextQuestion(missingFields, collectedData, conversationHistory) {
  const nextField = missingFields[0];

  switch (nextField.field) {
    case 'goalType':
      return {
        id: 'goal_type',
        text: 'Who is this goal for?',
        options: [
          { id: 'self', label: 'For myself' },
          { id: 'gift', label: 'For someone else (gift goal)' },
          { id: 'group', label: 'For a group' }
        ]
      };

    case 'title':
      return {
        id: 'title',
        text: 'What is the title of your goal? Please describe what you want to achieve.',
        options: null // Free text input
      };

    case 'description':
      return {
        id: 'description',
        text: 'Would you like to add a description to provide more details about your goal? (Optional)',
        options: [
          { id: 'yes', label: 'Yes, add a description' },
          { id: 'no', label: 'No, skip description' }
        ]
      };

    case 'startDate':
      return {
        id: 'startDate',
        text: 'When would you like to start this goal?',
        options: [
          { id: 'today', label: 'Today' },
          { id: 'tomorrow', label: 'Tomorrow' },
          { id: 'custom', label: 'Choose a specific date' }
        ]
      };

    case 'deadline':
      return {
        id: 'deadline',
        text: 'When is the deadline for this goal?',
        options: [
          { id: 'week', label: 'In 1 week' },
          { id: 'month', label: 'In 1 month' },
          { id: '3months', label: 'In 3 months' },
          { id: 'custom', label: 'Choose a specific date' }
        ]
      };

    case 'isRecurring':
      return {
        id: 'isRecurring',
        text: 'Would you like this to be a recurring goal? (Creates multiple goals that repeat on a schedule)',
        options: [
          { id: 'yes', label: 'Yes, make it recurring' },
          { id: 'no', label: 'No, single goal' }
        ]
      };

    case 'recurrencePattern':
      return {
        id: 'recurrencePattern',
        text: 'How often should this goal repeat?',
        options: [
          { id: 'daily', label: 'Daily' },
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' }
        ]
      };

    case 'recurrenceEndDate':
      return {
        id: 'recurrenceEndDate',
        text: 'When should the recurring goals end?',
        options: [
          { id: 'month', label: 'In 1 month' },
          { id: '3months', label: 'In 3 months' },
          { id: '6months', label: 'In 6 months' },
          { id: 'custom', label: 'Choose a specific date' }
        ]
      };

    case 'seedAmount':
      return {
        id: 'seedAmount',
        text: 'How much seed money would you like to commit? (Minimum $1)',
        options: [
          { id: '1', label: '$1' },
          { id: '5', label: '$5' },
          { id: '10', label: '$10' },
          { id: '25', label: '$25' },
          { id: '50', label: '$50' },
          { id: 'custom', label: 'Enter custom amount' }
        ]
      };

    case 'seekerEmail':
      return {
        id: 'seekerEmail',
        text: 'Would you like to specify the email of the person who will accept this goal? (Optional - if not provided, anyone with the link can accept)',
        options: [
          { id: 'yes', label: 'Yes, specify email' },
          { id: 'no', label: 'No, leave it open' }
        ]
      };

    case 'groupName':
      return {
        id: 'groupName',
        text: 'What would you like to name this group?',
        options: null // Free text input
      };

    case 'goalMode':
      return {
        id: 'goalMode',
        text: 'What type of group goal would you like?',
        options: [
          { id: 'common', label: 'Common Goal - Everyone works toward the same goal' },
          { id: 'individual', label: 'Individual Goals - Each person sets their own goal' }
        ]
      };

    case 'verificationCriteria':
      return {
        id: 'verificationCriteria',
        text: 'Would you like to specify verification criteria to help the AI verify goal completion? (Optional)',
        options: [
          { id: 'yes', label: 'Yes, add verification criteria' },
          { id: 'no', label: 'No, skip this' }
        ]
      };

    default:
      return {
        id: 'unknown',
        text: `Please provide information about: ${nextField.label}`,
        options: null
      };
  }
}

/**
 * Use AI to refine questions based on context
 */
async function refineQuestionWithAI(question, collectedData, conversationHistory) {
  try {
    // For simple questions with options, return as-is
    if (question.options && question.options.length > 0) {
      return question;
    }

    // For free text questions, use AI to make them more conversational
    const systemPrompt = `You are a helpful AI assistant that guides users through creating goals. 
Make your questions friendly, clear, and conversational. Keep questions concise.`;

    const userPrompt = `Based on the conversation so far, refine this question to be more helpful:
${question.text}

Collected data so far: ${JSON.stringify(collectedData, null, 2)}
${conversationHistory.length > 0 ? `\nPrevious conversation:\n${conversationHistory.map(c => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n')}` : ''}

Return only the refined question text, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const refinedText = response.choices[0].message.content.trim();
    
    return {
      ...question,
      text: refinedText
    };
  } catch (error) {
    console.error('Error refining question with AI:', error);
    return question; // Return original question if AI fails
  }
}

/**
 * Evaluate the goal title with AI to check if it's clear and specific
 * @param {string} title - The goal title provided by user
 * @param {string} goalType - The type of goal (self, gift, group)
 * @param {Array} conversationHistory - Previous Q&A pairs
 * @returns {Object} Evaluation result with question if clarification needed
 */
async function evaluateTitleWithAI(title, goalType, conversationHistory = []) {
  try {
    const systemPrompt = `You are an AI assistant helping users create clear, measurable goals for a goal achievement app.

Your job is to evaluate if a goal title is specific and measurable enough. A good goal should:
1. Be specific about what will be achieved
2. Have a measurable outcome (quantifiable when possible)
3. Be clear enough that someone could verify completion

EXAMPLES OF VAGUE GOALS (need clarification):
- "Be healthier" → Ask: What specifically? Lose weight? Exercise more? Eat better?
- "Get better at coding" → Ask: What skill? What level? Build a project?
- "Read more" → Ask: How many books? What type?
- "Save money" → Ask: How much? For what?
- "Be more productive" → Ask: In what area? How will you measure it?

EXAMPLES OF CLEAR GOALS (no clarification needed):
- "Lose 10 pounds"
- "Run a 5K marathon"
- "Read 12 books this year"
- "Save $5000 for emergency fund"
- "Complete a React course on Udemy"
- "Meditate for 10 minutes every day"

IMPORTANT RULES:
- If the goal is clear and measurable, set needsClarification to false
- If vague, provide 2-4 specific suggestions as options to help user clarify
- Always include an "Other" option for free text input
- Be encouraging and helpful, not critical

Respond with a JSON object:
{
  "needsClarification": boolean,
  "question": {
    "id": "title_clarification",
    "text": "string (friendly clarifying question)",
    "options": [
      { "id": "string", "label": "string (specific suggestion)" }
    ]
  } | null,
  "improvedTitle": "string (if you can infer a better title from context)" | null
}`;

    const userPrompt = `Evaluate this goal title:
GOAL TITLE: "${title}"
GOAL TYPE: ${goalType === 'self' ? 'For myself' : goalType === 'gift' ? 'For someone else' : 'Group goal'}

Previous conversation:
${conversationHistory.map(c => `Q: ${c.question}\nA: ${c.answer}`).join('\n\n') || 'None'}

Is this goal specific and measurable enough? If not, suggest clarifications.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    return {
      needsClarification: result.needsClarification || false,
      question: result.question || null,
      improvedTitle: result.improvedTitle || null
    };

  } catch (error) {
    console.error('Error evaluating title with AI:', error);
    // Don't block on error - assume title is fine
    return {
      needsClarification: false,
      question: null,
      improvedTitle: null
    };
  }
}

/**
 * Run final 6-criteria evaluation on the goal before confirmation
 * Similar to aiGoalEvaluationService but integrated into creation flow
 * @param {Object} collectedData - All collected goal data
 * @param {Array} clarifications - Clarifications collected so far
 * @returns {Object} Evaluation result with question if more info needed
 */
async function evaluateGoalWithAI(collectedData, clarifications = []) {
  try {
    const { title, description, verificationCriteria } = collectedData;

    // Build context from clarifications
    const clarificationContext = clarifications.length > 0
      ? `\n\nPREVIOUS CLARIFICATIONS:\n${clarifications.map(c => 
          `Q: ${c.question}\nA: ${c.answer}`
        ).join('\n\n')}`
      : '';

    const systemPrompt = `You are an AI assistant that helps users define clear, measurable goals for a goal achievement app.

Your job is to ensure the following 6 criteria are clearly understood before finalizing the goal:

1. KEY EVALUATION CRITERIA/KPI: What is the main metric or indicator that determines goal progress?
2. CURRENT STATUS: What is the user's starting point for this KPI?
3. END KPI: What specific target value or state must be achieved for success?
4. PROGRESS MEASUREMENT: How will incremental progress toward the goal be tracked?
5. SUCCESS/FAILURE CRITERIA: What specific conditions define success vs failure?
6. PROOF SUBMISSION: How will the user submit evidence of completion (photo, data, etc.)?

IMPORTANT RULES:
- If you can reasonably infer information from context, DO NOT ask about it
- Only ask questions when there is genuine ambiguity that affects verification
- Ask ONE question at a time (the most critical one)
- Provide 2-4 clear, mutually exclusive options for each question
- Options should cover the most likely interpretations
- Always include an "Other" option for custom input

Respond with a JSON object:
{
  "needsClarification": boolean,
  "question": {
    "id": "eval_[criteria_name]",
    "text": "string (the question to ask)",
    "options": [
      { "id": "string", "label": "string (option text)" }
    ]
  } | null,
  "evaluatedCriteria": {
    "keyKPI": "string (extracted or inferred key metric)",
    "currentStatus": "string (starting point)",
    "targetKPI": "string (end goal metric)",
    "progressMeasurement": "string (how progress is tracked)",
    "successCriteria": "string (what defines success)",
    "failureCriteria": "string (what defines failure)",
    "proofMethod": "string (how proof will be submitted)"
  } | null
}

If needsClarification is true, include the question and set evaluatedCriteria to null.
If needsClarification is false, include evaluatedCriteria and set question to null.`;

    const userPrompt = `Please evaluate this goal:

GOAL TITLE: ${title}
GOAL DESCRIPTION: ${description || 'No description provided'}
VERIFICATION CRITERIA: ${verificationCriteria || 'No specific criteria provided'}
${clarificationContext}

Analyze the goal and either:
1. Return a clarifying question if critical information is ambiguous
2. Return complete evaluated criteria if all 6 points can be reasonably determined`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Validate response structure
    if (typeof result.needsClarification !== 'boolean') {
      throw new Error('Invalid AI response: missing needsClarification');
    }

    return {
      needsClarification: result.needsClarification,
      question: result.question || null,
      evaluatedCriteria: result.evaluatedCriteria || null
    };

  } catch (error) {
    console.error('Goal evaluation error:', error);

    // Return a safe fallback that doesn't block goal creation
    return {
      needsClarification: false,
      question: null,
      evaluatedCriteria: {
        keyKPI: 'Goal completion as described',
        currentStatus: 'Starting point not specified',
        targetKPI: collectedData.title,
        progressMeasurement: 'Manual verification via proof submission',
        successCriteria: 'Goal completed as described and verified by AI',
        failureCriteria: 'Goal not completed by deadline',
        proofMethod: collectedData.verificationCriteria || 'Photo/image submission'
      }
    };
  }
}

/**
 * Generate a summary of collected data
 */
function generateSummary(collectedData) {
  const summary = {
    goalType: collectedData.goalType || 'self',
    title: collectedData.title || '',
    description: collectedData.description || '',
    startDate: collectedData.startDate || '',
    deadline: collectedData.deadline || '',
    seedAmount: collectedData.seedAmount || 0,
    verificationCriteria: collectedData.verificationCriteria || '',
    isRecurring: collectedData.isRecurring || false,
  };

  if (collectedData.goalType === 'gift') {
    summary.seekerEmail = collectedData.seekerEmail || '';
  }

  if (collectedData.goalType === 'group') {
    summary.groupName = collectedData.groupName || '';
    summary.goalMode = collectedData.goalMode || 'common';
  }

  if (collectedData.isRecurring) {
    summary.recurrencePattern = collectedData.recurrencePattern || '';
    summary.recurrenceEndDate = collectedData.recurrenceEndDate || '';
  }

  return summary;
}

module.exports = {
  assistGoalCreation,
  generateSummary,
  evaluateTitleWithAI,
  evaluateGoalWithAI
};

