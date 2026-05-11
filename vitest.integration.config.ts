import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    name: "integration",
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { concurrent: false },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  },
});
