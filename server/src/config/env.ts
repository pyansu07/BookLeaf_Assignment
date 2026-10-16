import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  ai: {
    provider: (process.env.AI_PROVIDER ?? "openai") as "openai" | "anthropic",
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    // Lets the "openai" provider point at any OpenAI-compatible endpoint (e.g. Groq).
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  },
};
