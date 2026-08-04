/**
 * Typed ids.
 *
 * `K` exists so ids from two different trees cannot silently cross. That is a
 * compile-time property, so the runtime assertions here are thin on purpose:
 * what the file really pins is that the branded type SURVIVES construction,
 * traversal and cursor navigation instead of being widened back to `string`
 * somewhere in the chain. The annotated assignments below are the actual
 * assertion - they stop compiling if a return type loses the brand.
 */

import {describe, expect, it} from "vitest";

import {buildTreeFromFlat, find, rootCursor, walk, type TreeNode} from "../src";

type TopicId = string & {readonly __brand: "TopicId"};

const asTopicId = (raw: string): TopicId => raw as TopicId;

interface Topic {
    title: string;
}

const TREE: TreeNode<Topic, TopicId> = {
    id: asTopicId("r"),
    value: {title: "Root"},
    children: [
        {
            id: asTopicId("c"),
            value: {title: "Child"},
            children: [{id: asTopicId("g"), value: {title: "Grandchild"}, children: []}],
        },
    ],
};

describe("branded ids", () => {
    it("survives find() - the cursor's id is still branded", () => {
        const found = find(TREE, (cursor) => cursor.id === asTopicId("c"));

        const id: TopicId = found!.id;
        expect(id).toBe("c");
    });

    it("survives walk() - every yielded cursor keeps the brand", () => {
        const ids: TopicId[] = [...walk(TREE)].map((cursor) => cursor.id);

        expect(ids).toEqual(["r", "c", "g"]);
    });

    it("survives path() and parent() navigation", () => {
        const grandchild = find(TREE, (cursor) => cursor.id === asTopicId("g"));

        const pathIds: TopicId[] = grandchild!.path().map((node) => node.id);
        const parentId: TopicId = grandchild!.parent()!.id;

        expect(pathIds).toEqual(["r", "c", "g"]);
        expect(parentId).toBe("c");
    });

    it("survives children() from a root cursor", () => {
        const childId: TopicId = rootCursor(TREE).children()[0].id;

        expect(childId).toBe("c");
    });

    it("survives buildTreeFromFlat()", () => {
        const rows = [
            {id: asTopicId("a"), parentId: null, title: "a"},
            {id: asTopicId("b"), parentId: asTopicId("a"), title: "b"},
        ];

        const forest = buildTreeFromFlat<(typeof rows)[number], TopicId>(rows, {
            getId: (row) => row.id,
            getParentId: (row) => row.parentId,
        });

        const rootId: TopicId = forest[0].id;
        expect(rootId).toBe("a");
        expect(forest[0].children[0].id).toBe("b");
    });

    it("supports a numeric K without a cast", () => {
        const numeric: TreeNode<Topic, number> = {
            id: 1,
            value: {title: "Root"},
            children: [{id: 2, value: {title: "Child"}, children: []}],
        };

        const childId: number = find(numeric, (cursor) => cursor.id === 2)!.id;
        expect(childId).toBe(2);
    });
});
