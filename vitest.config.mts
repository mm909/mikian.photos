import { defineConfig } from "vitest/config";
import path from "node:path";

/* Vitest runs ONLY the tracker's unit tests (TRACKER_SPEC.md §12). The older
 * *.test.ts files under src/lib are plain-assert scripts run with tsx (see
 * the comment at the top of src/lib/rowPalette.test.ts) and would fail under
 * a runner, so the include is narrow on purpose. */
export default defineConfig({
  test: {
    include: ["src/lib/tracker/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
