import type { Point } from "./Point";
import type { Edge } from "./Edge";
import type { LAV } from "./LAV";
import { Bisector } from "./Bisector";

export class VertexNode {
    private static nextId = 1;
    readonly id: number;

    static resetIds(): void {
        VertexNode.nextId = 1;
    }
    vertex: Point;
    processed = false;
    previous: VertexNode | null = null;
    next: VertexNode | null = null;
    prevEdge: Edge | null = null;
    nextEdge: Edge | null = null;
    bisector: Bisector | null = null;
    time: number = 0; // Time at which this vertex will collapse
    isReflex: boolean = false;
    lav: LAV | null = null;


    constructor(vertex: Point) {
        this.id = VertexNode.nextId++;
        this.vertex = vertex;
    }

    public setEdges(prevEdge: Edge, nextEdge: Edge): void {
        this.prevEdge = prevEdge;
        this.nextEdge = nextEdge;
    }

    public computeBisector(): void {
        if (this.prevEdge && this.nextEdge) {
            this.bisector = new Bisector(this.prevEdge, this.nextEdge);
        }
    }
}
