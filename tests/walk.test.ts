import {describe, expect, it} from "vitest";

import {
    count,
    find,
    findAll,
    rootCursor,
    walk,
    walkForest,
    type TraversalStrategy,
} from "../src";

import {SAMPLE, type Labelled} from "./fixtures";

const idsOf = (strategy?: TraversalStrategy): string[] =>
    [...walk(SAMPLE, strategy)].map((cursor) => String(cursor.id));

describe("walk()", () => {
    it("visits parents before children in pre-order", () => {
        expect(idsOf()).toEqual(["r", "c1", "g1", "c2"]);
    });

    it("defaults to pre-order", () => {
        expect(idsOf()).toEqual(idsOf("pre"));
    });

    it("visits children before parents in post-order", () => {
        expect(idsOf("post")).toEqual(["g1", "c1", "c2", "r"]);
    });

    it("visits one level at a time in breadth-first order", () => {
        expect(idsOf("breadth")).toEqual(["r", "c1", "c2", "g1"]);
    });

    it("stops on break without visiting the rest", () => {
        // The generator replaces the Visitor pattern's "return false to halt".
        const seen: string[] = [];
        for (const cursor of walk(SAMPLE)) {
            seen.push(String(cursor.id));
            if (cursor.id === "c1") break;
        }

        expect(seen).toEqual(["r", "c1"]);
    });

    it("is lazy - nothing is traversed until the generator is consumed", () => {
        const steps = walk(SAMPLE);

        expect(steps.next().value?.id).toBe("r");
        expect(steps.next().value?.id).toBe("c1");
        // The remaining two nodes have not been touched yet.
        expect([...steps].map((cursor) => String(cursor.id))).toEqual(["g1", "c2"]);
    });

    it("reports the correct depth for every node", () => {
        const depths = Object.fromEntries(
            [...walk(SAMPLE)].map((cursor) => [String(cursor.id), cursor.depth()]),
        );

        expect(depths).toEqual({r: 0, c1: 1, g1: 2, c2: 1});
    });
});

describe("walkForest()", () => {
    const forest = [SAMPLE, {id: "r2", value: {title: "Second"}, children: []}];

    it("finishes each root's subtree before the next in pre-order", () => {
        expect([...walkForest<Labelled, string>(forest)].map((each) => String(each.id))).toEqual([
            "r",
            "c1",
            "g1",
            "c2",
            "r2",
        ]);
    });

    it("synchronises levels across roots in breadth-first order", () => {
        // Both roots first, then everything at depth 1, then depth 2.
        expect(
            [...walkForest<Labelled, string>(forest, "breadth")].map((each) => String(each.id)),
        ).toEqual(["r", "r2", "c1", "c2", "g1"]);
    });

    it("yields nothing for an empty forest", () => {
        expect([...walkForest<Labelled, string>([])]).toEqual([]);
    });
});

describe("find() / findAll() / count()", () => {
    it("find() returns the first pre-order match", () => {
        expect(find(SAMPLE, (cursor) => cursor.value.title.startsWith("Alpha"))?.id).toBe("c1");
    });

    it("find() honours the traversal strategy", () => {
        // In post-order the grandchild comes first.
        expect(
            find(SAMPLE, (cursor) => cursor.value.title.startsWith("Alpha"), "post")?.id,
        ).toBe("g1");
    });

    it("find() returns undefined when nothing matches", () => {
        expect(find(SAMPLE, (cursor) => cursor.id === "missing")).toBeUndefined();
    });

    it("find() stops at the first match instead of walking the whole tree", () => {
        const inspected: string[] = [];
        find(SAMPLE, (cursor) => {
            inspected.push(String(cursor.id));
            return cursor.id === "c1";
        });

        expect(inspected).toEqual(["r", "c1"]);
    });

    it("findAll() returns every match in traversal order", () => {
        const matches = findAll(SAMPLE, (cursor) => cursor.value.title.startsWith("Alpha"));

        expect(matches.map((cursor) => String(cursor.id))).toEqual(["c1", "g1"]);
    });

    it("findAll() returns an empty array when nothing matches", () => {
        expect(findAll(SAMPLE, () => false)).toEqual([]);
    });

    it("count() includes the root", () => {
        expect(count(SAMPLE)).toBe(4);
        expect(count({id: "solo", value: {title: "Solo"}, children: []})).toBe(1);
    });
});

describe("cursor iteration", () => {
    it("a cursor is directly iterable in pre-order", () => {
        const cursor = rootCursor(SAMPLE);

        expect([...cursor].map((each) => String(each.id))).toEqual(["r", "c1", "g1", "c2"]);
    });

    it("iterating a nested cursor covers only its subtree", () => {
        const c1 = find(SAMPLE, (cursor) => cursor.id === "c1");

        expect([...c1!].map((each) => String(each.id))).toEqual(["c1", "g1"]);
    });

    it("a nested cursor keeps its depth relative to the original root", () => {
        const c1 = find(SAMPLE, (cursor) => cursor.id === "c1");

        // Iterating from c1 does not re-root it: it is still at depth 1.
        expect([...c1!].map((each) => each.depth())).toEqual([1, 2]);
    });
});
