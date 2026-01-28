/**
 * Analytics tracking for chatbot events
 * Sends events to n8n webhook for processing
 */

const ANALYTICS_URL = process.env.ANALYTICS_WEBHOOK_URL;

export type AnalyticsEvent =
  | 'chat_opened'
  | 'message_sent'
  | 'product_viewed'
  | 'availability_checked'
  | 'booking_link_clicked'
  | 'order_looked_up'
  | 'escalation_requested'
  | 'email_captured'
  | 'email_skipped';

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  sessionId: string;
  timestamp: string;
  properties?: Record<string, unknown>;
}

/**
 * Track an analytics event
 * Non-blocking - failures are logged but don't affect user experience
 */
export async function trackEvent(
  event: AnalyticsEvent,
  sessionId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  // Skip if no analytics URL configured
  if (!ANALYTICS_URL) {
    console.log('[Analytics] No webhook URL configured, skipping:', event);
    return;
  }

  const payload: AnalyticsPayload = {
    event,
    sessionId,
    timestamp: new Date().toISOString(),
    properties,
  };

  try {
    // Fire and forget - don't await in production
    const response = await fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[Analytics] Failed to track event:', event, response.status);
    }
  } catch (error) {
    // Log but don't throw - analytics should never break the user experience
    console.error('[Analytics] Error tracking event:', event, error);
  }
}

/**
 * Track chat opened
 */
export function trackChatOpened(sessionId: string): Promise<void> {
  return trackEvent('chat_opened', sessionId);
}

/**
 * Track message sent
 */
export function trackMessageSent(
  sessionId: string,
  messageLength: number
): Promise<void> {
  return trackEvent('message_sent', sessionId, {
    message_length: messageLength,
  });
}

/**
 * Track product viewed
 */
export function trackProductViewed(
  sessionId: string,
  productIds: number[],
  searchQuery?: string
): Promise<void> {
  return trackEvent('product_viewed', sessionId, {
    product_ids: productIds,
    product_count: productIds.length,
    search_query: searchQuery,
  });
}

/**
 * Track availability checked
 */
export function trackAvailabilityChecked(
  sessionId: string,
  productId: number,
  available: boolean,
  dates: { start: string; end: string }
): Promise<void> {
  return trackEvent('availability_checked', sessionId, {
    product_id: productId,
    available,
    start_date: dates.start,
    end_date: dates.end,
  });
}

/**
 * Track booking link clicked
 */
export function trackBookingLinkClicked(
  sessionId: string,
  productId: number,
  productName: string
): Promise<void> {
  return trackEvent('booking_link_clicked', sessionId, {
    product_id: productId,
    product_name: productName,
  });
}

/**
 * Track order looked up
 */
export function trackOrderLookedUp(
  sessionId: string,
  orderNumber: string,
  found: boolean
): Promise<void> {
  return trackEvent('order_looked_up', sessionId, {
    order_number: orderNumber,
    found,
  });
}

/**
 * Track escalation requested
 */
export function trackEscalationRequested(
  sessionId: string,
  reason?: string
): Promise<void> {
  return trackEvent('escalation_requested', sessionId, {
    reason,
  });
}

/**
 * Track email captured
 */
export function trackEmailCaptured(sessionId: string, email: string): Promise<void> {
  return trackEvent('email_captured', sessionId, {
    email_domain: email.split('@')[1],
  });
}

/**
 * Track email skipped
 */
export function trackEmailSkipped(sessionId: string): Promise<void> {
  return trackEvent('email_skipped', sessionId);
}
