// A chat client for any OpenAI-compatible server: OpenAI, Groq, or a local server such as
// Ollama. Only the base URL, model, and key change. `fetch` can be replaced, so tests never
// touch the network. Errors become short messages: a provider's own body, which can echo the
// request or the key, is never passed on.
import { HttpError } from '../errors.ts';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ModelReply {
  content: string;
  usage: ModelUsage;
}

export interface ModelClient {
  readonly model: string;
  complete(messages: ChatMessage[]): Promise<ModelReply>;
}

export interface ModelClientOptions {
  apiKey?: string; // empty for a local server that needs none (no Authorization header is sent)
  model: string;
  baseUrl?: string; // default https://api.openai.com/v1; e.g. http://localhost:11434/v1 for Ollama
  reasoning?: boolean; // force reasoning-model settings on or off; guessed from the model name when unset
  seed?: number; // asks the provider for repeatable answers; best effort, not a guarantee
  fetch?: typeof fetch;
  timeoutMs?: number;
}

// Reasoning models reject a temperature and spend hidden tokens thinking, so they get a
// low effort and a larger budget; the rest answer at temperature 0 for repeatable runs.
const REASONING_MODEL = /^(o\d|gpt-5)|gpt-oss/i;

export function openAiCompatibleClient(options: ModelClientOptions): ModelClient {
  const baseUrl = (options.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const request = options.fetch ?? fetch;
  const reasoning = options.reasoning ?? REASONING_MODEL.test(options.model);

  return {
    model: options.model,
    async complete(messages) {
      const body = {
        model: options.model,
        messages,
        response_format: { type: 'json_object' },
        ...(options.seed === undefined ? {} : { seed: options.seed }),
        ...(reasoning
          ? { reasoning_effort: 'low', max_completion_tokens: 4000 }
          : { temperature: 0, max_completion_tokens: 600 }),
      };
      let response: Response;
      try {
        response = await request(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        });
      } catch {
        throw new HttpError(503, 'The model could not be reached or took too long. Please retry.');
      }
      if (response.status === 429) {
        throw new HttpError(429, 'The model reached its usage limit. Please try again later.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new HttpError(503, 'The model service rejected the configured key. Ask an administrator to check it.');
      }
      if (!response.ok) throw new HttpError(503, 'The model service is unavailable. Please retry later.');

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new HttpError(502, 'The model returned an unreadable reply. Please retry.');
      }
      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      if (choice?.finish_reason !== 'stop' || typeof content !== 'string' || !content.trim()) {
        throw new HttpError(502, 'The model did not finish its answer. Please retry.');
      }
      return {
        content,
        usage: {
          promptTokens: Number(data.usage?.prompt_tokens) || 0,
          completionTokens: Number(data.usage?.completion_tokens) || 0,
        },
      };
    },
  };
}
