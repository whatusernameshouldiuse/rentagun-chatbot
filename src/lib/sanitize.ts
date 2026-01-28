/**
 * Input sanitization utilities
 */

const MAX_MESSAGE_LENGTH = 10000; // 10KB max
const MAX_MESSAGES = 50; // Max messages in conversation

/**
 * Sanitize a single message content
 */
export function sanitizeMessage(content: string): string {
  if (typeof content !== 'string') {
    return '';
  }

  // Truncate overly long messages
  let sanitized = content.slice(0, MAX_MESSAGE_LENGTH);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove potential script tags (basic XSS prevention)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove other potentially dangerous HTML
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  return sanitized.trim();
}

/**
 * Validate and sanitize the messages array
 */
export function sanitizeMessages(
  messages: unknown[]
): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  // Limit number of messages
  const limitedMessages = messages.slice(-MAX_MESSAGES);

  return limitedMessages
    .filter((msg): msg is { role: string; content: string } => {
      return (
        typeof msg === 'object' &&
        msg !== null &&
        'role' in msg &&
        'content' in msg &&
        typeof msg.role === 'string' &&
        typeof msg.content === 'string'
      );
    })
    .map((msg): { role: 'user' | 'assistant'; content: string } => ({
      role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: sanitizeMessage(msg.content),
    }))
    .filter((msg) => msg.content.length > 0);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize order number (alphanumeric only)
 */
export function sanitizeOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
}
