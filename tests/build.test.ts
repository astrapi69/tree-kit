import {describe, expect, it} from "vitest";

import {buildTreeFromFlat, count, find} from "../src";

import {ROWS, type Topic} from "./fixtures";

const KEYS = {
    getId: (row: Topic) => row.id,
    getParentId: (row: Topic) => row.parentId,
};

describe("buildTreeFromFlat()", () => {
    it("builds a forest preserving input order when no sort is given", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, KEYS);

        expect(forest).toHaveLength(2);
        expect(forest.map((root) => root.id)).toEqual(["r1", "r2"]);
        expect(forest[0].children.map((child) => child.id)).toEqual(["c1", "c2"]);
    });

    it("sorts siblings at every level via the comparator", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, {
            ...KEYS,
            sort: (a, b) => a.orderIndex - b.orderIndex,
        });

        // orderIndex: c2=0 sorts ahead of c1=1.
        expect(forest[0].children.map((child) => child.id)).toEqual(["c2", "c1"]);
    });

    it("sorts the roots too", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, {
            ...KEYS,
            sort: (a, b) => b.orderIndex - a.orderIndex,
        });

        expect(forest.map((root) => root.id)).toEqual(["r2", "r1"]);
    });

    it("returns an empty forest for empty input", () => {
        expect(buildTreeFromFlat<Topic, string>([], KEYS)).toEqual([]);
    });

    it("treats an undefined parent id as a root", () => {
        const rows = [{id: "solo", title: "Solo"}];
        const forest = buildTreeFromFlat<(typeof rows)[number], string>(rows, {
            getId: (row) => row.id,
            getParentId: () => undefined,
        });

        expect(forest.map((root) => root.id)).toEqual(["solo"]);
    });

    it("rejects duplicate ids loudly", () => {
        const rows: Topic[] = [
            {id: "x", parentId: null, title: "first", orderIndex: 0},
            {id: "x", parentId: null, title: "dup", orderIndex: 1},
        ];

        expect(() => buildTreeFromFlat<Topic, string>(rows, KEYS)).toThrow(/duplicate id x/);
    });

    it("rejects unknown parent references loudly", () => {
        const rows: Topic[] = [{id: "c", parentId: "missing", title: "orphan", orderIndex: 0}];

        expect(() => buildTreeFromFlat<Topic, string>(rows, KEYS)).toThrow(
            /unknown parent missing/,
        );
    });

    it("rejects cycles", () => {
        // a -> b -> c -> a: every row has a parent, so there is no root at all
        // and nothing is reachable.
        const rows: Topic[] = [
            {id: "a", parentId: "c", title: "a", orderIndex: 0},
            {id: "b", parentId: "a", title: "b", orderIndex: 0},
            {id: "c", parentId: "b", title: "c", orderIndex: 0},
        ];

        expect(() => buildTreeFromFlat<Topic, string>(rows, KEYS)).toThrow(/cycle or orphan/);
    });

    it("names the unreachable ids in the cycle error", () => {
        const rows: Topic[] = [
            {id: "root", parentId: null, title: "root", orderIndex: 0},
            {id: "a", parentId: "b", title: "a", orderIndex: 0},
            {id: "b", parentId: "a", title: "b", orderIndex: 0},
        ];

        expect(() => buildTreeFromFlat<Topic, string>(rows, KEYS)).toThrow(/unreachable=a,b/);
    });

    it("supports number ids", () => {
        const rows = [
            {id: 1, parentId: null as number | null, label: "root"},
            {id: 2, parentId: 1 as number | null, label: "child"},
        ];
        const forest = buildTreeFromFlat<(typeof rows)[number], number>(rows, {
            getId: (row) => row.id,
            getParentId: (row) => row.parentId,
        });

        expect(forest).toHaveLength(1);
        expect(find(forest[0], (cursor) => cursor.id === 2)?.value.label).toBe("child");
    });

    it("builds a single deep chain with correct depth and path", () => {
        const rows: Topic[] = [
            {id: "a", parentId: null, title: "a", orderIndex: 0},
            {id: "b", parentId: "a", title: "b", orderIndex: 0},
            {id: "c", parentId: "b", title: "c", orderIndex: 0},
            {id: "d", parentId: "c", title: "d", orderIndex: 0},
        ];
        const forest = buildTreeFromFlat<Topic, string>(rows, KEYS);

        expect(forest).toHaveLength(1);
        const leaf = find(forest[0], (cursor) => cursor.id === "d");
        expect(leaf?.depth()).toBe(3);
        expect(leaf?.path().map((node) => node.id)).toEqual(["a", "b", "c", "d"]);
    });

    it("is linear in the number of rows for a wide tree", () => {
        // 50k rows would be minutes under an O(n^2) parent lookup and is
        // instant under the Map index. The assertion is on correctness; the
        // guard against a quadratic regression is that this test finishes.
        const wide: Topic[] = [{id: "root", parentId: null, title: "root", orderIndex: 0}];
        for (let index = 0; index < 50_000; index += 1) {
            wide.push({
                id: `n${index}`,
                parentId: "root",
                title: `n${index}`,
                orderIndex: index,
            });
        }

        const forest = buildTreeFromFlat<Topic, string>(wide, KEYS);

        expect(forest[0].children).toHaveLength(50_000);
        expect(count(forest[0])).toBe(50_001);
    });

    it("handles a chain deeper than the call stack", () => {
        // 50k levels. A recursive builder, sorter or traversal would throw
        // "Maximum call stack size exceeded" here; every pass is iterative.
        const deep: Topic[] = [{id: "d0", parentId: null, title: "d0", orderIndex: 0}];
        for (let index = 1; index < 50_000; index += 1) {
            deep.push({
                id: `d${index}`,
                parentId: `d${index - 1}`,
                title: `d${index}`,
                orderIndex: 0,
            });
        }

        const forest = buildTreeFromFlat<Topic, string>(deep, {
            ...KEYS,
            sort: (a, b) => a.orderIndex - b.orderIndex,
        });

        expect(count(forest[0])).toBe(50_000);
        const leaf = find(forest[0], (cursor) => cursor.isLeaf());
        expect(leaf?.id).toBe("d49999");
        expect(leaf?.depth()).toBe(49_999);
    });
});

describe("buildTreeFromFlat() with onInvalidParent: 'promoteToRoot'", () => {
    interface Row {
        id: string;
        parentId: string | null;
        pos?: number;
    }
    const options = {
        getId: (row: Row) => row.id,
        getParentId: (row: Row) => row.parentId,
        onInvalidParent: "promoteToRoot" as const,
    };

    it("promotes a row with an unknown parent to a root", () => {
        // Real-world shape (Topos categoryTree): a category can outlive
        // its parent; the child becomes a root, the data still renders.
        const forest = buildTreeFromFlat<Row, string>(
            [
                {id: "a", parentId: null},
                {id: "waise", parentId: "geloescht"},
            ],
            options,
        );
        expect(forest.map((node) => node.id).sort()).toEqual(["a", "waise"]);
    });

    it("promotes cycle members instead of throwing", () => {
        // Real-world shape (Topos inventoryTree): corrupted data must
        // render, not crash the only view that could show it.
        const forest = buildTreeFromFlat<Row, string>(
            [
                {id: "a", parentId: "b"},
                {id: "b", parentId: "a"},
            ],
            options,
        );
        expect(forest.map((node) => node.id).sort()).toEqual(["a", "b"]);
    });

    it("promotes a row whose ancestor chain never reaches a root", () => {
        // c hangs under a cycle: its chain never terminates either.
        const forest = buildTreeFromFlat<Row, string>(
            [
                {id: "a", parentId: "b"},
                {id: "b", parentId: "a"},
                {id: "c", parentId: "a"},
            ],
            options,
        );
        expect(forest.map((node) => node.id).sort()).toEqual(["a", "b", "c"]);
    });

    it("keeps valid nesting intact alongside promotions", () => {
        const forest = buildTreeFromFlat<Row, string>(
            [
                {id: "root", parentId: null},
                {id: "kind", parentId: "root"},
                {id: "waise", parentId: "fehlt"},
            ],
            options,
        );
        const root = forest.find((node) => node.id === "root");
        expect(root?.children.map((child) => child.id)).toEqual(["kind"]);
        expect(forest.map((node) => node.id).sort()).toEqual(["root", "waise"]);
    });

    it("still rejects duplicate ids - that is corruption, not degradable", () => {
        expect(() =>
            buildTreeFromFlat<Row, string>(
                [
                    {id: "a", parentId: null},
                    {id: "a", parentId: null},
                ],
                options,
            ),
        ).toThrow(/duplicate id/);
    });

    it("sorts promoted roots together with the real ones", () => {
        const forest = buildTreeFromFlat<Row, string>(
            [
                {id: "b", parentId: "fehlt", pos: 2},
                {id: "a", parentId: null, pos: 1},
            ],
            {...options, sort: (x, y) => (x.pos ?? 0) - (y.pos ?? 0)},
        );
        expect(forest.map((node) => node.id)).toEqual(["a", "b"]);
    });

    it("default stays 'throw' - existing callers see no change", () => {
        expect(() =>
            buildTreeFromFlat<Row, string>([{id: "a", parentId: "fehlt"}], {
                getId: (row) => row.id,
                getParentId: (row) => row.parentId,
            }),
        ).toThrow(/unknown parent/);
    });
});
