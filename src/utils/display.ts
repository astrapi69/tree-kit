/**
 * Label helpers.
 *
 * A formatter is a rendering concern, so it is passed in at call time rather
 * than stored on the tree. Storing it would put a function onto a value object
 * that has to stay `structuredClone`-able.
 */

import type {DisplayFormatter, TreeNode} from "../types/tree";

/**
 * Human-readable label for a node.
 *
 * Falls back to `String(value)` when no formatter is given, which renders a
 * plain object as `[object Object]` on purpose: the default is honest rather
 * than helpful, so a missing formatter is obvious in the UI instead of quietly
 * printing something plausible.
 *
 * @example
 * ```ts
 * displayValue(node, (topic) => topic.title)   // "Introduction"
 * displayValue(node)                           // "[object Object]"
 * ```
 */
export function displayValue<V, K>(
    node: TreeNode<V, K>,
    formatter?: DisplayFormatter<V>,
): string {
    return formatter ? formatter(node.value) : String(node.value);
}
