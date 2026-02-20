const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Evaluate a goal and determine if clarification is needed
 * @param {Object} goalData - The goal data to evaluate
 * @param {string} goalData.title - Goal title
 * @param {string} goalData.description - Goal description
 * @param {string} goalData.verificationCriteria - How the goal will be verified
 * @param {Array} previousClarifications - Previous Q&A pairs from the conversation
 * @returns {Object} Evaluation result with questions or confirmation
 */
async function evaluateGoal(goalData, previousClarifications = []) {
  try {
    const { title, description, verificationCriteria } = goalData;

    // Build context from previous clarifications
    const clarificationContext = previousClarifications.length > 0
      ? `\n\nPREVIOUS CLARIFICATIONS:\n${previousClarifications.map(c => 
          `Q: ${c.question}\nA: ${c.answer}`
        ).join('\n\n')}`
      : '';

    const systemPrompt = `You are an AI assistant that helps users define clear, measurable goals for a goal achievement app. 
Your job is to evaluate goal submissions and ensure the following 6 criteria are clearly understood:

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
- Include an "Other" option only when truly necessary

Respond with a JSON object in this exact format:
{
  "needsClarification": boolean,
  "question": {
    "id": "string (unique identifier)",
    "text": "string (the question to ask)",
    "options": [
      { "id": "string", "label": "string (option text)" }
    ]
  } | null,
  "summary": {
    "keyKPI": "string (extracted or inferred key metric)",
    "currentStatus": "string (starting point, may be 'Not specified - assuming starting fresh')",
    "targetKPI": "string (end goal metric)",
    "progressMeasurement": "string (how progress is tracked)",
    "successCriteria": "string (what defines success)",
    "failureCriteria": "string (what defines failure)",
    "proofMethod": "string (how proof will be submitted)"
  } | null
}

If needsClarification is true, include the question object and set summary to null.
If needsClarification is false, include the summary object and set question to null.`;

    const userPrompt = `Please evaluate this goal submission:

GOAL TITLE: ${title}
GOAL DESCRIPTION: ${description || 'No description provided'}
VERIFICATION CRITERIA: ${verificationCriteria || 'No specific criteria provided'}
${clarificationContext}

Analyze the goal and either:
1. Return a clarifying question if critical information is ambiguous
2. Return a complete summary if all 6 criteria can be reasonably determined`;

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

    if (result.needsClarification && !result.question) {
      throw new Error('Invalid AI response: needsClarification is true but no question provided');
    }

    if (!result.needsClarification && !result.summary) {
      throw new Error('Invalid AI response: needsClarification is false but no summary provided');
    }

    return {
      needsClarification: result.needsClarification,
      question: result.question || null,
      summary: result.summary || null,
      rawResponse: response.choices[0].message.content
    };

  } catch (error) {
    console.error('Goal evaluation error:', error);

    // Return a safe fallback that doesn't block goal creation
    return {
      needsClarification: false,
      question: null,
      summary: {
        keyKPI: 'Goal completion as described',
        currentStatus: 'Starting point not specified',
        targetKPI: goalData.title,
        progressMeasurement: 'Manual verification via proof submission',
        successCriteria: 'Goal completed as described and verified by AI',
        failureCriteria: 'Goal not completed by deadline',
        proofMethod: goalData.verificationCriteria || 'Photo/image submission'
      },
      error: error.message
    };
  }
}

/**
 * Generate a confirmation message with all goal details
 * @param {Object} summary - The extracted goal summary
 * @param {Object} goalData - Original goal data
 * @param {Array} clarifications - All clarifications collected
 * @returns {Object} Formatted confirmation data
 */
function generateConfirmation(summary, goalData, clarifications = []) {
  return {
    message: "I have got all details about the goal",
    goalDetails: {
      title: goalData.title,
      description: goalData.description || '',
      verificationCriteria: goalData.verificationCriteria || '',
      clarifications: clarifications.map(c => ({
        question: c.question,
        answer: c.answer,
        answeredAt: c.answeredAt || new Date()
      }))
    },
    evaluatedCriteria: summary
  };
}

module.exports = {
  evaluateGoal,
  generateConfirmation
};

