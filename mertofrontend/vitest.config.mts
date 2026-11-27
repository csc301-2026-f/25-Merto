import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Component tests run in jsdom. Server actions and the backend are mocked in each
// test, so no backend or Next.js server is needed.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Fixed so formatted dates match whatever machine runs the tests.
    env: { TZ: "America/Toronto" },
  },
});
