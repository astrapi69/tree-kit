/**
 * Copy-on-write editing: every function returns a NEW forest and never
 * touches its input. The part worth seeing live is structural sharing -
 * only the path from the root down to the edit is re-allocated, every
 * untouched subtree keeps its identity (===).
 *
 *   npm run build && node examples/mutations.mjs
 */
import {
    addChild,
    buildTreeFromFlat,
    find,
    flatten,
    isAncestor,
    moveNode,
    walkForest,
} from "../dist/index.js";

const rows = [
    {id: "regal", parentId: null, title: "Regal"},
    {id: "ordner", parentId: null, title: "Ordner Versicherungen"},
    {id: "kiste", parentId: "regal", title: "Kiste Werkzeug"},
];

const forest = buildTreeFromFlat(rows, {
    getId: (row) => row.id,
    getParentId: (row) => row.parentId,
});

const outline = (label, wald) => {
    console.log(label);
    for (const cursor of walkForest(wald)) {
        console.log("  ".repeat(cursor.depth() + 1) + cursor.value.title);
    }
};
outline("before:", forest);

// Move the folder into the shelf - the physical-nesting shape.
const src = find(forest[1], (cursor) => cursor.id === "ordner");
const dst = find(forest[0], (cursor) => cursor.id === "regal");
const moved = moveNode(forest, src, dst);
outline("\nafter moveNode(ordner -> regal):", moved);

// Structural sharing: the untouched Kiste subtree is the SAME object.
const kisteBefore = forest[0].children.find((node) => node.id === "kiste");
const kisteAfter = moved[0].children.find((node) => node.id === "kiste");
console.log("\nuntouched subtree kept its identity:", kisteBefore === kisteAfter);

// A cyclic move throws instead of corrupting the tree.
try {
    const shelf = find(moved[0], (cursor) => cursor.id === "regal");
    const nested = find(moved[0], (cursor) => cursor.id === "ordner");
    moveNode(moved, shelf, nested);
} catch (error) {
    console.log("cycle refused:", error.message);
}

// Queries answer placement questions without walking by hand...
const shelfCursor = find(moved[0], (cursor) => cursor.id === "regal");
const folderCursor = find(moved[0], (cursor) => cursor.id === "ordner");
console.log("isAncestor(regal, ordner):", isAncestor(shelfCursor, folderCursor));

// ...and flatten() closes the circle back to database-shaped rows.
const withNew = addChild(moved, shelfCursor, {
    id: "koffer",
    value: {id: "koffer", title: "Koffer"},
    children: [],
});
console.log(
    "\nflatten() back to rows:",
    flatten(withNew).map((row) => `${row.id}<-${row.parentId ?? "root"}`).join(", "),
);
