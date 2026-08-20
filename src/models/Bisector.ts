import { VertexNode } from "./VertexNode";
import { Vector } from "./Vector";
import { EPS } from "../constants";


export class Bisector {
    vertex: VertexNode;
    velocity: Vector;

    constructor(vertexNode: VertexNode) {
        this.vertex = vertexNode;

        const normal1 = vertexNode.prevEdge!.normal;
        const normal2 = vertexNode.nextEdge!.normal;

        const sum = normal1.add(normal2);
        const dotProd = 1 + normal1.dot(normal2);
        if (dotProd < EPS) {
            this.velocity = new Vector(-normal1.y, normal1.x).normalize();
        } else {
            this.velocity = sum.divide(dotProd);
        }
    }
}
