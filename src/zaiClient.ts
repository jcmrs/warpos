export type ZaiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ZaiChatResponse = {
  text: string;
  raw: unknown;
};

export type ZaiChatOptions = {
  model?: string;
  temperature?: number;
};

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

function getApiKey(): string {
  const apiKey = getEnv('DEVPACK_CODING_PLAN_API_KEY') ?? getEnv('ZAI_API_KEY');
  if (!apiKey) {
    throw new Error(
      'Missing API key. Set DEVPACK_CODING_PLAN_API_KEY (preferred) or ZAI_API_KEY in your environment.'
    );
  }
  return apiKey;
}

function getBaseUrl(): string {
  return getEnv('ZAI_BASE_URL') ?? 'https://api.z.ai/v1';
}

function getDefaultModel(): string {
  return getEnv('ZAI_MODEL') ?? 'z-ai';
}

export async function zaiChat(
  messages: ZaiChatMessage[],
  options: ZaiChatOptions = {}
): Promise<ZaiChatResponse> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  const model = options.model ?? getDefaultModel();

  // NOTE: This request/response shape is a placeholder. Update to match z.ai's actual API.
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.2
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const raw = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
    throw new Error(`z.ai request failed (${res.status}): ${msg}`);
  }

  // Attempt to read a commonly-used response shape.
  const text =
    (raw && (raw as any).choices && (raw as any).choices[0]?.message?.content) ||
    (raw && (raw as any).output_text) ||
    JSON.stringify(raw);

  return { text, raw };
}

export async function zaiPlan(prompt: string): Promise<ZaiChatResponse> {
  return zaiChat([{ role: 'user', content: prompt }], { temperature: 0.2 });
}
