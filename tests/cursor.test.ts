import {describe, expect, it} from "vitest";

import {displayValue, find, rootCursor, walk} from "../src";

import {SAMPLE} from "./fixtures";

describe("cursor navigation", () => {
    it("exposes id and value as shorthands for the node", () => {
        const cursor = rootCursor(SAMPLE);

        expect(cursor.id).toBe("r");
        expect(cursor.value.title).toBe("Root");
        expect(cursor.node).toBe(SAMPLE);
    });

    it("reports root and leaf correctly", () => {
        const root = rootCursor(SAMPLE);

        expect(root.isRoot()).toBe(true);
        expect(root.isLeaf()).toBe(false);

        const leaf = find(SAMPLE, (cursor) => cursor.id === "g1");
        expect(leaf?.isRoot()).toBe(false);
        expect(leaf?.isLeaf()).toBe(true);
    });

    it("returns direct children only", () => {
        expect(
            rootCursor(SAMPLE)
                .children()
                .map((child) => String(child.id)),
        ).toEqual(["c1", "c2"]);
    });

    it("walks up to the parent and stops at null", () => {
        const grandchild = find(SAMPLE, (cursor) => cursor.id === "g1");

        expect(grandchild?.parent()?.id).toBe("c1");
        expect(grandchild?.parent()?.parent()?.id).toBe("r");
        expect(grandchild?.parent()?.parent()?.parent()).toBeNull();
    });

    it("builds the path from the root down to and including itself", () => {
        const grandchild = find(SAMPLE, (cursor) => cursor.id === "g1");

        expect(grandchild?.path().map((node) => node.id)).toEqual(["r", "c1", "g1"]);
    });

    it("reports the sibling position, and 0 at a root", () => {
        const root = rootCursor(SAMPLE);
        const [first, second] = root.children();

        expect(first.childIndex()).toBe(0);
        expect(second.childIndex()).toBe(1);
        expect(root.childIndex()).toBe(0);
    });
});

describe("cursor identity", () => {
    it("siblings share one parent cursor instance", () => {
        // The defect this library was extracted to fix: the old wrapper
        // allocated a fresh parent on every call, so this was false and
        // Set membership / memo dependencies silently broke.
        const [first, second] = rootCursor(SAMPLE).children();

        expect(first.parent()).toBe(second.parent());
    });

    it("repeated children() calls return the same cursor instances", () => {
        const root = rootCursor(SAMPLE);

        expect(root.children()[0]).toBe(root.children()[0]);
    });

    it("keeps node identity stable across independent traversals", () => {
        const first = find(SAMPLE, (cursor) => cursor.id === "g1");
        const second = find(SAMPLE, (cursor) => cursor.id === "g1");

        // Cursors from two separate walks are distinct objects, but they
        // point at the very same node - so compare nodes, not cursors.
        expect(first?.node).toBe(second?.node);
    });

    it("nodes are usable as Set members and Map keys", () => {
        const seen = new Set([...walk(SAMPLE)].map((cursor) => cursor.node));

        expect(seen.size).toBe(4);
        expect(seen.has(SAMPLE.children[0])).toBe(true);
    });
});

describe("displayValue()", () => {
    it("uses the formatter when given", () => {
        expect(displayValue(SAMPLE, (value) => value.title)).toBe("Root");
    });

    it("falls back to String(value) so a missing formatter is obvious", () => {
        expect(displayValue(SAMPLE)).toBe("[object Object]");
    });

    it("renders a primitive payload without a formatter", () => {
        expect(displayValue({id: "n", value: 42, children: []})).toBe("42");
    });
});
