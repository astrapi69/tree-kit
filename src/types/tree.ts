/**
 * Core tree data types.
 *
 * A `TreeNode` is a pure, acyclic, serialisable value object: it holds an id,
 * a payload and its children, and nothing else. There is deliberately no
 * parent pointer and no method on the node, because both would break the two
 * properties the whole library is built on:
 *
 *   - a parent pointer makes the object graph cyclic, so `JSON.stringify` and
 *     `structuredClone` throw;
 *   - a method (including `[Symbol.iterator]`) is an own property, which
 *     `structuredClone` refuses to clone.
 *
 * Navigation lives on {@link TreeCursor} instead, which is transient and never
 * serialised. See `./cursor.ts`.
 */

/**
 * A node in a tree. Immutable by contract (`readonly` throughout), acyclic by
 * construction, and safe to pass to `JSON.stringify` / `structuredClone`.
 *
 * `V` is the payload type, `K` the id type. `K` defaults to `string` but is
 * free to be a number or a branded string, so ids from two different trees
 * cannot silently cross.
 *
 * @example
 * ```ts
 * type TopicId = string & {readonly __brand: "TopicId"}
 * const root: TreeNode<{title: string}, TopicId> = {
 *   id: "r" as TopicId,
 *   value: {title: "Root"},
 *   children: [],
 * }
 * JSON.stringify(root) // works: no cycles, no functions
 * ```
 */
export interface TreeNode<V, K = string> {
    /** Stable, unique identifier within one tree. */
    readonly id: K;
    /** User payload. The library never inspects it. */
    readonly value: V;
    /** Direct children, in render order. Empty array for a leaf. */
    readonly children: readonly TreeNode<V, K>[];
}

/**
 * Traversal order.
 *
 * - `pre` — depth-first, parents before children. The default; use it for
 *   top-down rendering.
 * - `post` — depth-first, children before parents. Use it for teardown and
 *   bottom-up aggregation, where a parent needs its children's results.
 * - `breadth` — level by level. Use it for shortest-path-style searches and
 *   for "expand one level at a time" UIs.
 */
export type TraversalStrategy = "pre" | "post" | "breadth";

/**
 * Produces the human-readable label for a payload.
 *
 * Kept as a standalone function type rather than state on the node: a label is
 * a rendering concern, and baking it into the tree would put a function onto a
 * value object that must stay clonable.
 */
export type DisplayFormatter<V> = (value: V) => string;
