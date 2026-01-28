import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  createStreamingCompletion,
  AnthropicError,
  MODEL,
  MAX_TOKENS,
} from '@/lib/anthropic';
import { buildSystemPrompt } from '@/lib/prompts';
import { sanitizeMessages } from '@/lib/sanitize';
import { errorResponse, logError, sseError } from '@/lib/errors';
import { tools, handleToolCall } from '@/lib/tools';
import type { ChatRequest, ChatMessage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Max tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 5;

/**
 * POST /api/chat
 * Main chat endpoint with streaming response and tool use
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

    // Build system prompt with tools enabled
    const systemPrompt = buildSystemPrompt({ enableTools: true });

    // Create streaming response with tool handling
    const stream = createChatStreamWithTools(messages, systemPrompt);

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
 * Create a streaming response that handles tool calls
 */
function createChatStreamWithTools(
  initialMessages: ChatMessage[],
  systemPrompt: string
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Build conversation history for Anthropic
        let conversationMessages: Anthropic.MessageParam[] = initialMessages.map(
          (msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })
        );

        let iterations = 0;

        // Agentic loop: keep processing until Claude stops using tools
        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          const result = await createStreamingCompletion({
            messages: initialMessages.slice(0, -1).concat([
              // Keep original history minus last message
              {
                role: initialMessages[initialMessages.length - 1].role,
                content: initialMessages[initialMessages.length - 1].content,
              },
            ]),
            systemPrompt,
            tools,
            onText: (text) => {
              const data = JSON.stringify({ type: 'text', content: text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
            onToolUse: (toolUse) => {
              // Notify client about tool use (optional, for UI feedback)
              const data = JSON.stringify({
                type: 'tool_start',
                tool: toolUse.name,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          // If no tool use, we're done
          if (result.toolUses.length === 0 || result.stopReason !== 'tool_use') {
            break;
          }

          // Process each tool call
          for (const toolUse of result.toolUses) {
            // Execute the tool
            const toolResult = await handleToolCall(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );

            // Send display result to client if available
            if (toolResult.display) {
              const data = JSON.stringify({
                type: 'tool_result',
                tool: toolUse.name,
                display: toolResult.display,
                data: toolResult.data,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Add assistant's tool use to conversation
            conversationMessages.push({
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolUse.id,
                  name: toolUse.name,
                  input: toolUse.input,
                },
              ],
            });

            // Add tool result to conversation
            conversationMessages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            });
          }

          // Continue with the updated conversation (for next iteration)
          const continueResult = await streamContinuation(
            conversationMessages,
            systemPrompt,
            controller,
            encoder
          );

          // If no more tool use, we're done
          if (
            continueResult.toolUses.length === 0 ||
            continueResult.stopReason !== 'tool_use'
          ) {
            break;
          }

          // Process any additional tool calls in the continuation
          for (const toolUse of continueResult.toolUses) {
            const toolResult = await handleToolCall(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );

            if (toolResult.display) {
              const data = JSON.stringify({
                type: 'tool_result',
                tool: toolUse.name,
                display: toolResult.display,
                data: toolResult.data,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            conversationMessages.push({
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolUse.id,
                  name: toolUse.name,
                  input: toolUse.input,
                },
              ],
            });

            conversationMessages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            });
          }
        }

        // Send done signal
        controller.enqueue(encoder.encode(`data: {"type": "done"}\n\n`));
        controller.close();
      } catch (error) {
        logError('chat_stream', error);
        const errorMessage =
          error instanceof AnthropicError
            ? error.message
            : 'An unexpected error occurred';
        const errorData = JSON.stringify({ type: 'error', message: errorMessage });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });
}

/**
 * Continue streaming after tool results
 */
async function streamContinuation(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<{
  content: string;
  toolUses: Anthropic.ToolUseBlock[];
  stopReason: string | null;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnthropicError('API key not configured', 'missing_api_key');
  }

  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
    tools,
  });

  let fullContent = '';
  const toolUses: Anthropic.ToolUseBlock[] = [];
  let stopReason: string | null = null;

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        const data = JSON.stringify({ type: 'text', content: event.delta.text });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }
    } else if (event.type === 'message_delta') {
      if (event.delta.stop_reason) {
        stopReason = event.delta.stop_reason;
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  for (const block of finalMessage.content) {
    if (block.type === 'tool_use') {
      toolUses.push(block);
    }
  }

  return {
    content: fullContent,
    toolUses,
    stopReason,
  };
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
