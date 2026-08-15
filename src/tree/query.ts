/**
 * Structural queries and value-level folds.
 *
 * These answer questions the cursor can only reach the long way round —
 * "how deep is this subtree", "are these two nodes related", "give me the
 * siblings" — and mirror the vocabulary of the Java `tree-api` / `gen-tree`
 * ancestors (`getAllSiblings`, `isRoot`/`isLeaf`, level/depth, ancestor tests)
 * without adopting their mutable, parent-linked node model.
 *
 * Relationship queries take cursors, because "where a node sits" is exactly
 * what a cursor knows and a bare {@link TreeNode} does not. Subtree-shaped
 * queries (`height`, `mapValues`-style folds) take a node, because they only
 * need the data below a point, not its position.
 */

import type {TreeCursor} from "../types/cursor";
import type {TraversalStrategy, TreeNode} from "../types/tree";

import {foldNode} from "./fold";
import {walkForest} from "./walk";

/**
 * The greatest depth below `node`, in the same units as `cursor.depth()`:
 * 0 for a leaf, 1 when it has children, and so on. The counterpart to a
 * cursor's upward `depth()` — this looks downward.
 *
 * Iterative, so a 50,000-deep subtree reports its height instead of
 * overflowing.
 *
 * @example
 * ```ts
 * height(forest[0])   // 2  for  root → child → grandchild
 * ```
 */
export function height<V, K>(node: TreeNode<V, K>): number {
    interface Frame {
        node: TreeNode<V, K>;
        depth: number;
    }
    const stack: Frame[] = [{node, depth: 0}];
    let deepest = 0;
    while (stack.length > 0) {
        const frame = stack.pop() as Frame;
        if (frame.depth > deepest) deepest = frame.depth;
        for (const child of frame.node.children) {
            stack.push({node: child, depth: frame.depth + 1});
        }
    }
    return deepest;
}

/**
 * The nodes that share a parent with `cursor`, in order, excluding the cursor's
 * own node. A root cursor reports `[]`: within a single tree a root has no
 * siblings, and the forest it might have root-siblings in is not part of the
 * cursor's context.
 *
 * @example
 * ```ts
 * siblings(find(forest[0], (c) => c.id === "c1")!)   // [c2, …]
 * ```
 */
export function siblings<V, K>(cursor: TreeCursor<V, K>): TreeNode<V, K>[] {
    const parent = cursor.parent();
    if (parent === null) return [];
    return parent.node.children.filter((child) => child !== cursor.node);
}

/**
 * True when `ancestor` is a proper ancestor of `descendant` — reachable by
 * walking `descendant` upward, and not the same node. Compares node identity
 * along the descendant's path, so both cursors must address the same tree.
 *
 * @example
 * ```ts
 * isAncestor(root, grandchild)   // true
 * isAncestor(node, node)         // false — proper, not reflexive
 * ```
 */
export function isAncestor<V, K>(
    ancestor: TreeCursor<V, K>,
    descendant: TreeCursor<V, K>,
): boolean {
    if (ancestor.node === descendant.node) return false;
    return descendant.path().some((node) => node === ancestor.node);
}

/**
 * True when `descendant` is a proper descendant of `ancestor`. The mirror of
 * {@link isAncestor}, argument order swapped so each reads naturally at the call
 * site.
 */
export function isDescendant<V, K>(
    descendant: TreeCursor<V, K>,
    ancestor: TreeCursor<V, K>,
): boolean {
    return isAncestor(ancestor, descendant);
}

/**
 * The deepest node that is an ancestor of (or equal to) both `a` and `b`, or
 * `null` when they sit in different roots and share none. Standard breadcrumb /
 * permission-scope building block.
 *
 * Walks both root→node paths in lockstep and keeps the last shared node.
 *
 * @example
 * ```ts
 * lowestCommonAncestor(childA, childB)?.id   // their nearest shared parent
 * ```
 */
export function lowestCommonAncestor<V, K>(
    a: TreeCursor<V, K>,
    b: TreeCursor<V, K>,
): TreeNode<V, K> | null {
    const pathA = a.path();
    const pathB = b.path();
    const shorter = Math.min(pathA.length, pathB.length);
    let common: TreeNode<V, K> | null = null;
    for (let index = 0; index < shorter; index += 1) {
        if (pathA[index] !== pathB[index]) break;
        common = pathA[index];
    }
    return common;
}

/**
 * The subtree at `cursor` as a standalone tree. The node is already a valid,
 * parent-less {@link TreeNode}, so this is its identity — but it stays
 * structurally shared with the origin. That sharing is safe precisely because
 * nodes are immutable; when you need a copy you can mutate or re-id freely, use
 * {@link cloneSubtree}.
 */
export function extractSubtree<V, K>(cursor: TreeCursor<V, K>): TreeNode<V, K> {
    return cursor.node;
}

/**
 * A deep, independent copy of the subtree at `node`, with each value cloned via
 * `structuredClone` and each id passed through `remapId`. The default keeps ids
 * unchanged — a pure clone; pass a remapper (e.g. `(id) => id + "-copy"`) to
 * duplicate a subtree into the same tree without colliding on id.
 *
 * @example
 * ```ts
 * const dup = cloneSubtree(forest[0], (id) => `${id}-copy`)
 * ```
 */
export function cloneSubtree<V, K>(
    node: TreeNode<V, K>,
    remapId: (id: K, node: TreeNode<V, K>) => K = (id) => id,
): TreeNode<V, K> {
    return foldNode<V, K, TreeNode<V, K>>(node, (current, children) => ({
        id: remapId(current.id, current),
        value: structuredClone(current.value),
        children,
    }));
}

/**
 * Fold every value in the subtree at `node` into a single accumulator, in the
 * chosen traversal order (pre-order by default). The tree-shaped counterpart to
 * `Array.prototype.reduce` — use it for sums, counts, extents.
 *
 * @example
 * ```ts
 * reduceTree(forest[0], (sum, topic) => sum + topic.position, 0)
 * ```
 */
export function reduceTree<V, K, A>(
    node: TreeNode<V, K>,
    reducer: (acc: A, value: V, id: K) => A,
    seed: A,
    strategy: TraversalStrategy = "pre",
): A {
    let acc = seed;
    for (const cursor of walkForest([node], strategy)) {
        acc = reducer(acc, cursor.value, cursor.id);
    }
    return acc;
}

/**
 * Keep only the nodes satisfying `predicate`, preserving the hierarchy of the
 * survivors: when a node is dropped, its surviving descendants are promoted to
 * take its place under the nearest surviving ancestor (or to become roots).
 * Because dropping a node can leave several survivors where one node stood, the
 * result is a forest.
 *
 * This is the reparenting filter, not a subtree prune — a kept leaf is never
 * lost just because an intermediate ancestor failed the predicate. That is the
 * behaviour `findAll` cannot give you: it returns a flat list, this returns a
 * tree.
 *
 * @example
 * ```ts
 * // Hide "draft" categories but keep their published children in place.
 * filterTree(forest[0], (node) => node.value.status !== "draft")
 * ```
 */
export function filterTree<V, K>(
    node: TreeNode<V, K>,
    predicate: (node: TreeNode<V, K>) => boolean,
): TreeNode<V, K>[] {
    return foldNode<V, K, TreeNode<V, K>[]>(node, (current, childLists) => {
        const kept = childLists.flat();
        return predicate(current) ? [{id: current.id, value: current.value, children: kept}] : kept;
    });
}
