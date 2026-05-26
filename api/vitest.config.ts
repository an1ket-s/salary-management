import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/tests/globalSetup.ts",
    setupFiles: ["./src/tests/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      PORT: "3002",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**", "src/index.ts"],
    },
  },
});
