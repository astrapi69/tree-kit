import {describe, expect, it} from "vitest";

import {
    cloneSubtree,
    extractSubtree,
    filterTree,
    find,
    height,
    isAncestor,
    isDescendant,
    lowestCommonAncestor,
    reduceTree,
    rootCursor,
    siblings,
    walkForest,
    type TreeCursor,
    type TreeNode,
} from "../src";

import {SAMPLE, type Labelled} from "./fixtures";

function at<V, K>(node: TreeNode<V, K>, id: K): TreeCursor<V, K> {
    for (const cursor of walkForest([node])) {
        if (cursor.id === id) return cursor;
    }
    throw new Error(`test setup: no node ${String(id)}`);
}

describe("height()", () => {
    it("counts the deepest descent, matching cursor.depth() units", () => {
        expect(height(SAMPLE)).toBe(2); // r -> c1 -> g1
    });

    it("is 0 for a leaf", () => {
        expect(height({id: "x", value: 1, children: []})).toBe(0);
    });

    it("does not overflow on a 50,000-deep chain", () => {
        let node: TreeNode<number> = {id: "d0", value: 0, children: []};
        for (let index = 1; index < 50_000; index += 1) {
            node = {id: `d${index}`, value: index, children: [node]};
        }
        expect(height(node)).toBe(49_999);
    });
});

describe("siblings()", () => {
    it("returns the other children of the same parent, in order", () => {
        expect(siblings(at(SAMPLE, "c1")).map((n) => n.id)).toEqual(["c2"]);
    });

    it("is empty for a root cursor", () => {
        expect(siblings(rootCursor(SAMPLE))).toEqual([]);
    });
});

describe("isAncestor() / isDescendant()", () => {
    it("recognises a proper ancestor", () => {
        expect(isAncestor(rootCursor(SAMPLE), at(SAMPLE, "g1"))).toBe(true);
        expect(isDescendant(at(SAMPLE, "g1"), rootCursor(SAMPLE))).toBe(true);
    });

    it("is not reflexive", () => {
        expect(isAncestor(at(SAMPLE, "c1"), at(SAMPLE, "c1"))).toBe(false);
    });

    it("rejects an unrelated pair", () => {
        expect(isAncestor(at(SAMPLE, "c2"), at(SAMPLE, "g1"))).toBe(false);
    });
});

describe("lowestCommonAncestor()", () => {
    it("finds the nearest shared ancestor of two nodes", () => {
        expect(lowestCommonAncestor(at(SAMPLE, "g1"), at(SAMPLE, "c2"))?.id).toBe("r");
    });

    it("returns the ancestor itself when one contains the other", () => {
        expect(lowestCommonAncestor(at(SAMPLE, "c1"), at(SAMPLE, "g1"))?.id).toBe("c1");
    });

    it("is null across two separate roots", () => {
        const other: TreeNode<Labelled> = {id: "o", value: {title: "O"}, children: []};
        expect(lowestCommonAncestor(at(SAMPLE, "g1"), rootCursor(other))).toBeNull();
    });
});

describe("extractSubtree()", () => {
    it("returns the node as a standalone, still-shared tree", () => {
        const sub = extractSubtree(at(SAMPLE, "c1"));
        expect(sub).toBe(SAMPLE.children[0]);
        expect(sub.children[0].id).toBe("g1");
    });
});

describe("cloneSubtree()", () => {
    it("deep-copies values so the clone is independent", () => {
        const clone = cloneSubtree(SAMPLE);
        expect(clone).not.toBe(SAMPLE);
        expect(clone.children[0].value).not.toBe(SAMPLE.children[0].value);
        expect(clone.children[0].value).toEqual(SAMPLE.children[0].value);
    });

    it("remaps ids so a duplicate can coexist with the original", () => {
        const clone = cloneSubtree(SAMPLE, (id) => `${id}-copy`);
        expect(clone.id).toBe("r-copy");
        expect(clone.children[0].children[0].id).toBe("g1-copy");
    });
});

describe("reduceTree()", () => {
    it("folds all values into one accumulator", () => {
        const total = reduceTree(
            {id: "a", value: 1, children: [{id: "b", value: 2, children: [{id: "c", value: 3, children: []}]}]},
            (sum, value) => sum + value,
            0,
        );
        expect(total).toBe(6);
    });

    it("collects ids in the chosen traversal order", () => {
        const ids = reduceTree(SAMPLE, (acc: string[], _value, id) => [...acc, String(id)], [], "post");
        expect(ids).toEqual(["g1", "c1", "c2", "r"]);
    });
});

describe("filterTree()", () => {
    it("keeps matching nodes and prunes the rest", () => {
        const kept = filterTree(SAMPLE, (node) => node.id !== "g1");
        expect(kept).toHaveLength(1);
        expect(find(kept[0], (c) => c.id === "g1")).toBeUndefined();
        expect(find(kept[0], (c) => c.id === "c1")).toBeDefined();
    });

    it("reparents survivors when an intermediate node is dropped", () => {
        // Drop c1 but keep its child g1: g1 should be promoted under the root.
        const kept = filterTree(SAMPLE, (node) => node.id !== "c1");
        expect(kept).toHaveLength(1);
        expect(kept[0].children.map((n) => n.id)).toEqual(["g1", "c2"]);
    });

    it("returns a forest when a root is dropped but children survive", () => {
        const kept = filterTree(SAMPLE, (node) => node.id !== "r");
        // c1 (with g1) and c2 are promoted to roots.
        expect(kept.map((n) => n.id)).toEqual(["c1", "c2"]);
        expect(find(kept[0], (c) => c.id === "g1")).toBeDefined();
    });

    it("can empty the forest entirely", () => {
        expect(filterTree(SAMPLE, () => false)).toEqual([]);
    });
});
