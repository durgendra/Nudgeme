const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Verify goal completion using AI vision analysis
 * Returns a three-tier result: not_related, progress, or completed
 * @param {Object} goal - The goal object
 * @param {string} imageBase64 - Base64 encoded image (optional)
 * @param {string} mimeType - Image MIME type (optional)
 * @param {Object} proofData - Additional proof data (for non-image verification)
 * @param {string} proofText - Text-based proof description (optional)
 * @param {Array} attachments - Additional attachments (optional)
 * @returns {Object} Verification result with verificationStatus, confidence, and reasoning
 */
async function verifyGoalWithAI(goal, imageBase64, mimeType, proofData, proofText = null, attachments = []) {
  try {
    // Build context from goal clarifications and evaluated criteria
    let goalContext = '';
    
    if (goal.clarifications && goal.clarifications.length > 0) {
      goalContext += '\nCLARIFICATIONS:\n';
      goal.clarifications.forEach((c, i) => {
        goalContext += `- Q: ${c.question}\n  A: ${c.answer}\n`;
      });
    }
    
    if (goal.evaluatedCriteria) {
      const ec = goal.evaluatedCriteria;
      goalContext += '\nEVALUATED CRITERIA:\n';
      if (ec.keyKPI) goalContext += `- Key KPI: ${ec.keyKPI}\n`;
      if (ec.currentStatus) goalContext += `- Starting Status: ${ec.currentStatus}\n`;
      if (ec.targetKPI) goalContext += `- Target KPI: ${ec.targetKPI}\n`;
      if (ec.progressMeasurement) goalContext += `- How to Measure Progress: ${ec.progressMeasurement}\n`;
      if (ec.successCriteria) goalContext += `- Success Criteria: ${ec.successCriteria}\n`;
      if (ec.failureCriteria) goalContext += `- Failure Criteria: ${ec.failureCriteria}\n`;
      if (ec.proofMethod) goalContext += `- Expected Proof Method: ${ec.proofMethod}\n`;
    }

    // Build the verification prompt
    const systemPrompt = `You are an AI verification assistant for a goal achievement app. 
Your job is to analyze submitted proof (images, text, or data) and categorize the user's progress.

You must categorize the submission into ONE of these three categories:

1. "not_related" - The proof is NOT related to the goal at all. Examples:
   - Submitting a photo of food for a fitness goal
   - Text that discusses something completely unrelated
   - Wrong type of content entirely

2. "progress" - The proof shows GOOD PROGRESS toward the goal, but the goal is NOT yet fully completed. Examples:
   - Partial completion (e.g., read 5 of 10 chapters)
   - Evidence of working on the goal but not finished
   - Intermediate milestones achieved

3. "completed" - The proof clearly shows the goal has been FULLY COMPLETED. Examples:
   - Clear evidence of achieving the stated objective
   - Meeting or exceeding all success criteria
   - Definitive proof of completion

Be fair but thorough in your analysis. Consider:
1. Does the proof relate to the goal at all?
2. Does it show meaningful progress?
3. Does it demonstrate full completion based on the criteria?

You must respond with a JSON object containing:
- verificationStatus: string ("not_related", "progress", or "completed")
- verified: boolean (true only if status is "completed")
- confidence: number (0-100, your confidence in the assessment)
- reasoning: string (brief, encouraging explanation of your decision and what the user could do next if not completed)`;

    const userPrompt = `Please evaluate this goal submission:

GOAL TITLE: ${goal.title}
GOAL DESCRIPTION: ${goal.description || 'Not provided'}
VERIFICATION CRITERIA: ${goal.verificationCriteria || 'No specific criteria provided'}
DEADLINE: ${goal.deadline}
${goalContext}

${proofText ? `USER'S TEXT SUBMISSION:\n${proofText}\n` : ''}
${proofData ? `ADDITIONAL PROOF DATA: ${JSON.stringify(proofData)}` : ''}
${attachments && attachments.length > 0 ? `ATTACHMENTS: ${attachments.map(a => `${a.type}: ${a.name || a.url}`).join(', ')}` : ''}

Analyze the provided proof and categorize it as "not_related", "progress", or "completed". Be specific about what you observe and how it relates to the goal.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [] }
    ];

    // Add text content
    messages[1].content.push({ type: 'text', text: userPrompt });

    // Add image if provided
    if (imageBase64 && mimeType) {
      messages[1].content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: 'high'
        }
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Normalize the verification status
    const validStatuses = ['not_related', 'progress', 'completed'];
    const verificationStatus = validStatuses.includes(result.verificationStatus) 
      ? result.verificationStatus 
      : 'progress'; // Default to progress if unclear

    return {
      verified: verificationStatus === 'completed',
      verificationStatus,
      confidence: Math.min(100, Math.max(0, parseInt(result.confidence) || 50)),
      reasoning: result.reasoning || 'No reasoning provided',
      rawResponse: response.choices[0].message.content
    };
  } catch (error) {
    console.error('AI verification error:', error);

    // Return low confidence result on error
    return {
      verified: false,
      verificationStatus: 'progress',
      confidence: 0,
      reasoning: 'AI verification encountered an issue - your submission has been recorded and may require manual review.',
      error: error.message
    };
  }
}

/**
 * Fallback verification when OpenAI is unavailable
 */
function fallbackVerification() {
  return {
    verified: false,
    verificationStatus: 'progress',
    confidence: 0,
    reasoning: 'AI service unavailable - your submission has been recorded and may require manual review.'
  };
}

/**
 * Generate AI response message based on verification status
 * @param {Object} aiResult - The AI verification result
 * @returns {string} A friendly message to display in the chat
 */
function generateAIResponseMessage(aiResult) {
  const { verificationStatus, reasoning, confidence } = aiResult;
  
  let emoji, statusText;
  
  switch (verificationStatus) {
    case 'completed':
      emoji = '🎉';
      statusText = 'Goal Completed!';
      break;
    case 'progress':
      emoji = '📈';
      statusText = 'Good Progress!';
      break;
    case 'not_related':
      emoji = '🤔';
      statusText = 'Hmm, let me explain...';
      break;
    default:
      emoji = '📝';
      statusText = 'Submission Received';
  }
  
  return `${emoji} **${statusText}**\n\n${reasoning}${confidence >= 80 ? '' : '\n\n_Note: I\'m not fully confident in this assessment. Feel free to submit additional proof!_'}`;
}

module.exports = {
  verifyGoalWithAI,
  fallbackVerification,
  generateAIResponseMessage
};

