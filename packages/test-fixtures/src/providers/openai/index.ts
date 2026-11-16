export const openAIClassification = {
  sufficiency: 'sufficient',
  categories: [
    { id: 'job_posting', score: 0.96 },
    { id: 'referral', score: 0.94 },
  ],
  abstention: null,
};
export function openAIResponse(data: unknown = openAIClassification) {
  return {
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(data) }],
      },
    ],
    usage: { input_tokens: 120, output_tokens: 50 },
  };
}
