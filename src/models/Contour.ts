import { Point } from './Point';
import { Edge } from './Edge';
import { crossProduct, sanitizeContour, signedArea } from '../utils/geometryUtils';

export type ContourOrientation = 'outer' | 'hole';

export class Contour {
    vertices: Point[];
    edges: Edge[];
    readonly orientation: ContourOrientation;

    constructor(vertices: Point[], orientation: ContourOrientation) {
        this.orientation = orientation;
        this.vertices = sanitizeContour(vertices);

        if (this.vertices.length >= 3) {
            const area = signedArea(this.vertices);
            const shouldBeCCW = orientation === 'outer';
            if (shouldBeCCW ? area < 0 : area > 0) {
                this.vertices.reverse();
            }
        }

        this.edges = this.createEdges();
    }

    private createEdges(): Edge[] {
        const edges: Edge[] = [];
        const n = this.vertices.length;
        for (let i = 0; i < n; i++) {
            edges.push(new Edge(this.vertices[i], this.vertices[(i + 1) % n]));
        }
        return edges;
    }

    public isReflexVertex(index: number): boolean {
        const n = this.vertices.length;
        if (n < 3) return false;

        const prev = this.vertices[(index - 1 + n) % n];
        const curr = this.vertices[index];
        const next = this.vertices[(index + 1) % n];

        // Material always lies to the left of every directed edge (outer CCW, holes CW),
        // so a reflex vertex is always a right turn.
        return crossProduct(prev, curr, next) < 0;
    }
}
