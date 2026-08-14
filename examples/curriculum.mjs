/**
 * The happy path: build a curriculum tree from flat database-shaped
 * rows, walk it with cursors, serialise it.
 *
 *   npm run build && node examples/curriculum.mjs
 */
import {buildTreeFromFlat, count, find, walkForest} from "../dist/index.js";

const rows = [
    {id: "math", parentId: null, title: "Mathematik", position: 1},
    {id: "algebra", parentId: "math", title: "Algebra", position: 1},
    {id: "geometry", parentId: "math", title: "Geometrie", position: 2},
    {id: "linear", parentId: "algebra", title: "Lineare Gleichungen", position: 1},
    {id: "physics", parentId: null, title: "Physik", position: 2},
];

const forest = buildTreeFromFlat(rows, {
    getId: (row) => row.id,
    getParentId: (row) => row.parentId,
    sort: (a, b) => a.position - b.position,
});

// Indented outline via cursor traversal - depth() needs no parent
// pointer on the node.
for (const cursor of walkForest(forest)) {
    console.log("  ".repeat(cursor.depth()) + cursor.value.title);
}

// Cursors answer position questions: breadcrumb for a nested node.
const linear = find(forest[0], (cursor) => cursor.value.id === "linear");
console.log(
    "\nBreadcrumb:",
    linear
        .path()
        .map((node) => node.value.title)
        .join(" > "),
);
console.log("Nodes under Mathematik:", count(forest[0]));

// TreeNode is pure data: serialising just works, no cycles, no methods.
const json = JSON.stringify(forest);
console.log("Serialised bytes:", json.length);
