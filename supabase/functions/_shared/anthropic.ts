/**
 * Anthropic API client wrapper.
 *
 * Why: 4 functions called the Messages API with hand-rolled fetches,
 * inconsistent error handling, and a stale model name (claude-sonnet-4-20250514,
 * a 2025 release). This module:
 *  - centralises the model defaults (current: claude-sonnet-4-6)
 *  - applies a 60s timeout via AbortSignal
 *  - retries 5xx and 529 (overloaded) but not 4xx
 *  - maps known upstream errors to HttpError so the error handler returns
 *    the right status code without leaking raw API text.
 */

import { rateLimited, upstream } from './errors.ts';
import { withRetry, timeoutSignal } from './retry.ts';
import { requireEnv } from './env.ts';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_API_VERSION = '2023-06-01';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CallAnthropicParams {
  system?: string;
  messages: AnthropicMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Total request budget. Default 60 s. */
  timeoutMs?: number;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function callAnthropic(params: CallAnthropicParams): Promise<{ text: string; raw: AnthropicResponse }> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const body = {
    model: params.model ?? DEFAULT_ANTHROPIC_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature,
    system: params.system,
    messages: params.messages,
  };

  const raw = await withRetry(
    async () => {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: timeoutSignal(params.timeoutMs ?? 60_000),
      });
      if (res.ok) return (await res.json()) as AnthropicResponse;

      const text = await res.text().catch(() => '');
      if (res.status === 429) throw rateLimited('Anthropic rate limit exceeded');
      if (res.status === 529) throw upstream('Anthropic API is overloaded', 503);
      if (res.status >= 400 && res.status < 500) {
        throw upstream(`Anthropic ${res.status}: ${text.slice(0, 200)}`, 502);
      }
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
    },
    {
      attempts: 3,
      baseMs: 700,
      shouldRetry: (err) => {
        const msg = err instanceof Error ? err.message : '';
        // Retry transient 5xx; never retry 4xx (which were thrown as HttpError).
        return /^Anthropic [5]\d\d/.test(msg);
      },
    },
  );

  const text = raw.content?.find((p) => p.type === 'text')?.text ?? '';
  if (!text) throw upstream('Empty response from Anthropic');
  return { text, raw };
}
