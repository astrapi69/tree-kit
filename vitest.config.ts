import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        // Pure logic only - no DOM, no framework. A node environment is enough.
        environment: "node",
        include: ["tests/**/*.{test,spec}.ts"],
    },
});
