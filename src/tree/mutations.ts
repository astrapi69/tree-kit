/**
 * Copy-on-write mutations.
 *
 * {@link TreeNode} is `readonly` by contract, so "editing" a tree means
 * building a new one. Every function here returns a fresh forest and never
 * touches its input — the write-path counterpart to the read-only `walk` and
 * `find` family.
 *
 * Two properties hold across all of them:
 *
 *   - **Structural sharing.** Only the nodes on the path from a root down to
 *     the edit are re-allocated. Every sibling subtree and every untouched root
 *     is returned by identity (`===` to the input), so a change deep in a large
 *     tree costs O(depth) new objects, not O(n). This is what makes the
 *     immutable model practical for UI state (memoised renders, cheap undo).
 *   - **Acyclicity is preserved.** New nodes are plain `{id, value, children}`
 *     objects with no parent pointer, so the result stays `JSON.stringify`- and
 *     `structuredClone`-safe like everything the builder produces.
 *
 * The target of an edit is addressed by a {@link TreeCursor}, which already
 * knows its path from the root (via its parent chain) — so locating the edit
 * is O(depth), no search required. The cursor must belong to the forest passed
 * alongside it; a cursor from a different tree is a programming error and
 * throws rather than silently editing nothing.
 *
 * Functions take and return a forest (`readonly TreeNode[]` in, `TreeNode[]`
 * out) rather than a single root, because a forest is what `buildTreeFromFlat`
 * produces and because operations like "remove a root" or "move across roots"
 * cannot be expressed with a single-root return.
 */

import type {TreeCursor} from "../types/cursor";
import type {TreeNode} from "../types/tree";

import {foldNode} from "./fold";
import {walkForest} from "./walk";

/**
 * Root→target chain of cursors (`[root, ..., cursor]`), so a rebuild can walk
 * it top-down. O(depth); no allocation beyond the array.
 */
function spine<V, K>(cursor: TreeCursor<V, K>): TreeCursor<V, K>[] {
    const chain: TreeCursor<V, K>[] = [];
    for (let step: TreeCursor<V, K> | null = cursor; step !== null; step = step.parent()) {
        chain.push(step);
    }
    return chain.reverse();
}

/**
 * A copy of `items` with the entry at `index` replaced, or removed when
 * `replacement` is `null`. Never mutates `items`; unchanged entries keep their
 * identity, which is what carries structural sharing to siblings.
 */
function spliceAt<T>(items: readonly T[], index: number, replacement: T | null): T[] {
    const next = items.slice();
    if (replacement === null) next.splice(index, 1);
    else next[index] = replacement;
    return next;
}

/**
 * The heart of every mutation: rebuild just the spine from `cursor` up to its
 * root, applying `replace` at the target, and splice the new root back into the
 * forest. `replace` returning `null` deletes the target.
 *
 * Iterative over the spine array (bottom-up), so depth never touches the call
 * stack.
 */
function rebuild<V, K>(
    forest: readonly TreeNode<V, K>[],
    cursor: TreeCursor<V, K>,
    replace: (node: TreeNode<V, K>) => TreeNode<V, K> | null,
): TreeNode<V, K>[] {
    const chain = spine(cursor);
    const rootIndex = forest.indexOf(chain[0].node);
    if (rootIndex === -1) {
        throw new Error("tree-kit mutation: cursor does not belong to the given forest");
    }

    let replacement: TreeNode<V, K> | null = replace(cursor.node);
    for (let level = chain.length - 1; level >= 1; level -= 1) {
        const parent = chain[level - 1].node;
        const childIndex = chain[level].childIndex();
        const children = spliceAt(parent.children, childIndex, replacement);
        replacement = {id: parent.id, value: parent.value, children};
    }

    return spliceAt(forest, rootIndex, replacement);
}

/** True when `needle` is `root` or lives anywhere in its subtree. Iterative. */
function subtreeContains<V, K>(root: TreeNode<V, K>, needle: TreeNode<V, K>): boolean {
    const stack: TreeNode<V, K>[] = [root];
    while (stack.length > 0) {
        const node = stack.pop() as TreeNode<V, K>;
        if (node === needle) return true;
        for (const child of node.children) stack.push(child);
    }
    return false;
}

/** First cursor in `forest` whose id equals `id`, or `undefined`. */
function cursorById<V, K>(
    forest: readonly TreeNode<V, K>[],
    id: K,
): TreeCursor<V, K> | undefined {
    for (const cursor of walkForest(forest)) {
        if (cursor.id === id) return cursor;
    }
    return undefined;
}

/**
 * Append `newChild` to the node at `parentCursor`, returning a new forest.
 * Existing children keep their identity; only the parent and its ancestors are
 * re-allocated.
 *
 * @example
 * ```ts
 * const parent = find(forest[0], (c) => c.id === "menu")!
 * const next = addChild(forest, parent, {id: "help", value: {label: "Help"}, children: []})
 * ```
 */
export function addChild<V, K>(
    forest: readonly TreeNode<V, K>[],
    parentCursor: TreeCursor<V, K>,
    newChild: TreeNode<V, K>,
): TreeNode<V, K>[] {
    return rebuild(forest, parentCursor, (node) => ({
        id: node.id,
        value: node.value,
        children: [...node.children, newChild],
    }));
}

/**
 * Remove the node at `cursor` and its subtree, returning a new forest. Removing
 * a root drops it from the forest, so the result may be shorter — or empty when
 * the removed root was the only tree.
 *
 * @example
 * ```ts
 * const doomed = find(forest[0], (c) => c.id === "c1")!
 * const next = removeNode(forest, doomed)   // c1 and everything under it gone
 * ```
 */
export function removeNode<V, K>(
    forest: readonly TreeNode<V, K>[],
    cursor: TreeCursor<V, K>,
): TreeNode<V, K>[] {
    return rebuild(forest, cursor, () => null);
}

/**
 * Replace only the value at `cursor`, keeping its id and its entire subtree
 * (children stay `===`). The narrowest possible edit.
 *
 * @example
 * ```ts
 * const target = find(forest[0], (c) => c.id === "c1")!
 * const next = updateValue(forest, target, {...target.value, title: "Renamed"})
 * ```
 */
export function updateValue<V, K>(
    forest: readonly TreeNode<V, K>[],
    cursor: TreeCursor<V, K>,
    newValue: V,
): TreeNode<V, K>[] {
    return rebuild(forest, cursor, (node) => ({
        id: node.id,
        value: newValue,
        children: node.children,
    }));
}

/**
 * Replace the whole subtree at `cursor` with `newSubtree` (any id, any shape),
 * returning a new forest. Everything outside the replaced position is shared.
 */
export function replaceSubtree<V, K>(
    forest: readonly TreeNode<V, K>[],
    cursor: TreeCursor<V, K>,
    newSubtree: TreeNode<V, K>,
): TreeNode<V, K>[] {
    return rebuild(forest, cursor, () => newSubtree);
}

/**
 * Move the subtree at `sourceCursor` to become the last child of the node at
 * `targetCursor`, returning a new forest.
 *
 * @throws Error when `targetCursor` is the source itself or lives inside the
 *   source's subtree — that move would splice the tree into a cycle, which no
 *   acyclic node can represent.
 *
 * The source is pruned first; because that re-allocates the source's ancestors,
 * the caller's `targetCursor` may then be stale, so the target is re-located by
 * its (stable) id in the pruned forest before the subtree is re-attached.
 *
 * @example
 * ```ts
 * const src = find(forest[0], (c) => c.id === "c1")!
 * const dst = find(forest[0], (c) => c.id === "c2")!
 * const next = moveNode(forest, src, dst)   // c1 becomes a child of c2
 * ```
 */
export function moveNode<V, K>(
    forest: readonly TreeNode<V, K>[],
    sourceCursor: TreeCursor<V, K>,
    targetCursor: TreeCursor<V, K>,
): TreeNode<V, K>[] {
    const moving = sourceCursor.node;
    if (subtreeContains(moving, targetCursor.node)) {
        throw new Error(
            "tree-kit moveNode: cannot move a node into itself or one of its descendants",
        );
    }

    const pruned = removeNode(forest, sourceCursor);
    const target = cursorById(pruned, targetCursor.id);
    if (target === undefined) {
        throw new Error(
            `tree-kit moveNode: target ${String(targetCursor.id)} is not present in the forest`,
        );
    }
    return addChild(pruned, target, moving);
}

/**
 * A row of {@link flatten}: a node's id, the id of its parent (or `null` at a
 * root), and its payload. This is the structural inverse of the `getId` /
 * `getParentId` accessors {@link buildTreeFromFlat} consumes, so the two round-
 * trip:
 *
 * ```ts
 * const rows = flatten(forest)
 * const again = buildTreeFromFlat(rows, {getId: (r) => r.id, getParentId: (r) => r.parentId})
 * ```
 */
export interface FlatNode<V, K> {
    /** The node's own id. */
    readonly id: K;
    /** The id of the node's parent, or `null` for a root. */
    readonly parentId: K | null;
    /** The node's payload, shared by reference (not cloned). */
    readonly value: V;
}

/**
 * Flatten a forest back to a parent-linked row list, in pre-order so every
 * parent precedes its children (the order {@link buildTreeFromFlat} preserves
 * for siblings when no sort is given).
 *
 * Emitting `{id, parentId, value}` rather than `value & {parentId}` keeps the
 * id explicit — the library never assumes the id lives inside the payload — and
 * works for primitive payloads, which an intersection type cannot express.
 *
 * @example
 * ```ts
 * flatten(forest)
 * //  [{id: "r1", parentId: null, value: …}, {id: "c1", parentId: "r1", value: …}, …]
 * ```
 */
export function flatten<V, K>(forest: readonly TreeNode<V, K>[]): FlatNode<V, K>[] {
    interface Frame {
        node: TreeNode<V, K>;
        parentId: K | null;
    }
    const rows: FlatNode<V, K>[] = [];
    const stack: Frame[] = [];
    // Push roots in reverse so they pop left to right.
    for (let index = forest.length - 1; index >= 0; index -= 1) {
        stack.push({node: forest[index], parentId: null});
    }

    while (stack.length > 0) {
        const {node, parentId} = stack.pop() as Frame;
        rows.push({id: node.id, parentId, value: node.value});
        for (let index = node.children.length - 1; index >= 0; index -= 1) {
            stack.push({node: node.children[index], parentId: node.id});
        }
    }
    return rows;
}

/**
 * A new tree with every value passed through `fn`, keeping structure and ids
 * intact. The tree-shaped counterpart to `Array.prototype.map`; the whole tree
 * is rebuilt (values change at every node), so nothing is shared with the input
 * — pass a single root, or `forest.map((root) => mapValues(root, fn))`.
 *
 * @example
 * ```ts
 * const titles = mapValues(forest[0], (topic) => topic.title)   // TreeNode<string>
 * ```
 */
export function mapValues<V, K, R>(
    node: TreeNode<V, K>,
    fn: (value: V, id: K) => R,
): TreeNode<R, K> {
    return foldNode<V, K, TreeNode<R, K>>(node, (current, children) => ({
        id: current.id,
        value: fn(current.value, current.id),
        children,
    }));
}
