/**
 * Cursor type — the navigable view onto a {@link TreeNode}.
 *
 * A cursor is a transient pointer that knows where it sits: it carries a
 * reference to its node and to its parent cursor, so it can answer `parent()`,
 * `path()` and `depth()` without the node itself needing a parent pointer.
 *
 * The cursor chain only ever points *upward*, so it is acyclic too — but
 * cursors are never meant to be serialised. Serialise the `node`.
 */

import type {TreeNode} from "./tree";

/**
 * A position inside a tree.
 *
 * Identity rules, which matter for `Set` membership, `useMemo` dependencies
 * and React `key` comparison:
 *
 *   - `cursor.node` is stable — the same node object for the same position,
 *     always. Compare nodes, not cursors.
 *   - `cursor.parent()` returns the *same* cursor instance on every call, so
 *     two sibling cursors share one parent cursor object.
 *   - `cursor.children()` allocates fresh cursors per call. Their `.node`
 *     references are still stable.
 *
 * @example
 * ```ts
 * const root = rootCursor(tree)
 * const [a, b] = root.children()
 * a.parent() === b.parent()   // true  - shared parent cursor
 * a.node === root.children()[0].node  // true  - stable node identity
 * ```
 */
export interface TreeCursor<V, K = string> {
    /** The node this cursor points at. Stable identity; safe to compare. */
    readonly node: TreeNode<V, K>;

    /** Shorthand for `cursor.node.id`. */
    readonly id: K;

    /** Shorthand for `cursor.node.value`. */
    readonly value: V;

    /**
     * The parent cursor, or `null` at a root. Returns the same instance on
     * every call, so sibling cursors compare equal on their parent.
     */
    parent(): TreeCursor<V, K> | null;

    /**
     * Cursors for the direct children, in order. O(k) in the number of
     * children — never a subtree walk.
     */
    children(): TreeCursor<V, K>[];

    /**
     * Nodes from the root down to and including this one: `[root, ..., this]`.
     * Useful for breadcrumbs. O(depth).
     */
    path(): TreeNode<V, K>[];

    /** Distance from the root: 0 at a root, 1 for a direct child. O(depth). */
    depth(): number;

    /**
     * Position among the parent's children. A root has no parent context and
     * reports 0 — chosen over -1 so callers can use the value in arithmetic
     * (indentation, `aria-posinset`) without a special case.
     */
    childIndex(): number;

    /** True when this cursor has no parent. */
    isRoot(): boolean;

    /** True when the node has no children. */
    isLeaf(): boolean;

    /**
     * Pre-order iteration over this cursor's subtree, so a cursor can be used
     * directly in `for...of`. Lives here rather than on `TreeNode` because a
     * method on the node would make it un-`structuredClone`-able.
     */
    [Symbol.iterator](): Iterator<TreeCursor<V, K>>;
}
