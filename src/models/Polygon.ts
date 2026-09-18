import { Edge } from "./Edge";
import { Point } from "./Point";
import { crossProduct } from "../utils/geometryUtils";


export class Polygon {
    vertices: Point[];
    edges: Edge[];
    isPositive: boolean = true;
    holes: Point[][] = [];

    constructor(vertices: Point[]) {
        this.vertices = vertices;
        this.edges = this.createEdges();
        this.orientCCW();
        this.isPositive = this.area() > 0;
    }

    private orientCCW(): void {
        const area = this.area();
        if (area < 0) {
            this.vertices.reverse();
            this.edges = this.createEdges();
        }
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

    public reverse(): void {
        this.vertices.reverse();
        this.edges = this.createEdges();
        this.isPositive = !this.isPositive;
    }

    public isReflexVertex(index: number): boolean {
        const n = this.vertices.length;
        if (n < 3) return false;

        const prev = this.vertices[(index - 1 + n) % n];
        const curr = this.vertices[index];
        const next = this.vertices[(index + 1) % n];

        return this.isPositive ?
            crossProduct(prev, curr, next) < 0 :
            crossProduct(prev, curr, next) > 0;
    }

    public getReflexVertices(): Point[] {
        return this.vertices.filter((_, index) => this.isReflexVertex(index));
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
}
