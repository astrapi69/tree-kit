# @astrapi69/tree-kit

Typed, serialisable tree structures for TypeScript. Zero runtime dependencies,
framework-agnostic.

A TypeScript port of the Java libraries [`astrapi69/tree-api`][tree-api] and
[`astrapi69/gen-tree`][gen-tree], redesigned around TypeScript's own idioms
rather than transliterated class-for-class.

[tree-api]: https://github.com/astrapi69/tree-api
[gen-tree]: https://github.com/astrapi69/gen-tree

## Install

```bash
npm install @astrapi69/tree-kit
```

## The two types

**`TreeNode<V, K>`** is pure data: immutable, acyclic, and free of methods. It
survives `JSON.stringify` and `structuredClone` untouched, so a whole tree goes
into `localStorage` or over the wire without a serialisation step.

```ts
interface TreeNode<V, K = string> {
  readonly id: K
  readonly value: V
  readonly children: readonly TreeNode<V, K>[]
}
```

**`TreeCursor<V, K>`** is a transient pointer that knows its own position. It
holds the parent reference the node deliberately does not, so `parent()`,
`path()` and `depth()` work without making the object graph cyclic.

```ts
const cursor = rootCursor(tree)
cursor.children()[0].parent() === cursor   // true - shared instance
```

## Quick start

```ts
import {buildTreeFromFlat, walkForest} from "@astrapi69/tree-kit"

interface Topic {
  id: string
  parentId: string | null
  title: string
  position: number
}

const forest = buildTreeFromFlat<Topic, string>(rows, {
  getId: (row) => row.id,
  getParentId: (row) => row.parentId,
  sort: (a, b) => a.position - b.position,
})

for (const cursor of walkForest(forest)) {
  console.log("  ".repeat(cursor.depth()) + cursor.value.title)
}

localStorage.setItem("topics", JSON.stringify(forest))
```

## Strict by default, tolerant on request

`buildTreeFromFlat` rejects structural defects loudly — the right answer
for data that is supposed to be sound, because a silent repair hides the
upstream bug that produced it. Views are different: a page rendering
FILTERED rows, or whatever a sync left behind, must show the data it has,
not crash on the row it cannot place. That is what
`onInvalidParent: "promoteToRoot"` is for:

```ts
const forest = buildTreeFromFlat<Category, string>(rows, {
  getId: (row) => row.path,
  getParentId: (row) => row.parentPath,
  onInvalidParent: "promoteToRoot",
})
```

| Defect | `"throw"` (default) | `"promoteToRoot"` |
|---|---|---|
| Parent id names no row | `Error: ... references unknown parent` | Row becomes a root |
| Cycle (`a -> b -> a`) | `Error: cycle detected` | Every member becomes a root |
| Row hanging below a cycle | `Error: cycle or orphan rows` | Becomes a root too — its chain never terminates either |
| Duplicate id | `Error: duplicate id` | **Still throws.** Two rows with one id is corruption no placement can express |

The rule is one sentence: *a row is promoted to a root when its parent id
names no row, or its ancestor chain never reaches a root.* Valid nesting
in the same input stays intact, promoted roots take part in the sibling
`sort` like real ones, and the resolution is memoised so the build stays
O(n).

Which mode belongs where:

- **Ingest, import, persistence** — keep the default. If a workbook or
  API response carries a dangling reference, you want the exception and
  the offending id, not a silently reshaped tree.
- **Rendering** — opt in. The two real-world shapes this option came
  from: a category tree where a child can outlive its deleted parent
  (orphan report exists, the view must still render), and an inventory
  view over a FILTERED row list, where a visible child of a filtered-out
  parent must not vanish.
- **Custom degradation** — stays yours. `promoteToRoot` promotes to the
  FOREST root; if your domain wants something else (Topos degrades
  containers to their type/owner group instead), resolve parents
  yourself before building and keep the option as a second net.

## Traversal is `for...of`

There is no Visitor callback and no sentinel return value. Stop with `break`.

```ts
for (const cursor of walk(tree, "breadth")) {
  if (cursor.depth() > 2) break
  render(cursor)
}
```

Three orders: `pre` (default, parents first), `post` (children first), `breadth`
(level by level). `walkForest` synchronises breadth-first levels across roots;
`pre` and `post` finish one root's subtree before starting the next.

`find` is lazy and stops at the first match:

```ts
const match = find(tree, (cursor) => cursor.id === target)
match?.path().map((node) => node.id)   // breadcrumb
```

## Typed ids

`K` defaults to `string` but is free to be a number or a branded string, so ids
from two different trees cannot silently cross at compile time.

```ts
type TopicId = string & {readonly __brand: "TopicId"}
type LessonId = string & {readonly __brand: "LessonId"}

const topics: TreeNode<Topic, TopicId> = /* ... */
find(topics, (cursor) => cursor.id === someLessonId)   // compile error
```

## API

| Export | Kind | Purpose |
|---|---|---|
| `TreeNode<V, K>` | type | Immutable, acyclic, serialisable node |
| `TreeCursor<V, K>` | type | Navigable position inside a tree |
| `TraversalStrategy` | type | `"pre" \| "post" \| "breadth"` |
| `DisplayFormatter<V>` | type | `(value: V) => string` |
| `BuildTreeOptions<V, K>` | type | Key extractors, optional sibling sort, `onInvalidParent` |
| `buildTreeFromFlat` | fn | Flat `(id, parentId)` rows into a forest, O(n) |
| `rootCursor` | fn | Cursor at a node, treated as a root |
| `walk` | fn | Generator over one subtree |
| `walkForest` | fn | Generator over several roots |
| `find` / `findAll` | fn | First / all matching cursors |
| `count` | fn | Node count including the root |
| `displayValue` | fn | Label for a node, via an optional formatter |

## Design notes

**Why no parent pointer on the node.** It would make the object graph cyclic:
`JSON.stringify` throws `TypeError: Converting circular structure to JSON`,
`structuredClone` throws, and debuggers walk in circles. The parent lives on the
cursor instead, which is transient and never serialised.

**Why no `[Symbol.iterator]` on the node.** A method is an own property.
`JSON.stringify` would drop it silently, but `structuredClone` refuses to clone
functions outright — the node would stop being clonable. Iteration lives on the
cursor: `for (const each of rootCursor(tree))`.

**Why no formatter stored on the tree.** A label is a rendering concern, and
storing a function on the node would break clonability for the same reason.
`displayValue(node, formatter)` takes it at call time.

**Cursor identity is deliberate.** `cursor.parent()` returns the same instance
on every call and `children()` memoises, so sibling cursors compare equal on
their parent and `Set` / memo dependencies behave. Compare `cursor.node` when
comparing positions across independent traversals.

**Every pass is iterative.** Build, sort and all three traversals run on an
explicit stack rather than recursion, so a chain deeper than the call stack is
handled like any other input. Pinned by a 50 000-level test.

**Construction is O(n).** One pass indexes rows by id in a `Map`, one pass links
each row to its parent with an O(1) lookup. Duplicate ids, unknown parent
references and cycles all throw with the offending ids named — a silent drop
would hide the upstream bug that produced them. The tolerant mode
(`onInvalidParent: "promoteToRoot"`) trades the exception for a visible
degradation — promotion to a root — and only for the two defects a view can
meaningfully survive; duplicate ids stay fatal in both modes. Its chain
resolution is memoised, so tolerance costs no complexity class.

## Maturity: which half is proven

The package ships two surfaces, and they do not carry the same weight of
evidence. The version number says so on purpose.

**`TreeNode` and `buildTreeFromFlat` are proven by use.** They were migrated
into a real application before this package was first published: five lines
changed, 735 deleted, no addition needed. The shape held against a consumer.
The tolerant mode (0.2.0) came the same way, from the consumer side: Topos had
written the identical pre-sanitizer twice (a category tree tolerating orphans,
an inventory tree over filtered rows), and adaptive-learner called the builder
raw - a latent crash on the first dangling reference. The option replaced both
sanitizers; the consumers' existing behaviour pins stayed green unchanged.

**`TreeCursor` is proven by tests only.** No consumer has used `parent()`,
`path()` or `depth()` yet. It exists because the alternative was a parent
pointer on the node, which would have cost `JSON.stringify` and
`structuredClone` — that reasoning stands on its own. But a surface without a
user is a prediction about what someone will need, and its first real use
(keyboard focus and breadcrumbs in a menu engine) is still ahead. Expect it to
move before 1.0.

This is what `0.x` is for. One half is verified, one half is expected, and the
number should not claim otherwise.

## Development

```bash
make install     # install dependencies
make test        # run the suite
make check-all   # lint + typecheck + test + build
make inspect     # show exactly what would be published
```

## License

MIT — Asterios Raptis
