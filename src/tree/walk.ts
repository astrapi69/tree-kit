/**
 * Traversal.
 *
 * Everything is a generator, so callers use `for...of` and stop with `break`
 * instead of returning a sentinel from a visitor callback. There is no
 * Visitor-pattern wrapper: the iterator protocol is the language's own answer
 * to the problem the pattern was invented for.
 *
 * All three strategies are lazy — `find` stops the walk at the first match
 * rather than materialising the whole traversal.
 */

import type {TreeCursor} from "../types/cursor";
import type {TraversalStrategy, TreeNode} from "../types/tree";

import {preOrder, rootCursor} from "./cursor";

/**
 * Depth-first, children before parents.
 *
 * Iterative for the same reason as `preOrder`: no call-stack limit on deep
 * trees. Each cursor is pushed twice - once to expand its children, once
 * (marked `expanded`) to be emitted after them.
 */
function* postOrder<V, K>(cursor: TreeCursor<V, K>): Generator<TreeCursor<V, K>> {
    interface Frame {
        cursor: TreeCursor<V, K>;
        expanded: boolean;
    }
    const stack: Frame[] = [{cursor, expanded: false}];
    while (stack.length > 0) {
        const frame = stack.pop() as Frame;
        if (frame.expanded) {
            yield frame.cursor;
            continue;
        }
        stack.push({cursor: frame.cursor, expanded: true});
        const children = frame.cursor.children();
        for (let index = children.length - 1; index >= 0; index -= 1) {
            stack.push({cursor: children[index], expanded: false});
        }
    }
}

/**
 * Level by level across the whole forest, so roots come first, then every
 * root's children, and so on.
 *
 * Uses a read index instead of `Array.prototype.shift` — shifting is O(n) per
 * call, which would make the whole traversal quadratic.
 */
function* breadthFirst<V, K>(
    cursors: readonly TreeCursor<V, K>[],
): Generator<TreeCursor<V, K>> {
    const queue: TreeCursor<V, K>[] = [...cursors];
    for (let read = 0; read < queue.length; read += 1) {
        const cursor = queue[read];
        yield cursor;
        queue.push(...cursor.children());
    }
}

/**
 * Traverse a forest. `walk` is the single-root convenience wrapper around
 * this; prefer `walkForest` when working with the output of
 * {@link buildTreeFromFlat}, which may legitimately return several roots.
 *
 * With `breadth`, levels are synchronised *across* roots — all roots, then all
 * of their children. With `pre` / `post` each root's subtree is finished
 * before the next root starts.
 *
 * @example
 * ```ts
 * const forest = buildTreeFromFlat(rows, {getId, getParentId})
 * for (const cursor of walkForest(forest, "breadth")) {
 *   if (cursor.depth() > 2) break        // stop: no sentinel return value
 *   render(cursor)
 * }
 * ```
 */
export function* walkForest<V, K>(
    roots: readonly TreeNode<V, K>[],
    strategy: TraversalStrategy = "pre",
): Generator<TreeCursor<V, K>> {
    const cursors = roots.map((root) => rootCursor(root));
    if (strategy === "breadth") {
        yield* breadthFirst(cursors);
        return;
    }
    const order = strategy === "post" ? postOrder : preOrder;
    for (const cursor of cursors) {
        yield* order(cursor);
    }
}

/**
 * Traverse the subtree rooted at `root`.
 *
 * @example
 * ```ts
 * for (const cursor of walk(tree, "post")) {
 *   teardown(cursor.value)               // children before their parent
 * }
 * ```
 */
export function walk<V, K>(
    root: TreeNode<V, K>,
    strategy: TraversalStrategy = "pre",
): Generator<TreeCursor<V, K>> {
    return walkForest([root], strategy);
}

/**
 * First cursor matching `predicate`, or `undefined`. Lazy: stops walking at
 * the first hit.
 *
 * @example
 * ```ts
 * const found = find(tree, (cursor) => cursor.id === "c1")
 * found?.path().map((node) => node.id)   // breadcrumb to the match
 * ```
 */
export function find<V, K>(
    root: TreeNode<V, K>,
    predicate: (cursor: TreeCursor<V, K>) => boolean,
    strategy: TraversalStrategy = "pre",
): TreeCursor<V, K> | undefined {
    for (const cursor of walk(root, strategy)) {
        if (predicate(cursor)) return cursor;
    }
    return undefined;
}

/** Every cursor matching `predicate`, in traversal order. */
export function findAll<V, K>(
    root: TreeNode<V, K>,
    predicate: (cursor: TreeCursor<V, K>) => boolean,
    strategy: TraversalStrategy = "pre",
): TreeCursor<V, K>[] {
    const matches: TreeCursor<V, K>[] = [];
    for (const cursor of walk(root, strategy)) {
        if (predicate(cursor)) matches.push(cursor);
    }
    return matches;
}

/** Total number of nodes in the subtree rooted at `root`, including `root`. */
export function count<V, K>(root: TreeNode<V, K>): number {
    const steps = walk(root);
    let total = 0;
    while (steps.next().done !== true) total += 1;
    return total;
}
