/**
 * Shared test fixtures.
 *
 * The shapes mirror what the library was extracted from: a flat row list keyed
 * by `(id, parentId)` as a backend returns it, and the tree it should become.
 */

import type {TreeNode} from "../src";

/** A flat row as an API delivers it. */
export interface Topic {
    id: string;
    parentId: string | null;
    title: string;
    orderIndex: number;
}

/**
 * Two roots, one of them with two children and one grandchild.
 *
 * Input order and `orderIndex` deliberately disagree for `r1`'s children, so a
 * test can tell "kept input order" apart from "sorted".
 */
export const ROWS: Topic[] = [
    {id: "r1", parentId: null, title: "Root 1", orderIndex: 0},
    {id: "r2", parentId: null, title: "Root 2", orderIndex: 1},
    {id: "c1", parentId: "r1", title: "Child A", orderIndex: 1},
    {id: "c2", parentId: "r1", title: "Child B", orderIndex: 0},
    {id: "g1", parentId: "c2", title: "Grandchild", orderIndex: 0},
];

/** Payload used by the traversal tests. */
export interface Labelled {
    title: string;
}

/**
 * Hand-built tree, so traversal tests do not depend on the builder:
 *
 * ```
 * r
 * |- c1
 * |  \- g1
 * \- c2
 * ```
 */
export const SAMPLE: TreeNode<Labelled> = {
    id: "r",
    value: {title: "Root"},
    children: [
        {
            id: "c1",
            value: {title: "Alpha"},
            children: [{id: "g1", value: {title: "Alpha-1"}, children: []}],
        },
        {id: "c2", value: {title: "Beta"}, children: []},
    ],
};
