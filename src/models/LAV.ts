import { Contour } from "./Contour";
import { VertexNode } from "./VertexNode";

export class LAV {
    node!: VertexNode;

    private constructor() {}

    static fromContour(contour: Contour): LAV {
        const lav = new LAV();
        const { edges, vertices } = contour;
        const n = vertices.length;

        if (n === 0) throw new Error("Contour has no vertices.");

        // 1. Instantiation and edge assignment
        const nodes = vertices.map((vertex, i) => {
            const node = new VertexNode(vertex);
            const prevEdge = edges[i === 0 ? n - 1 : i - 1];
            const nextEdge = edges[i];
            node.setEdges(prevEdge, nextEdge);
            node.isReflex = contour.isReflexVertex(i);
            node.lav = lav;
            return node;
        });

        // 2. Establish circular doubly linked pointers
        for (let i = 0; i < n; i++) {
            nodes[i].previous = nodes[(i - 1 + n) % n];
            nodes[i].next = nodes[(i + 1) % n];
        }

        // 3. Compute bisectors once links are fully wired
        for (const node of nodes) {
            if (node.prevEdge && node.nextEdge) {
                node.computeBisector();
            }
        }

        lav.node = nodes[0];
        return lav;
    }

    static fromChain(head: VertexNode): LAV {
        const lav = new LAV();
        lav.node = head;

        let current = head;
        do {
            current.lav = lav;
            current = current.next!;
        } while (current && current !== head);

        return lav;
    }
}
