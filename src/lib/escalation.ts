/**
 * Human escalation handling
 * Sends notification to support team when user requests human help
 */

import type { ChatMessage } from '@/types';

const ESCALATION_WEBHOOK_URL = process.env.ESCALATION_WEBHOOK_URL;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rentagun.com';

export interface EscalationRequest {
  sessionId: string;
  email?: string;
  conversationHistory: ChatMessage[];
  reason?: string;
  context?: {
    productId?: number;
    productName?: string;
    orderId?: string;
    currentPage?: string;
  };
}

export interface EscalationResult {
  success: boolean;
  ticketId?: string;
  message: string;
}

/**
 * Detect if user wants to talk to a human
 */
export function detectEscalationIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const escalationPhrases = [
    'talk to human',
    'talk to a human',
    'speak to human',
    'speak to a human',
    'speak with human',
    'speak with a human',
    'real person',
    'human please',
    'agent please',
    'talk to agent',
    'talk to an agent',
    'customer service',
    'customer support',
    'support please',
    'help me please',
    'i need help',
    'this is frustrating',
    'frustrated',
    'not helpful',
    'escalate',
    'manager',
    'supervisor',
  ];

  return escalationPhrases.some((phrase) => lowerMessage.includes(phrase));
}

/**
 * Send escalation notification to support team
 */
export async function escalateToHuman(
  request: EscalationRequest
): Promise<EscalationResult> {
  // Generate a simple ticket ID
  const ticketId = `ESC-${Date.now().toString(36).toUpperCase()}`;

  // Format conversation for email
  const conversationText = request.conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'Customer' : 'Bot'}: ${msg.content}`)
    .join('\n\n');

  const payload = {
    ticketId,
    timestamp: new Date().toISOString(),
    sessionId: request.sessionId,
    customerEmail: request.email || 'Not provided',
    reason: request.reason || 'Customer requested human assistance',
    context: request.context || {},
    conversationHistory: conversationText,
    conversationMessages: request.conversationHistory,
  };

  // Try webhook first (for n8n automation)
  if (ESCALATION_WEBHOOK_URL) {
    try {
      const response = await fetch(ESCALATION_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('[Escalation] Notification sent via webhook:', ticketId);
        return {
          success: true,
          ticketId,
          message: `I've notified our support team. They'll reach out to you soon. Your reference number is ${ticketId}.`,
        };
      }
    } catch (error) {
      console.error('[Escalation] Webhook failed:', error);
      // Fall through to backup method
    }
  }

  // Log for manual follow-up if webhook fails
  console.log('[Escalation] Manual follow-up needed:', JSON.stringify(payload));

  return {
    success: true,
    ticketId,
    message: `I've noted your request for human assistance. Our team will follow up with you soon. Your reference number is ${ticketId}.`,
  };
}

/**
 * Get escalation response message for the bot
 */
export function getEscalationResponse(result: EscalationResult): string {
  if (result.success) {
    return result.message;
  }

  return `I apologize, but I'm having trouble connecting you with our support team right now. Please email us directly at ${SUPPORT_EMAIL} and we'll help you as soon as possible.`;
}

/**
 * Format conversation summary for escalation
 */
export function summarizeConversation(messages: ChatMessage[]): string {
  // Get last 5 exchanges for context
  const recentMessages = messages.slice(-10);

  // Extract key topics mentioned
  const topics: string[] = [];

  const keywords = {
    'product search': ['looking for', 'show me', 'browse', 'search'],
    availability: ['available', 'availability', 'dates', 'when can'],
    order: ['order', 'tracking', 'shipment', 'delivery'],
    pricing: ['cost', 'price', 'how much', 'rate'],
    ffl: ['ffl', 'pickup', 'location', 'dealer'],
    returns: ['return', 'send back', 'ship back'],
  };

  for (const [topic, patterns] of Object.entries(keywords)) {
    for (const msg of recentMessages) {
      const lowerContent = msg.content.toLowerCase();
      if (patterns.some((p) => lowerContent.includes(p))) {
        if (!topics.includes(topic)) {
          topics.push(topic);
        }
        break;
      }
    }
  }

  return topics.length > 0
    ? `Topics discussed: ${topics.join(', ')}`
    : 'General inquiry';
}
