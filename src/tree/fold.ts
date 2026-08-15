/**
 * Bottom-up rebuild.
 *
 * `foldNode` is the one place that turns a subtree into a value by combining
 * each node with its already-computed children. `mapValues`, `filterTree` and
 * `cloneSubtree` are all this fold with a different `combine` — so they share a
 * single stack-safe traversal instead of each re-deriving one.
 *
 * Iterative on an explicit stack, never recursive: the whole library treats a
 * 50,000-deep chain as ordinary input (see the builder and traversal tests), so
 * a fold that recursed would be the one operation that overflows where the rest
 * hold. Children are folded left to right; a parent is combined only once all
 * of its children have produced their result.
 */

import type {TreeNode} from "../types/tree";

/**
 * Fold a subtree bottom-up. `combine(node, childResults)` is called for every
 * node after all of its children have been folded, with their results in order.
 *
 * @internal
 */
export function foldNode<V, K, R>(
    root: TreeNode<V, K>,
    combine: (node: TreeNode<V, K>, childResults: R[]) => R,
): R {
    interface Frame {
        node: TreeNode<V, K>;
        results: R[];
        next: number;
    }
    const stack: Frame[] = [{node: root, results: [], next: 0}];
    let carried: R | undefined;
    let hasCarried = false;

    while (stack.length > 0) {
        const frame = stack[stack.length - 1];

        // A child that just finished hands its result up to this parent.
        if (hasCarried) {
            frame.results.push(carried as R);
            hasCarried = false;
        }

        if (frame.next < frame.node.children.length) {
            const child = frame.node.children[frame.next];
            frame.next += 1;
            stack.push({node: child, results: [], next: 0});
            continue;
        }

        // All children folded: combine, pop, and carry the result to the parent.
        stack.pop();
        carried = combine(frame.node, frame.results);
        hasCarried = true;
    }

    // The root is the last node to combine, so its result is what remains.
    return carried as R;
}
