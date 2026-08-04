/**
 * Cursor implementation.
 *
 * The cursor keeps a reference to its parent cursor instead of the node
 * keeping a reference to its parent node. That inversion is what lets
 * {@link TreeNode} stay acyclic and clonable while `parent()` / `path()` /
 * `depth()` still work.
 *
 * Construction is O(1): a cursor stores a node and a parent reference, and
 * computes path and depth on demand by walking the parent chain.
 */

import type {TreeCursor} from "../types/cursor";
import type {TreeNode} from "../types/tree";

/**
 * Concrete cursor. Not exported directly — construct one with
 * {@link rootCursor} and reach the rest via `children()`.
 */
class Cursor<V, K> implements TreeCursor<V, K> {
    readonly node: TreeNode<V, K>;

    private readonly _parent: Cursor<V, K> | null;

    /**
     * Memoised child cursors. Kept so repeated `children()` calls during a
     * render pass do not re-allocate, and so a child's `parent()` can hand
     * back a shared instance.
     */
    private _children: Cursor<V, K>[] | null = null;

    constructor(node: TreeNode<V, K>, parent: Cursor<V, K> | null) {
        this.node = node;
        this._parent = parent;
    }

    get id(): K {
        return this.node.id;
    }

    get value(): V {
        return this.node.value;
    }

    parent(): TreeCursor<V, K> | null {
        return this._parent;
    }

    children(): TreeCursor<V, K>[] {
        if (this._children === null) {
            this._children = this.node.children.map((child) => new Cursor<V, K>(child, this));
        }
        return this._children;
    }

    path(): TreeNode<V, K>[] {
        const reversed: TreeNode<V, K>[] = [this.node];
        for (let step = this._parent; step !== null; step = step._parent) {
            reversed.push(step.node);
        }
        return reversed.reverse();
    }

    depth(): number {
        let levels = 0;
        for (let step = this._parent; step !== null; step = step._parent) {
            levels += 1;
        }
        return levels;
    }

    childIndex(): number {
        if (this._parent === null) return 0;
        return this._parent.node.children.indexOf(this.node);
    }

    isRoot(): boolean {
        return this._parent === null;
    }

    isLeaf(): boolean {
        return this.node.children.length === 0;
    }

    [Symbol.iterator](): Iterator<TreeCursor<V, K>> {
        return preOrder(this);
    }
}

/**
 * Pre-order generator over a cursor's subtree. Shared by
 * `Cursor[Symbol.iterator]` and by the `walk` family in `./walk.ts`, so the
 * two can never drift apart.
 *
 * Iterative on an explicit stack rather than recursive: recursion depth would
 * track tree depth, and a deep chain would then overflow the call stack on
 * input the library otherwise handles fine. Children are pushed in reverse so
 * they pop in order.
 *
 * @internal
 */
export function* preOrder<V, K>(cursor: TreeCursor<V, K>): Generator<TreeCursor<V, K>> {
    const stack: TreeCursor<V, K>[] = [cursor];
    while (stack.length > 0) {
        const current = stack.pop() as TreeCursor<V, K>;
        yield current;
        const children = current.children();
        for (let index = children.length - 1; index >= 0; index -= 1) {
            stack.push(children[index]);
        }
    }
}

/**
 * Create a cursor positioned at `node`, treated as a root (its `parent()` is
 * `null` and its `depth()` is 0) even if `node` came from the middle of a
 * larger tree.
 *
 * @example
 * ```ts
 * const cursor = rootCursor(tree)
 * for (const each of cursor) {
 *   console.log("  ".repeat(each.depth()) + String(each.id))
 * }
 * ```
 */
export function rootCursor<V, K = string>(node: TreeNode<V, K>): TreeCursor<V, K> {
    return new Cursor<V, K>(node, null);
}
