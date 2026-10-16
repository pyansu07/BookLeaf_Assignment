// Tests must never hit a paid AI API. dotenv (loaded by config/env.ts) does not
// override variables already present in process.env, so setting this here,
// before any test file imports config/env.ts, keeps AI_API_KEY empty for every
// test regardless of what's configured in the real .env for local dev.
process.env.AI_API_KEY = "";
