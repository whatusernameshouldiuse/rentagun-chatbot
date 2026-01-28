/**
 * Klaviyo API Client
 * Handles email subscriptions, profile tagging, and event tracking
 */

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;
const KLAVIYO_REVISION = '2024-10-15';

const KLAVIYO_BASE_URL = 'https://a.klaviyo.com/api';

interface KlaviyoProfile {
  email: string;
  first_name?: string;
  last_name?: string;
  properties?: Record<string, unknown>;
}

interface KlaviyoEvent {
  event: string;
  email: string;
  properties?: Record<string, unknown>;
  time?: string;
}

export interface SubscribeOptions {
  email: string;
  sessionId: string;
  source?: string;
  interests?: {
    use_case?: string;
    categories?: string[];
    products_viewed?: string[];
  };
  conversationSummary?: string;
}

export interface KlaviyoResult {
  success: boolean;
  profileId?: string;
  error?: string;
}

/**
 * Make authenticated request to Klaviyo API
 */
async function klaviyoRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'POST',
  body?: Record<string, unknown>
): Promise<Response> {
  if (!KLAVIYO_API_KEY) {
    throw new Error('KLAVIYO_API_KEY not configured');
  }

  const response = await fetch(`${KLAVIYO_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      'Content-Type': 'application/json',
      revision: KLAVIYO_REVISION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

/**
 * Create or update a profile in Klaviyo
 */
export async function getOrCreateProfile(
  profile: KlaviyoProfile
): Promise<{ id: string } | null> {
  try {
    const response = await klaviyoRequest('/profiles/', 'POST', {
      data: {
        type: 'profile',
        attributes: {
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          properties: profile.properties,
        },
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { id: data.data.id };
    }

    // Handle duplicate - try to find existing profile
    if (response.status === 409) {
      // Get profile by email
      const searchResponse = await klaviyoRequest(
        `/profiles/?filter=equals(email,"${encodeURIComponent(profile.email)}")`,
        'GET'
      );
      if (searchResponse.ok) {
        const data = await searchResponse.json();
        if (data.data && data.data.length > 0) {
          return { id: data.data[0].id };
        }
      }
    }

    console.error('[Klaviyo] Failed to create profile:', response.status);
    return null;
  } catch (error) {
    console.error('[Klaviyo] Error creating profile:', error);
    return null;
  }
}

/**
 * Subscribe email to the chatbot leads list
 */
export async function subscribeToList(
  email: string,
  properties?: Record<string, unknown>
): Promise<KlaviyoResult> {
  if (!KLAVIYO_LIST_ID) {
    console.warn('[Klaviyo] KLAVIYO_LIST_ID not configured, skipping list subscription');
    return { success: false, error: 'List ID not configured' };
  }

  try {
    const response = await klaviyoRequest('/list-subscriptions/', 'POST', {
      data: {
        type: 'list-subscription',
        attributes: {
          list_id: KLAVIYO_LIST_ID,
          email: email,
          subscribed: true,
          custom_source: 'chatbot',
        },
        relationships: {
          list: {
            data: {
              type: 'list',
              id: KLAVIYO_LIST_ID,
            },
          },
        },
      },
    });

    if (response.ok || response.status === 202) {
      console.log('[Klaviyo] Subscribed to list:', email);
      return { success: true };
    }

    const errorData = await response.text();
    console.error('[Klaviyo] Failed to subscribe to list:', errorData);
    return { success: false, error: 'Failed to subscribe' };
  } catch (error) {
    console.error('[Klaviyo] Error subscribing to list:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Add tags to a profile
 */
export async function addProfileTags(
  profileId: string,
  tags: string[]
): Promise<boolean> {
  if (tags.length === 0) return true;

  try {
    // Klaviyo doesn't have direct tag support in the same way
    // We use profile properties with a tags array
    const response = await klaviyoRequest(`/profiles/${profileId}/`, 'PATCH', {
      data: {
        type: 'profile',
        id: profileId,
        attributes: {
          properties: {
            chatbot_tags: tags,
          },
        },
      },
    });

    if (response.ok) {
      console.log('[Klaviyo] Added tags to profile:', tags);
      return true;
    }

    console.error('[Klaviyo] Failed to add tags:', response.status);
    return false;
  } catch (error) {
    console.error('[Klaviyo] Error adding tags:', error);
    return false;
  }
}

/**
 * Set custom properties on a profile
 */
export async function setProfileProperties(
  profileId: string,
  properties: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await klaviyoRequest(`/profiles/${profileId}/`, 'PATCH', {
      data: {
        type: 'profile',
        id: profileId,
        attributes: {
          properties,
        },
      },
    });

    if (response.ok) {
      console.log('[Klaviyo] Set profile properties');
      return true;
    }

    console.error('[Klaviyo] Failed to set properties:', response.status);
    return false;
  } catch (error) {
    console.error('[Klaviyo] Error setting properties:', error);
    return false;
  }
}

/**
 * Track a custom event
 */
export async function trackEvent(event: KlaviyoEvent): Promise<boolean> {
  try {
    const response = await klaviyoRequest('/events/', 'POST', {
      data: {
        type: 'event',
        attributes: {
          metric: {
            data: {
              type: 'metric',
              attributes: {
                name: event.event,
              },
            },
          },
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: event.email,
              },
            },
          },
          properties: event.properties || {},
          time: event.time || new Date().toISOString(),
        },
      },
    });

    if (response.ok || response.status === 202) {
      console.log('[Klaviyo] Tracked event:', event.event);
      return true;
    }

    console.error('[Klaviyo] Failed to track event:', response.status);
    return false;
  } catch (error) {
    console.error('[Klaviyo] Error tracking event:', error);
    return false;
  }
}

/**
 * Full subscribe flow: create profile, add to list, set properties, track event
 */
export async function subscribeFromChatbot(
  options: SubscribeOptions
): Promise<KlaviyoResult> {
  const { email, sessionId, source = 'chatbot', interests, conversationSummary } = options;

  // Build tags from interests
  const tags: string[] = [`source:${source}`];

  if (interests?.use_case) {
    tags.push(`interest:${interests.use_case}`);
  }

  if (interests?.categories) {
    interests.categories.forEach((cat) => {
      tags.push(`category:${cat}`);
    });
  }

  // Build profile properties
  const properties: Record<string, unknown> = {
    chatbot_source: source,
    chatbot_session_id: sessionId,
    chatbot_first_interaction: new Date().toISOString(),
    chatbot_tags: tags,
  };

  if (interests?.use_case) {
    properties.chatbot_use_case = interests.use_case;
  }

  if (interests?.categories && interests.categories.length > 0) {
    properties.chatbot_categories_interested = interests.categories.join(', ');
  }

  if (interests?.products_viewed && interests.products_viewed.length > 0) {
    properties.chatbot_products_viewed = interests.products_viewed.join(', ');
  }

  if (conversationSummary) {
    properties.chatbot_conversation_summary = conversationSummary;
  }

  // Step 1: Create or get profile
  const profile = await getOrCreateProfile({
    email,
    properties,
  });

  if (!profile) {
    return { success: false, error: 'Failed to create profile' };
  }

  // Step 2: Subscribe to list
  await subscribeToList(email);

  // Step 3: Track email captured event
  await trackEvent({
    event: 'Chatbot Email Captured',
    email,
    properties: {
      session_id: sessionId,
      source,
      use_case: interests?.use_case,
      categories: interests?.categories,
      products_viewed: interests?.products_viewed,
    },
  });

  return {
    success: true,
    profileId: profile.id,
  };
}

/**
 * Track chatbot-specific events
 */
export async function trackChatbotEvent(
  email: string,
  eventName: 'Chatbot Product Search' | 'Chatbot Availability Check' | 'Chatbot Booking Link Clicked',
  properties?: Record<string, unknown>
): Promise<boolean> {
  return trackEvent({
    event: eventName,
    email,
    properties,
  });
}
