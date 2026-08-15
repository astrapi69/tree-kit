# Changelog

All notable changes to `@astrapi69/tree-kit` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions follow [SemVer](https://semver.org/spec/v2.0.0.html) -
additive API is a minor even pre-1.0.

## [0.3.1] - 2026-08-15

Documentation release; no code changes.

### Added
- `CHANGELOG.md` (this file).
- README section **Planned, awaiting a consumer**: what is
  deliberately NOT built yet, each entry with its tracking issue
  and the concrete trigger that would justify building it.
- Project-specific `CONTRIBUTING.md` and `SECURITY.md`: the two
  non-negotiable invariants (pure-data nodes, zero dependencies),
  the consumer-first rule for new API, and a security scope that
  names the realistic surface of a zero-dependency data library
  (algorithmic complexity, prototype pollution, npm supply chain).
- Runnable `examples/mutations.mjs`: a move with the
  structural-sharing identity check (`===` on the untouched
  subtree), the cyclic-move refusal, and `flatten` closing the
  circle back to rows.

### Changed
- The maturity section accounts for three surfaces instead of two
  and records that the tolerant mode now has two production
  consumers (Topos, adaptive-learner).

## [0.3.0] - 2026-08-15

### Added
- **Copy-on-write mutations**: `addChild`, `removeNode`,
  `moveNode` (throws on cyclic moves), `updateValue`,
  `replaceSubtree`, `mapValues`, and `flatten` - the inverse of
  `buildTreeFromFlat`, a forest back to `{id, parentId, value}`
  rows. Structural sharing throughout: only the path from a root
  down to the edit is re-allocated; every untouched subtree keeps
  its identity (`===`).
- **Structural queries**: `height`, `siblings`, `isAncestor`,
  `isDescendant`, `lowestCommonAncestor`, `extractSubtree`,
  `cloneSubtree`, `reduceTree`, `filterTree` (survivors are
  promoted, hierarchy kept).
- **Fold**: `foldNode`.

## [0.2.0] - 2026-08-14

### Added
- `onInvalidParent: "throw" | "promoteToRoot"` on
  `buildTreeFromFlat`. The default stays strict; the tolerant
  mode promotes rows whose parent id names no row - or whose
  ancestor chain never reaches a root - to roots, so views over
  filtered or corrupted data render instead of crashing.
  Duplicate ids throw in both modes. Resolution is memoised,
  O(n). Extracted from consumer evidence: Topos had written the
  identical pre-sanitizer twice; adaptive-learner called the
  builder raw.
- Runnable `examples/`: the happy path and the tolerant mode
  side by side with the strict default on the same defective
  rows.

## [0.1.0] - 2026-08-11

### Added
- Initial release: `TreeNode` (immutable, acyclic, serialisable),
  `TreeCursor` (`parent()`, `path()`, `depth()` without parent
  pointers on nodes), generator traversal (`walk`, `walkForest`,
  `find`, `findAll`, `count`), `buildTreeFromFlat` (flat rows to
  a forest in O(n), every structural defect failing loudly), and
  `displayValue`. Zero runtime dependencies; every pass iterative
  (pinned by a 50 000-level test).
