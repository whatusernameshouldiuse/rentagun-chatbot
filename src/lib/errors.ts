import { NextResponse } from 'next/server';

/**
 * User-friendly error messages
 * Maps internal error codes to customer-facing messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // API errors
  missing_api_key: "I'm having trouble connecting. Please try again in a moment.",
  invalid_api_key: "I'm having trouble connecting. Please try again in a moment.",
  api_error: "I'm having trouble right now. Please try again.",
  timeout: 'That took too long. Please try again.',
  rate_limit: "I'm getting a lot of questions right now. Please wait a moment.",

  // Request errors
  invalid_request: "I didn't understand that request. Could you try again?",
  empty_message: 'Please type a message and try again.',
  message_too_long: 'That message is too long. Please shorten it and try again.',

  // Order lookup errors
  order_not_found: "I couldn't find that order. Please check the order number and email.",
  invalid_email: 'Please provide a valid email address.',

  // Product errors
  product_not_found: "I couldn't find that product in our inventory.",
  availability_error: "I couldn't check availability right now. Please try again.",

  // Generic
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Get user-friendly error message
 */
export function getUserMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.unknown;
}

/**
 * Create a JSON error response
 */
export function errorResponse(
  code: string,
  status: number = 500
): NextResponse {
  return NextResponse.json(
    {
      error: true,
      code,
      message: getUserMessage(code),
    },
    { status }
  );
}

/**
 * Create an SSE error event
 */
export function sseError(code: string): string {
  const message = getUserMessage(code);
  return `data: ${JSON.stringify({ type: 'error', message })}\n\n`;
}

/**
 * Log error for monitoring (doesn't expose to user)
 */
export function logError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>
): void {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    ...meta,
  };

  // In production, this would go to a logging service
  console.error('[Rentagun Chatbot Error]', JSON.stringify(errorInfo));
}
