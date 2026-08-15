# Examples

Runnable scripts against the built package - no extra tooling, plain
Node ESM importing from `../dist/`.

```bash
npm run build        # once, so dist/ exists
node examples/curriculum.mjs
node examples/tolerant-view.mjs
node examples/mutations.mjs
```

| Script | Shows |
|---|---|
| `curriculum.mjs` | The happy path: flat rows -> forest, sibling sort, cursor traversal with depth/path, serialisation |
| `tolerant-view.mjs` | `onInvalidParent: "promoteToRoot"`: orphans and cycles render instead of throwing; the same data crashes the strict default |
| `mutations.mjs` | Copy-on-write editing: `moveNode` with the structural-sharing identity check (`===`), the cyclic-move refusal, `isAncestor`, and `flatten` back to rows |
