import { Point } from "./Point";
import { Vector } from "./Vector";
import { VertexNode } from "./VertexNode";
import { EPS } from "../constants";

export class BisectorIntersection {
    nodeA: VertexNode;
    nodeB: VertexNode;
    intersectionPoint: Point = new Point(0, 0);
    distance: number = Infinity;
    private _isValid: boolean = false;

    constructor(nodeA: VertexNode, nodeB: VertexNode) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.compute();
    }

    private compute(): void {
        const v1 = this.nodeA.bisector!.velocity;
        const v2 = this.nodeB.bisector!.velocity;

        const denom = v1.cross(v2);

        const parallelThreshold = EPS * v1.length() * v2.length();
        if (Math.abs(denom) < parallelThreshold) {
            this._isValid = false;
            return;
        }

        const p1 = this.nodeA.vertex;
        const p2 = this.nodeB.vertex;
        const tA = this.nodeA.time ?? 0;
        const tB = this.nodeB.time ?? 0;

        const dx = (p2.x - p1.x) + tA * v1.x - tB * v2.x;
        const dy = (p2.y - p1.y) + tA * v1.y - tB * v2.y;
        const D = new Vector(dx, dy);

        const t = D.cross(v2) / denom;
        this.distance = t;

        if (!Number.isFinite(t)) {
            this._isValid = false;
            return;
        }

        this.intersectionPoint = new Point(
            p1.x + (t - tA) * v1.x,
            p1.y + (t - tA) * v1.y
        );

        const dir1 = new Vector(this.intersectionPoint.x - p1.x, this.intersectionPoint.y - p1.y);
        const dir2 = new Vector(this.intersectionPoint.x - p2.x, this.intersectionPoint.y - p2.y);

        this._isValid = dir1.dot(v1) > 0 && dir2.dot(v2) > 0;
    }

    public get isValid(): boolean {
        return this._isValid;
    }
}
