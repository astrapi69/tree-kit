/**
 * `@astrapi69/tree-kit` — typed, serialisable tree structures for TypeScript.
 *
 * Two types carry the whole library:
 *
 *   - {@link TreeNode} is pure data: immutable, acyclic, and safe to pass to
 *     `JSON.stringify` and `structuredClone`.
 *   - {@link TreeCursor} is a transient pointer into a tree that knows its own
 *     position, so `parent()`, `path()` and `depth()` work without the node
 *     carrying a parent reference.
 *
 * Traversal is generator-based; use `for...of` and `break`.
 *
 * @example
 * ```ts
 * import {buildTreeFromFlat, walkForest} from "@astrapi69/tree-kit"
 *
 * const forest = buildTreeFromFlat(rows, {
 *   getId: (row) => row.id,
 *   getParentId: (row) => row.parentId,
 * })
 *
 * for (const cursor of walkForest(forest)) {
 *   console.log("  ".repeat(cursor.depth()) + cursor.value.title)
 * }
 *
 * localStorage.setItem("tree", JSON.stringify(forest))   // no cycles
 * ```
 *
 * @packageDocumentation
 */

export type {DisplayFormatter, TraversalStrategy, TreeNode} from "./types/tree";
export type {TreeCursor} from "./types/cursor";

export {rootCursor} from "./tree/cursor";
export {count, find, findAll, walk, walkForest} from "./tree/walk";
export {buildTreeFromFlat, type BuildTreeOptions} from "./tree/build";
export {displayValue} from "./utils/display";
