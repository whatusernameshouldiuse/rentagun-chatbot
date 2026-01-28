import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from '@/types';

// Singleton client instance
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AnthropicError(
        'ANTHROPIC_API_KEY environment variable is not set',
        'missing_api_key'
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Custom error class for Anthropic-related errors
export class AnthropicError extends Error {
  code: string;

  constructor(message: string, code: string = 'anthropic_error') {
    super(message);
    this.name = 'AnthropicError';
    this.code = code;
  }
}

// Configuration constants
export const MODEL = 'claude-sonnet-4-20250514';
export const MAX_TOKENS = 1024;
export const TIMEOUT_MS = 30000;

interface StreamOptions {
  messages: ChatMessage[];
  systemPrompt: string;
  tools?: Anthropic.Tool[];
  onText?: (text: string) => void;
  onToolUse?: (toolUse: Anthropic.ToolUseBlock) => void;
  signal?: AbortSignal;
}

interface StreamResult {
  content: string;
  toolUses: Anthropic.ToolUseBlock[];
  stopReason: string | null;
}

/**
 * Create a streaming chat completion with Claude
 */
export async function createStreamingCompletion({
  messages,
  systemPrompt,
  tools,
  onText,
  onToolUse,
  signal,
}: StreamOptions): Promise<StreamResult> {
  const anthropic = getClient();

  // Convert our message format to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const stream = await anthropic.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: tools,
      },
      {
        signal,
      }
    );

    let fullContent = '';
    const toolUses: Anthropic.ToolUseBlock[] = [];
    let stopReason: string | null = null;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          onText?.(event.delta.text);
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          // Tool use will be completed in content_block_stop
        }
      } else if (event.type === 'message_delta') {
        if (event.delta.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
      }
    }

    // Get final message to extract complete tool uses
    const finalMessage = await stream.finalMessage();
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        toolUses.push(block);
        onToolUse?.(block);
      }
    }

    return {
      content: fullContent,
      toolUses,
      stopReason,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new AnthropicError('Request was cancelled', 'request_cancelled');
      }
      if (error.message.includes('timeout')) {
        throw new AnthropicError(
          'Request timed out. Please try again.',
          'timeout'
        );
      }
      if (error.message.includes('rate_limit')) {
        throw new AnthropicError(
          'Too many requests. Please wait a moment.',
          'rate_limit'
        );
      }
      if (error.message.includes('invalid_api_key')) {
        throw new AnthropicError(
          'Invalid API key configuration',
          'invalid_api_key'
        );
      }
    }
    throw new AnthropicError(
      'Failed to communicate with AI service',
      'api_error'
    );
  }
}

/**
 * Create a non-streaming chat completion (for simpler use cases)
 */
export async function createCompletion(
  messages: ChatMessage[],
  systemPrompt: string,
  tools?: Anthropic.Tool[]
): Promise<Anthropic.Message> {
  const anthropic = getClient();

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: tools,
    });

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        throw new AnthropicError(
          'Request timed out. Please try again.',
          'timeout'
        );
      }
    }
    throw new AnthropicError(
      'Failed to communicate with AI service',
      'api_error'
    );
  }
}

/**
 * Continue a conversation after tool use
 */
export async function continueWithToolResult(
  messages: ChatMessage[],
  systemPrompt: string,
  toolUseId: string,
  toolResult: unknown,
  tools?: Anthropic.Tool[]
): Promise<StreamResult> {
  const anthropic = getClient();

  // Build the message array with tool result
  const anthropicMessages: Anthropic.MessageParam[] = [
    ...messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: toolUseId,
          content: JSON.stringify(toolResult),
        },
      ],
    },
  ];

  try {
    const stream = await anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: tools,
    });

    let fullContent = '';
    const toolUses: Anthropic.ToolUseBlock[] = [];
    let stopReason: string | null = null;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
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
  } catch (error) {
    throw new AnthropicError(
      'Failed to process tool result',
      'tool_result_error'
    );
  }
}

/**
 * Create a readable stream for Server-Sent Events
 */
export function createSSEStream(
  messages: ChatMessage[],
  systemPrompt: string,
  tools?: Anthropic.Tool[]
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        await createStreamingCompletion({
          messages,
          systemPrompt,
          tools,
          onText: (text) => {
            const data = JSON.stringify({ type: 'text', content: text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
          onToolUse: (toolUse) => {
            const data = JSON.stringify({
              type: 'tool_use',
              tool: toolUse.name,
              input: toolUse.input,
              id: toolUse.id,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
        });

        controller.enqueue(encoder.encode(`data: {"type": "done"}\n\n`));
        controller.close();
      } catch (error) {
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
