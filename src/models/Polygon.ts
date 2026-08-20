import { Edge } from "./Edge";
import { Point } from "./Point";
import { EPS } from "../constants";


export class Polygon {
    vertices: Point[];
    edges: Edge[];

    constructor(vertices: Point[]) {
        this.vertices = vertices;
        this.edges = this.createEdges();
    }

    public orientCCW(): void {
        const area = this.area();
        if (area < 0) {
            this.vertices.reverse();
        }
        this.edges = this.createEdges();
    }

    public area(): number {
        let area = 0;

        for (let i = 0; i < this.vertices.length; i++) {
            const currentVertex = this.vertices[i];
            const nextVertex = this.vertices[(i + 1) % this.vertices.length];

            area += currentVertex.x * nextVertex.y - nextVertex.x * currentVertex.y;
        }

        return area / 2;
    }

    private createEdges(): Edge[] {
        const edges: Edge[] = [];

        for (let i = 0; i < this.vertices.length; i++) {
            const startVertex = this.vertices[i];
            const endVertex = this.vertices[(i + 1) % this.vertices.length];

            edges.push(new Edge(startVertex, endVertex));
        }

        return edges;
    }

    public getVertices(): Point[] {
        return this.vertices;
    }

    public getEdges(): Edge[] {
        return this.edges;
    }

    public isConvex(): boolean {
        const n = this.vertices.length;

        if (n < 4) {
            return true;
        }

        let sign = 0;

        for (let i = 0; i < n; i++) {
            const dx1 = this.vertices[(i + 2) % n].x - this.vertices[(i + 1) % n].x;
            const dy1 = this.vertices[(i + 2) % n].y - this.vertices[(i + 1) % n].y;
            const dx2 = this.vertices[i].x - this.vertices[(i + 1) % n].x;
            const dy2 = this.vertices[i].y - this.vertices[(i + 1) % n].y;

            const zCrossProduct = dx1 * dy2 - dy1 * dx2;

            if (Math.abs(zCrossProduct) > EPS) {
                if (sign === 0) {
                    sign = zCrossProduct > 0 ? 1 : -1;
                } else if ((zCrossProduct > 0 ? 1 : -1) !== sign) {
                    return false;
                }
            }
        }

        return true;
    }
}
