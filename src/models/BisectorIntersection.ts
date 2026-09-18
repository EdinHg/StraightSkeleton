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
        if (!this.nodeA.bisector || !this.nodeB.bisector) {
            return;
        }

        const v1 = this.nodeA.bisector!.velocity;
        const v2 = this.nodeB.bisector!.velocity;

        const p1 = this.nodeA.vertex;
        const p2 = this.nodeB.vertex;
        const tA = this.nodeA.time ?? 0;
        const tB = this.nodeB.time ?? 0;
        const dx = (p2.x - p1.x) + tA * v1.x - tB * v2.x;
        const dy = (p2.y - p1.y) + tA * v1.y - tB * v2.y;
        const D = new Vector(dx, dy);
        const denom = v1.cross(v2);

        const parallelThreshold = EPS * v1.length() * v2.length();
        if (Math.abs(denom) < parallelThreshold) {
            const relativeVelocity = v1.subtract(v2);
            const relativeSpeedSq = relativeVelocity.dot(relativeVelocity);
            if (relativeSpeedSq < EPS * EPS || Math.abs(D.cross(relativeVelocity)) > EPS * Math.max(1, D.length() * relativeVelocity.length())) {
                this._isValid = false;
                return;
            }

            this.distance = D.dot(relativeVelocity) / relativeSpeedSq;
            if (!Number.isFinite(this.distance) || this.distance < Math.max(tA, tB) - EPS) {
                this._isValid = false;
                return;
            }
            this.intersectionPoint = new Point(
                p1.x + (this.distance - tA) * v1.x,
                p1.y + (this.distance - tA) * v1.y
            );
            this._isValid = true;
            return;
        }

        const t = D.cross(v2) / denom;
        this.distance = t;

        if (!Number.isFinite(t)) {
            this._isValid = false;
            return;
        }

        const earliestTime = Math.max(tA, tB);
        if (t < earliestTime - EPS) {
            this._isValid = false;
            return;
        }

        this.intersectionPoint = new Point(
            p1.x + (t - tA) * v1.x,
            p1.y + (t - tA) * v1.y
        );

        this._isValid = true;
    }

    public get isValid(): boolean {
        return this._isValid;
    }
}
