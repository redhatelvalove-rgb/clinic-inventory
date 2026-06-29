import { defineConfig } from "vitest/config";

// 後端純函式測試（不沿用 vite.config.ts 的 client root）
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["server/**/*.test.ts"],
    environment: "node",
  },
});
