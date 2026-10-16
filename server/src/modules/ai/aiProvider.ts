import { env } from "../../config/env";

export interface AiCompletionRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Ask the provider to constrain output to a JSON object (classification calls only). */
  jsonMode?: boolean;
}

/**
 * Thin wrapper around whichever provider is configured. Returns null on any
 * failure (missing key, network error, rate limit, bad response shape) so
 * callers can fall back to manual workflows instead of crashing a request.
 */
export async function completeWithAi(req: AiCompletionRequest): Promise<string | null> {
  if (!env.ai.apiKey) {
    return null;
  }

  try {
    if (env.ai.provider === "anthropic") {
      return await callAnthropic(req);
    }
    return await callOpenAi(req);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("AI provider call failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function callOpenAi(req: AiCompletionRequest): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${env.ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: env.ai.model,
        max_tokens: req.maxTokens,
        temperature: 0.3,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI-compatible endpoint responded ${response.status}: ${body.slice(0, 300)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(req: AiCompletionRequest): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ai.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ai.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic responded ${response.status}`);
    }
    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? null;
  } finally {
    clearTimeout(timeout);
  }
}
