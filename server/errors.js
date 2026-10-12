export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
export const invalid = (message) => new AppError(400, 'INVALID_INPUT', message);
export const invalidOutput = () => new AppError(502, 'INVALID_AI_OUTPUT', 'The response was incomplete. Please try again.');
export const blocked = () => new AppError(422, 'CONTENT_BLOCKED', 'We could not use that content. Please choose another conversation topic.');
export function safeError(error) {
  if (error instanceof AppError) return error;
  if (['AbortError', 'TimeoutError', 'APIConnectionTimeoutError', 'APIUserAbortError'].includes(error?.name)) {
    return new AppError(504, 'UPSTREAM_TIMEOUT', 'That took too long. Please try again.');
  }
  if (error?.status === 429) return new AppError(503, 'PROVIDER_BUSY', 'The AI service is busy. Please try again later.');
  return new AppError(502, 'UPSTREAM_UNAVAILABLE', 'The AI service is unavailable. Please try again later.');
}
