import { NextRequest, NextResponse } from 'next/server';
import { createSSEStream, AnthropicError } from '@/lib/anthropic';
import { buildSystemPrompt } from '@/lib/prompts';
import { sanitizeMessages } from '@/lib/sanitize';
import { errorResponse, logError, sseError } from '@/lib/errors';
import type { ChatRequest } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 * Main chat endpoint with streaming response
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: ChatRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('invalid_request', 400);
    }

    // Validate messages
    if (!body.messages || !Array.isArray(body.messages)) {
      return errorResponse('invalid_request', 400);
    }

    // Sanitize messages
    const messages = sanitizeMessages(body.messages);

    if (messages.length === 0) {
      return errorResponse('empty_message', 400);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({ enableTools: false });

    // Create streaming response
    const stream = createSSEStream(messages, systemPrompt);

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logError('chat_endpoint', error);

    if (error instanceof AnthropicError) {
      // Return SSE error for streaming clients
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseError(error.code)));
          controller.close();
        },
      });

      return new NextResponse(errorStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return errorResponse('unknown', 500);
  }
}

/**
 * OPTIONS /api/chat
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    },
  });
}
