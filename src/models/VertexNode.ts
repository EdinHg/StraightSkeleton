import type { Point } from "./Point";
import type { Edge } from "./Edge";
import { Bisector } from "./Bisector";

export class VertexNode {
    vertex: Point;
    processed = false;
    previous: VertexNode | null = null;
    next: VertexNode | null = null;
    prevEdge: Edge | null = null;
    nextEdge: Edge | null = null;
    bisector: Bisector | null = null;
    time: number = 0; // Time at which this vertex will collapse


    constructor(vertex: Point) {
        this.vertex = vertex;
    }

    public setEdges(prevEdge: Edge, nextEdge: Edge): void {
        this.prevEdge = prevEdge;
        this.nextEdge = nextEdge;
    }

    public computeBisector(): void {
        if (this.prevEdge && this.nextEdge) {
            this.bisector = new Bisector(this);
        }
    }
}
