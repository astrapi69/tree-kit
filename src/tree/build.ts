/**
 * Flat-to-tree construction.
 *
 * Rows from a database or an API arrive flat, keyed by `(id, parentId)`. This
 * turns them into a forest in O(n): one pass to index every row by id, one
 * pass to link each row into its parent with an O(1) lookup. Searching the
 * array for each parent instead would be O(n^2).
 *
 * Every structural defect fails loudly. A silent drop of unlinkable rows hides
 * the backend bug that produced them, and the symptom then surfaces much later
 * as "some items are missing from the tree".
 */

import type {TreeNode} from "../types/tree";

/**
 * Mutable counterpart of {@link TreeNode}, used only inside this module.
 *
 * `TreeNode.children` is `readonly` so consumers cannot corrupt a built tree,
 * but construction has to push children and sort siblings in place. Building
 * on a mutable shape and widening to the readonly one at the end keeps both
 * true, at zero runtime cost — `readonly` is compile-time only.
 */
interface MutableNode<V, K> {
    id: K;
    value: V;
    children: MutableNode<V, K>[];
}

/**
 * Configuration for {@link buildTreeFromFlat}.
 */
export interface BuildTreeOptions<V, K> {
    /** Extract the row's own id. */
    getId: (value: V) => K;
    /** Extract the row's parent id, or `null`/`undefined` for a root. */
    getParentId: (value: V) => K | null | undefined;
    /**
     * Sibling comparator, applied at every level including the roots.
     * Receives the raw payload rather than the wrapping node, so callers can
     * use field accessors directly. Omit to keep input order.
     */
    sort?: (a: V, b: V) => number;
}

/**
 * Build a forest of {@link TreeNode}s from a flat row list.
 *
 * Returns an array because a flat list may legitimately contain several roots;
 * no synthetic root is invented. When exactly one root is expected,
 * `buildTreeFromFlat(rows, options)[0]` is the canonical access.
 *
 * @throws Error when two rows share an id — one would otherwise silently
 *   overwrite the other in the index.
 * @throws Error when a row names a parent id that no row provides.
 * @throws Error when rows form a cycle, so they are unreachable from any root.
 *
 * @example
 * ```ts
 * interface Topic { id: string; parentId: string | null; title: string; pos: number }
 *
 * const forest = buildTreeFromFlat<Topic, string>(rows, {
 *   getId: (row) => row.id,
 *   getParentId: (row) => row.parentId,
 *   sort: (a, b) => a.pos - b.pos,
 * })
 * ```
 */
export function buildTreeFromFlat<V, K>(
    rows: readonly V[],
    options: BuildTreeOptions<V, K>,
): TreeNode<V, K>[] {
    const {getId, getParentId, sort} = options;

    const nodesById = indexRows(rows, getId);
    const roots = linkChildren(rows, nodesById, getId, getParentId);
    assertFullyReachable(roots, nodesById);
    if (sort) sortForest(roots, sort);

    return roots;
}

/** Pass 1: one node shell per row, indexed by id. Rejects duplicate ids. */
function indexRows<V, K>(
    rows: readonly V[],
    getId: (value: V) => K,
): Map<K, MutableNode<V, K>> {
    const nodesById = new Map<K, MutableNode<V, K>>();
    for (const value of rows) {
        const id = getId(value);
        if (nodesById.has(id)) {
            throw new Error(`buildTreeFromFlat: duplicate id ${String(id)}`);
        }
        nodesById.set(id, {id, value, children: []});
    }
    return nodesById;
}

/**
 * Pass 2: attach every non-root shell to its parent, collecting the roots.
 * Rejects unknown parent references and any row attached twice.
 */
function linkChildren<V, K>(
    rows: readonly V[],
    nodesById: Map<K, MutableNode<V, K>>,
    getId: (value: V) => K,
    getParentId: (value: V) => K | null | undefined,
): MutableNode<V, K>[] {
    const attached = new Set<K>();
    const roots: MutableNode<V, K>[] = [];

    for (const value of rows) {
        const id = getId(value);
        const parentId = getParentId(value);
        const node = nodesById.get(id) as MutableNode<V, K>;

        if (parentId === null || parentId === undefined) {
            roots.push(node);
            continue;
        }
        const parent = nodesById.get(parentId);
        if (parent === undefined) {
            throw new Error(
                `buildTreeFromFlat: row ${String(id)} references unknown parent ${String(parentId)}`,
            );
        }
        if (attached.has(id)) {
            throw new Error(`buildTreeFromFlat: row ${String(id)} attached twice (cycle?)`);
        }
        attached.add(id);
        parent.children.push(node);
    }

    return roots;
}

/**
 * Pass 3: every row must be reachable from some root. A row that is not is
 * either in a cycle (`a -> b -> c -> a` has no root at all) or orphaned.
 */
function assertFullyReachable<V, K>(
    roots: readonly MutableNode<V, K>[],
    nodesById: Map<K, MutableNode<V, K>>,
): void {
    if (nodesById.size === 0) return;

    const reachable = new Set<K>();
    const pending: MutableNode<V, K>[] = [...roots];
    while (pending.length > 0) {
        const node = pending.pop() as MutableNode<V, K>;
        if (reachable.has(node.id)) {
            throw new Error(`buildTreeFromFlat: cycle detected at ${String(node.id)}`);
        }
        reachable.add(node.id);
        for (const child of node.children) pending.push(child);
    }

    if (reachable.size === nodesById.size) return;

    const unreachable: K[] = [];
    for (const id of nodesById.keys()) {
        if (!reachable.has(id)) unreachable.push(id);
    }
    throw new Error(
        `buildTreeFromFlat: cycle or orphan rows detected. unreachable=${unreachable
            .map((id) => String(id))
            .join(",")}`,
    );
}

/**
 * Pass 4: order siblings at every level, roots included.
 *
 * Iterative rather than recursive so a deep chain cannot overflow the call
 * stack on input the rest of the builder handles fine.
 */
function sortForest<V, K>(
    roots: MutableNode<V, K>[],
    sort: (a: V, b: V) => number,
): void {
    const bySibling = (a: MutableNode<V, K>, b: MutableNode<V, K>): number =>
        sort(a.value, b.value);

    roots.sort(bySibling);
    const pending: MutableNode<V, K>[] = [...roots];
    while (pending.length > 0) {
        const node = pending.pop() as MutableNode<V, K>;
        node.children.sort(bySibling);
        for (const child of node.children) pending.push(child);
    }
}
