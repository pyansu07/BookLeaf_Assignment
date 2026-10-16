import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    hookTimeout: 20000,
    testTimeout: 20000,
    fileParallelism: false,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
