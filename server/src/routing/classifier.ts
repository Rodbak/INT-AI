import type { TaskType } from '../types.js';

export function classifyRequest(message: string, conversationHistory: { role: string; content: string }[]): TaskType {
  const lower = message.toLowerCase();
  const historyText = conversationHistory.map((m) => m.content).join(' ').toLowerCase();

  const codeKeywords = [
    'function', 'class', 'const ', 'let ', 'var ', 'import ', 'export ', 'def ', 'async ', 'await ',
    'bug', 'error', 'exception', 'traceback', 'typescript', 'javascript', 'python', 'rust', 'go ',
    'api', 'endpoint', 'database', 'sql', 'query', 'git', 'commit', 'docker', 'kubernetes',
    'npm', 'yarn', 'pip', 'cargo', 'test', 'debug', 'compile', 'syntax',
  ];

  const analysisKeywords = [
    'analyze', 'analysis', 'compare', 'contrast', 'evaluate', 'assess', 'metrics', 'data',
    'report', 'statistics', 'trends', 'correlation', 'regression', 'insights',
  ];

  const creativeKeywords = [
    'write a story', 'poem', 'creative', 'imagine', 'brainstorm', 'brainstorming',
    'idea', 'concept', 'narrative', 'fiction', 'essay', 'article', 'blog post',
  ];

  const reasoningKeywords = [
    'why', 'because', 'reason', 'logic', 'prove', 'derive', 'conclusion', 'therefore',
    'thus', 'hypothesis', 'deduce', 'infer', 'argument', 'premise', 'step by step',
    'think through', 'solve this', 'riddle', 'puzzle',
  ];

  const combined = lower + ' ' + historyText;

  const codeScore = codeKeywords.filter((k) => combined.includes(k)).length;
  const analysisScore = analysisKeywords.filter((k) => combined.includes(k)).length;
  const creativeScore = creativeKeywords.filter((k) => combined.includes(k)).length;
  const reasoningScore = reasoningKeywords.filter((k) => combined.includes(k)).length;

  const scores = [
    { type: 'code' as TaskType, score: codeScore },
    { type: 'analysis' as TaskType, score: analysisScore },
    { type: 'creative' as TaskType, score: creativeScore },
    { type: 'reasoning' as TaskType, score: reasoningScore },
  ];

  const best = scores.reduce((a, b) => (a.score > b.score ? a : b));
  if (best.score > 0) return best.type;

  return 'chat';
}
