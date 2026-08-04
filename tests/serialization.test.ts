/**
 * The reason the parent pointer lives on the cursor and not on the node.
 *
 * These are the properties a parent-pointer design cannot have. If any of them
 * regresses, the architectural decision behind this library has been undone -
 * so they are pinned, not assumed.
 */

import {describe, expect, it} from "vitest";

import {buildTreeFromFlat, count, walk} from "../src";

import {ROWS, SAMPLE, type Topic} from "./fixtures";

describe("nodes stay serialisable", () => {
    it("survives JSON.stringify - no circular structure", () => {
        expect(() => JSON.stringify(SAMPLE)).not.toThrow();
    });

    it("round-trips through JSON without losing structure", () => {
        const restored = JSON.parse(JSON.stringify(SAMPLE)) as typeof SAMPLE;

        expect(count(restored)).toBe(count(SAMPLE));
        expect([...walk(restored)].map((cursor) => String(cursor.id))).toEqual(
            [...walk(SAMPLE)].map((cursor) => String(cursor.id)),
        );
    });

    it("survives structuredClone - no functions, no cycles", () => {
        // structuredClone is stricter than JSON: it throws on functions rather
        // than dropping them silently. A [Symbol.iterator] method on the node
        // would fail here, which is why iteration lives on the cursor.
        expect(() => structuredClone(SAMPLE)).not.toThrow();

        const cloned = structuredClone(SAMPLE);
        expect(cloned).not.toBe(SAMPLE);
        expect(count(cloned)).toBe(4);
    });

    it("holds for a built forest too, not just a hand-written tree", () => {
        const forest = buildTreeFromFlat<Topic, string>(ROWS, {
            getId: (row) => row.id,
            getParentId: (row) => row.parentId,
        });

        expect(() => JSON.stringify(forest)).not.toThrow();
        expect(() => structuredClone(forest)).not.toThrow();
    });

    it("carries no own properties beyond id, value and children", () => {
        // A stray method or back-reference would show up here before it shows
        // up as a clone failure in a consumer.
        for (const cursor of walk(SAMPLE)) {
            expect(Object.keys(cursor.node).sort()).toEqual(["children", "id", "value"]);
        }
    });
});
