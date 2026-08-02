import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

// Load test env before anything (incl. the Prisma client singleton) reads DATABASE_URL.
// A var already set in the environment (e.g. by CI) always wins over the file.
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
