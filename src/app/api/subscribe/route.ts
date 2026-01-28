/**
 * Subscribe API Endpoint
 * POST /api/subscribe - Handle email capture from chatbot widget
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { subscribeFromChatbot } from '@/lib/klaviyo';
import { extractInterests, summarizeForKlaviyo } from '@/lib/interests';
import type { ChatMessage } from '@/types';

// CORS headers for widget access
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://rentagun.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

interface SubscribeRequestBody {
  email: string;
  sessionId: string;
  source?: string;
  conversationHistory?: ChatMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SubscribeRequestBody = await request.json();
    const { email, sessionId, source = 'chatbot', conversationHistory = [] } = body;

    // Validate email
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_email',
          message: 'Email address is required.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_email',
          message: 'Please provide a valid email address.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_session',
          message: 'Session ID is required.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Extract interests from conversation
    const interests = extractInterests(conversationHistory);
    const conversationSummary = summarizeForKlaviyo(conversationHistory, interests);

    // Subscribe to Klaviyo
    const result = await subscribeFromChatbot({
      email: email.trim().toLowerCase(),
      sessionId,
      source,
      interests: {
        use_case: interests.use_case,
        categories: interests.categories,
        products_viewed: interests.products_viewed,
      },
      conversationSummary,
    });

    if (result.success) {
      console.log('[Subscribe API] Successfully subscribed:', email, interests);
      return NextResponse.json(
        {
          success: true,
          profileId: result.profileId,
          message: 'Successfully subscribed!',
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Klaviyo failed but don't break user experience
    console.error('[Subscribe API] Klaviyo error:', result.error);
    return NextResponse.json(
      {
        success: true, // Return success to user even if Klaviyo fails
        message: 'Thank you for your interest!',
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Subscribe API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: 'Something went wrong. Please try again.',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
