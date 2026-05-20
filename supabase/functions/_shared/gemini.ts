/**
 * Google Gemini wrapper using the OpenAI-compatible chat-completions endpoint.
 *
 * Why: 4+ functions called this endpoint inline with no timeout, inconsistent
 * error mapping, and ad-hoc JSON-mode handling. This module centralises the
 * default model (gemini-2.5-flash), applies a request timeout, and maps
 * known errors (402 payment-required, 429 rate-limit) to HttpError.
 */

import { rateLimited, upstream } from './errors.ts';
import { withRetry, timeoutSignal } from './retry.ts';
import { requireEnv } from './env.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallGeminiParams {
  messages: GeminiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** When true, requests JSON-formatted output (response_format=json_object). */
  jsonMode?: boolean;
}

interface GeminiResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function callGemini(params: CallGeminiParams): Promise<{ text: string; raw: GeminiResponse }> {
  const apiKey = requireEnv('GOOGLE_AI_API_KEY');
  const body: Record<string, unknown> = {
    model: params.model ?? DEFAULT_GEMINI_MODEL,
    messages: params.messages,
  };
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
  if (params.jsonMode) body.response_format = { type: 'json_object' };

  const raw = await withRetry(
    async () => {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: timeoutSignal(params.timeoutMs ?? 60_000),
      });
      if (res.ok) return (await res.json()) as GeminiResponse;

      const text = await res.text().catch(() => '');
      if (res.status === 402) throw upstream('Gemini quota exhausted (402)', 402);
      if (res.status === 429) throw rateLimited('Gemini rate limit exceeded');
      if (res.status >= 400 && res.status < 500) {
        throw upstream(`Gemini ${res.status}: ${text.slice(0, 200)}`, 502);
      }
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
    },
    {
      attempts: 3,
      baseMs: 700,
      shouldRetry: (err) => {
        const msg = err instanceof Error ? err.message : '';
        return /^Gemini [5]\d\d/.test(msg);
      },
    },
  );

  const text = raw.choices?.[0]?.message?.content ?? '';
  if (!text) throw upstream('Empty response from Gemini');
  return { text, raw };
}
