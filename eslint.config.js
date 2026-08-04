import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/", "node_modules/", "coverage/"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        rules: {
            // tree-kit ships zero runtime dependencies and stays usable in any
            // environment. Forbidding UI frameworks and node built-ins makes
            // that a lint error rather than a convention someone can forget.
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {name: "react", message: "tree-kit must stay framework-agnostic."},
                        {name: "react-dom", message: "tree-kit must stay framework-agnostic."},
                    ],
                    patterns: ["react/*", "react-dom/*", "node:*"],
                },
            ],
        },
    },
);
