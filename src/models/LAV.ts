import { Polygon } from "./Polygon";
import { VertexNode } from "./VertexNode";

export class LAV {
    node: VertexNode | null = null;

    constructor(polygon: Polygon) {
        const { edges, vertices } = polygon;
        const n = vertices.length;

        if (n === 0) return;

        // 1. Instantiation and edge assignment
        const nodes = vertices.map((vertex, i) => {
            const node = new VertexNode(vertex);
            const prevEdge = edges[i === 0 ? n - 1 : i - 1];
            const nextEdge = edges[i];
            node.setEdges(prevEdge, nextEdge);
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

        this.node = nodes[0];
    }
}
