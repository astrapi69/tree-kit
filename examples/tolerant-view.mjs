/**
 * Strict by default, tolerant on request.
 *
 * The rows below carry the two defects a VIEW must survive: a child
 * whose parent was deleted (orphan) and a cycle left by a bad sync.
 * The strict default throws - correct for ingest, where the exception
 * is the bug report. The tolerant mode renders everything: invalid
 * rows become roots.
 *
 *   npm run build && node examples/tolerant-view.mjs
 */
import {buildTreeFromFlat, walkForest} from "../dist/index.js";

const rows = [
    {id: "finance", parentId: null, title: "Finanzen"},
    {id: "bank", parentId: "finance", title: "Bank"},
    // Orphan: its parent category was deleted, the row survived.
    {id: "insurance", parentId: "deleted-parent", title: "Versicherungen"},
    // Cycle: two rows pointing at each other after a broken sync.
    {id: "a", parentId: "b", title: "Zyklus A"},
    {id: "b", parentId: "a", title: "Zyklus B"},
];

const keys = {
    getId: (row) => row.id,
    getParentId: (row) => row.parentId,
};

// Ingest posture: fail loudly, the exception names the offender.
try {
    buildTreeFromFlat(rows, keys);
} catch (error) {
    console.log("strict default:", error.message);
}

// View posture: everything renders, invalid rows become roots.
const forest = buildTreeFromFlat(rows, {
    ...keys,
    onInvalidParent: "promoteToRoot",
});
console.log("\ntolerant view:");
for (const cursor of walkForest(forest)) {
    console.log("  ".repeat(cursor.depth()) + cursor.value.title);
}
