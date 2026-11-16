export const anthropicJudgments = {
  sufficiency: 'sufficient',
  abstention: null,
  categories: [
    { id: 'job_posting', score: 0.98 },
    { id: 'referral', score: 0.95 },
  ],
};
export const anthropicMessage = (judgments: unknown = anthropicJudgments) => ({
  id: 'msg_synthetic',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(judgments) }],
  usage: { input_tokens: 100, output_tokens: 40 },
});
