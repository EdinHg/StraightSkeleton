import { Vector } from "./Vector";
import { Edge } from "./Edge";
import { EPS } from "../constants";


export class Bisector {
    velocity: Vector;

    constructor(leftEdge: Edge, rightEdge: Edge) {
        const normal1 = leftEdge.normal;
        const normal2 = rightEdge.normal;

        const sum = normal1.add(normal2);
        const dotProd = 1 + normal1.dot(normal2);
        if (dotProd < EPS) {
            this.velocity = new Vector(-normal1.y, normal1.x).normalize();
        } else {
            this.velocity = sum.divide(dotProd);
        }
    }
}
