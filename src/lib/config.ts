// Tunables for the chat and contact endpoints. Model and daily cap can be overridden by env vars.
export const DEFAULT_MODEL = 'claude-haiku-5-5';
export const DEFAULT_DAILY_CHAT_LIMIT = 300; // all visitors combined, per UTC day

export const CHAT = {
  maxQuestionChars: 500,
  maxHistoryMessages: 6, // most recent turns sent to the model
  maxHistoryChars: 2000, // per earlier message
  maxOutputTokens: 1500, // includes any adaptive thinking
  perIp: { requests: 10, window: '10 m' as const },
  perIpDaily: { requests: 40, window: '1 d' as const },
};

export const CONTACT = {
  maxName: 100,
  maxEmail: 200,
  maxCompany: 100,
  maxMessage: 5000,
  minMessage: 10,
  perIp: { requests: 5, window: '1 h' as const },
};

export const LINKEDIN_PATH = 'linkedin.com/in/ziahasheem';
