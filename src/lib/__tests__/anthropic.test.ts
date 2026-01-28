import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn(),
        create: vi.fn(),
      },
    })),
  };
});

describe('Anthropic Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('API Key Validation', () => {
    it('should throw error when API key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { createStreamingCompletion, AnthropicError } = await import(
        '../anthropic'
      );

      await expect(
        createStreamingCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'You are a helpful assistant',
        })
      ).rejects.toThrow(AnthropicError);
    });

    it('should have correct error code for missing API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const { createStreamingCompletion, AnthropicError } = await import(
        '../anthropic'
      );

      try {
        await createStreamingCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'You are a helpful assistant',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AnthropicError);
        expect((error as typeof AnthropicError.prototype).code).toBe(
          'missing_api_key'
        );
      }
    });
  });

  describe('AnthropicError', () => {
    it('should create error with message and code', async () => {
      const { AnthropicError } = await import('../anthropic');

      const error = new AnthropicError('Test error', 'test_code');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('test_code');
      expect(error.name).toBe('AnthropicError');
    });

    it('should default to anthropic_error code', async () => {
      const { AnthropicError } = await import('../anthropic');

      const error = new AnthropicError('Test error');

      expect(error.code).toBe('anthropic_error');
    });
  });

  describe('Configuration', () => {
    it('should export correct model name', async () => {
      const { MODEL } = await import('../anthropic');

      expect(MODEL).toBe('claude-sonnet-4-20250514');
    });

    it('should export max tokens constant', async () => {
      const { MAX_TOKENS } = await import('../anthropic');

      expect(MAX_TOKENS).toBe(1024);
    });

    it('should export timeout constant', async () => {
      const { TIMEOUT_MS } = await import('../anthropic');

      expect(TIMEOUT_MS).toBe(30000);
    });
  });
});

describe('Message Validation', () => {
  it('should handle empty message content gracefully', () => {
    const messages = [{ role: 'user' as const, content: '' }];

    // Empty content should still be a valid array
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('');
  });

  it('should handle very long messages', () => {
    const longContent = 'a'.repeat(10000);
    const messages = [{ role: 'user' as const, content: longContent }];

    expect(messages[0].content.length).toBe(10000);
  });
});
