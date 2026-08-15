import {describe, expect, it} from "vitest";

import {
    addChild,
    buildTreeFromFlat,
    count,
    find,
    flatten,
    mapValues,
    moveNode,
    removeNode,
    replaceSubtree,
    rootCursor,
    updateValue,
    walkForest,
    type TreeCursor,
    type TreeNode,
} from "../src";

import {ROWS, SAMPLE, type Topic} from "./fixtures";

const KEYS = {
    getId: (row: Topic) => row.id,
    getParentId: (row: Topic) => row.parentId,
};

/** Cursor for the node with `id` anywhere in `forest`, or a hard failure. */
function at<V, K>(forest: readonly TreeNode<V, K>[], id: K): TreeCursor<V, K> {
    for (const cursor of walkForest(forest)) {
        if (cursor.id === id) return cursor;
    }
    throw new Error(`test setup: no node ${String(id)}`);
}

describe("addChild()", () => {
    it("appends a child to the target node", () => {
        const forest = [SAMPLE];
        const next = addChild(forest, at(forest, "c2"), {
            id: "c2a",
            value: {title: "New"},
            children: [],
        });

        expect(find(next[0], (c) => c.id === "c2")?.node.children.map((n) => n.id)).toEqual([
            "c2a",
        ]);
    });

    it("does not mutate the input tree", () => {
        const forest = [SAMPLE];
        addChild(forest, at(forest, "c2"), {id: "x", value: {title: "X"}, children: []});

        expect(SAMPLE.children[1].children).toHaveLength(0);
    });

    it("shares untouched sibling subtrees by identity", () => {
        const forest = [SAMPLE];
        const next = addChild(forest, at(forest, "c1"), {
            id: "c1b",
            value: {title: "B"},
            children: [],
        });

        // c2 is off the edited path, so it is the very same object.
        expect(next[0].children[1]).toBe(SAMPLE.children[1]);
        // The root and c1 are on the path, so they are fresh objects.
        expect(next[0]).not.toBe(SAMPLE);
        expect(next[0].children[0]).not.toBe(SAMPLE.children[0]);
    });
});

describe("updateValue()", () => {
    it("changes only the target value and keeps its subtree shared", () => {
        const forest = [SAMPLE];
        const c1 = at(forest, "c1");
        const next = updateValue(forest, c1, {title: "Renamed"});

        expect(find(next[0], (c) => c.id === "c1")?.value.title).toBe("Renamed");
        // g1 sits under c1 but is untouched, so it keeps its identity.
        expect(find(next[0], (c) => c.id === "c1")?.node.children[0]).toBe(SAMPLE.children[0].children[0]);
    });

    it("updating a leaf leaves every sibling shared", () => {
        const forest = [SAMPLE];
        const next = updateValue(forest, at(forest, "g1"), {title: "changed"});

        expect(next[0].children[1]).toBe(SAMPLE.children[1]); // c2 untouched
        expect(find(next[0], (c) => c.id === "g1")?.value.title).toBe("changed");
        expect(SAMPLE.children[0].children[0].value.title).toBe("Alpha-1"); // input intact
    });
});

describe("removeNode()", () => {
    it("removes a node and its subtree", () => {
        const forest = [SAMPLE];
        const next = removeNode(forest, at(forest, "c1"));

        expect(next[0].children.map((n) => n.id)).toEqual(["c2"]);
        expect(find(next[0], (c) => c.id === "g1")).toBeUndefined();
    });

    it("drops a root from the forest, leaving the other roots shared", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, KEYS);
        const next = removeNode(forest, at(forest, "r1"));

        expect(next.map((n) => n.id)).toEqual(["r2"]);
        expect(next[0]).toBe(forest[1]); // r2 untouched
    });

    it("returns an empty forest when the only root is removed", () => {
        const next = removeNode([SAMPLE], rootCursor(SAMPLE));
        expect(next).toEqual([]);
    });
});

describe("replaceSubtree()", () => {
    it("swaps the whole subtree at the cursor", () => {
        const forest = [SAMPLE];
        const fresh: TreeNode<{title: string}> = {
            id: "c1new",
            value: {title: "Fresh"},
            children: [{id: "leaf", value: {title: "Leaf"}, children: []}],
        };
        const next = replaceSubtree(forest, at(forest, "c1"), fresh);

        expect(next[0].children[0]).toBe(fresh);
        expect(next[0].children[1]).toBe(SAMPLE.children[1]); // c2 shared
    });
});

describe("moveNode()", () => {
    it("reparents the source subtree under the target", () => {
        const forest = [SAMPLE];
        const next = moveNode(forest, at(forest, "c1"), at(forest, "c2"));

        // c1 left the root's children and became c2's child.
        expect(next[0].children.map((n) => n.id)).toEqual(["c2"]);
        expect(find(next[0], (c) => c.id === "c2")?.node.children.map((n) => n.id)).toEqual([
            "c1",
        ]);
        // The moved subtree keeps its own descendants.
        expect(find(next[0], (c) => c.id === "g1")).toBeDefined();
    });

    it("can move a node up to become a child of its former grandparent", () => {
        const forest = [SAMPLE];
        // g1 currently sits under c1; move it up to become a child of the root.
        const next = moveNode(forest, at(forest, "g1"), rootCursor(forest[0]));
        expect(next[0].children.map((n) => n.id)).toEqual(["c1", "c2", "g1"]);
        expect(find(next[0], (c) => c.id === "c1")?.isLeaf()).toBe(true);
    });

    it("throws when moving a node into its own descendant", () => {
        const forest = [SAMPLE];
        expect(() => moveNode(forest, at(forest, "c1"), at(forest, "g1"))).toThrow(
            /into itself or one of its descendants/,
        );
    });

    it("throws when moving a node into itself", () => {
        const forest = [SAMPLE];
        expect(() => moveNode(forest, at(forest, "c1"), at(forest, "c1"))).toThrow(
            /into itself/,
        );
    });
});

describe("cursor / forest guards", () => {
    it("throws when the cursor does not belong to the forest", () => {
        const other: TreeNode<{title: string}> = {id: "z", value: {title: "Z"}, children: []};
        expect(() =>
            addChild([SAMPLE], rootCursor(other), {id: "q", value: {title: "Q"}, children: []}),
        ).toThrow(/does not belong to the given forest/);
    });
});

describe("serializability of mutated trees", () => {
    it("stays JSON- and structuredClone-safe after edits", () => {
        const forest = [SAMPLE];
        const next = addChild(forest, at(forest, "c2"), {
            id: "c2a",
            value: {title: "New"},
            children: [],
        });

        expect(() => JSON.stringify(next)).not.toThrow();
        expect(() => structuredClone(next)).not.toThrow();
        expect(structuredClone(next)[0].children[1].children[0].id).toBe("c2a");
    });
});

describe("deep-tree safety", () => {
    // A recursive rebuild would overflow here; the spine walk is iterative.
    function deepChain(levels: number): TreeNode<number> {
        let node: TreeNode<number> = {id: "d0", value: 0, children: []};
        for (let index = 1; index < levels; index += 1) {
            node = {id: `d${index}`, value: index, children: [node]};
        }
        return node;
    }

    it("mutates the leaf of a 50,000-deep chain without overflowing", () => {
        const forest = [deepChain(50_000)];
        const leaf = at(forest, "d0");

        const next = updateValue(forest, leaf, -1);
        expect(find(next[0], (c) => c.id === "d0")?.value).toBe(-1);
        expect(count(next[0])).toBe(50_000);
    });

    it("maps values over a 50,000-deep chain", () => {
        const deep = deepChain(50_000);
        const mapped = mapValues(deep, (value) => value * 2);
        expect(find(mapped, (c) => c.id === "d0")?.value).toBe(0);
        expect(mapped.value).toBe((50_000 - 1) * 2);
    });
});

describe("mapValues()", () => {
    it("transforms values while preserving structure and ids", () => {
        const titles = mapValues(SAMPLE, (value) => value.title.toUpperCase());

        expect(titles.value).toBe("ROOT");
        expect(titles.children.map((n) => n.id)).toEqual(["c1", "c2"]);
        expect(titles.children[0].children[0].value).toBe("ALPHA-1");
    });

    it("passes the id alongside the value", () => {
        const labelled = mapValues(SAMPLE, (value, id) => `${String(id)}:${value.title}`);
        expect(labelled.value).toBe("r:Root");
        expect(labelled.children[0].value).toBe("c1:Alpha");
    });
});

describe("flatten()", () => {
    it("is the inverse of buildTreeFromFlat", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, KEYS);
        const rows = flatten(forest);
        const rebuilt = buildTreeFromFlat(rows, {
            getId: (r) => r.id,
            getParentId: (r) => r.parentId,
        });

        expect(rebuilt.map((n) => n.id)).toEqual(forest.map((n) => n.id));
        expect(count(rebuilt[0])).toBe(count(forest[0]));
    });

    it("emits parents before children and marks roots with parentId null", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, KEYS);
        const rows = flatten(forest);

        expect(rows.map((r) => r.id)).toEqual(["r1", "c1", "c2", "g1", "r2"]);
        expect(rows.filter((r) => r.parentId === null).map((r) => r.id)).toEqual(["r1", "r2"]);
        expect(rows.find((r) => r.id === "g1")?.parentId).toBe("c2");
    });

    it("flattens an empty forest to an empty array", () => {
        expect(flatten([])).toEqual([]);
    });

    it("flattens a multi-root forest across all roots", () => {
        const rows = flatten([SAMPLE, {id: "solo", value: {title: "Solo"}, children: []}]);
        expect(rows.map((r) => r.id)).toEqual(["r", "c1", "g1", "c2", "solo"]);
        expect(rows[rows.length - 1]).toEqual({id: "solo", parentId: null, value: {title: "Solo"}});
    });

    it("preserves a primitive payload that an intersection type could not", () => {
        const rows = flatten([{id: "n", value: 42, children: []}]);
        expect(rows).toEqual([{id: "n", parentId: null, value: 42}]);
    });
});
