# Contributing to tree-kit

Thanks for considering a contribution. tree-kit is a small,
deliberate library; this document is short because the rules are
few and firm.

## What this library is

Typed, serialisable tree structures: build forests from flat
rows, traverse with cursors, edit copy-on-write. Two invariants
outrank every feature:

1. **`TreeNode` is pure data.** Immutable, acyclic, safe for
   `JSON.stringify` and `structuredClone`. No parent pointers, no
   methods, no formatters on nodes - ever. The design notes in the
   README explain each of these; read them before proposing a
   change that touches the node shape.
2. **Zero runtime dependencies.** A PR that adds one will be
   declined regardless of its other merits.

## Before you build a feature

New API needs a consumer, not a use case. The maturity section in
the README is honest about which surfaces are proven by use and
which are predictions; we do not grow the second list eagerly.
Open an issue first and name the real caller - see
[#9](https://github.com/astrapi69/tree-kit/issues/9) and
[#10](https://github.com/astrapi69/tree-kit/issues/10) for the
shape that takes: what it is, and what concrete trigger would
justify building it.

Bug reports need no such justification - a failing case is always
welcome, ideally as a test.

## Workflow

`main` is protected; every change lands via pull request with the
`lint, typecheck, test, build` check green.

```bash
npm install
npm test             # vitest
npx tsc --noEmit     # typecheck
npm run lint         # eslint
npm run build        # tsup (ESM + CJS + declarations)
```

- **Tests first.** Fixes start with a failing test that pins the
  bug; features pin their contract. Structural properties
  (sharing identity, acyclicity, iteration order) are asserted,
  not assumed.
- **Iterative algorithms.** Build, sort and traversal run on
  explicit stacks so deep chains cannot overflow the call stack;
  keep new code to the same standard (there is a 50 000-level
  test that will tell you).
- **Docs ride along.** A change to public API updates the README
  (API table, and the relevant section) in the same PR. If the
  behaviour is worth a feature, it is worth a runnable script in
  `examples/` - executed, not just written.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`),
  English, present tense.

## Releases

Versions follow SemVer; additive API is a minor even pre-1.0.
Publishing to npm is done by the maintainer.
