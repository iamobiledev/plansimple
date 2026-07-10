import { describe, it, expect } from "vitest";
import * as Y from "yjs";

/**
 * CRDT converge proof without browsers: two docs exchange updates and end identical.
 */
describe("Yjs markup map converge", () => {
  it("two clients converge to identical markup state", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const map1 = doc1.getMap("markups");
    const map2 = doc2.getMap("markups");

    doc1.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on("update", (update: Uint8Array) => {
      Y.applyUpdate(doc1, update);
    });

    map1.set("a", { id: "a", type: "cloud", subject: "from-1" });
    map2.set("b", { id: "b", type: "rectangle", subject: "from-2" });
    // concurrent edit same key — last-writer-wins on Y.Map values, both docs same
    map1.set("c", { id: "c", type: "line", subject: "c1" });
    map2.set("c", { id: "c", type: "line", subject: "c2" });

    const dump = (doc: Y.Doc) => {
      const m = doc.getMap("markups");
      const out: Record<string, unknown> = {};
      m.forEach((v, k) => {
        out[k] = v;
      });
      return out;
    };

    expect(dump(doc1)).toEqual(dump(doc2));
    expect(Object.keys(dump(doc1)).sort()).toEqual(["a", "b", "c"]);
  });
});
