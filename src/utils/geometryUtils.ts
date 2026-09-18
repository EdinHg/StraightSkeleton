import { Point } from "../models/Point";
import { Vector } from "../models/Vector";
import { Edge } from "../models/Edge";
import { EPS } from "../constants";
import type { Polygon } from "../models/Polygon";


export function calculateNormal(start: Point, end: Point): Vector {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const normal = new Vector(-dy, dx);

    return normal.normalize();
}

export function sanitizePolygon(polygon: Polygon): void {
    const vertices = polygon.vertices;
    if (vertices.length < 3) return;

    const cleaned: Point[] = [vertices[0]];
    for (let i = 1; i < vertices.length; i++) {
        const prev = cleaned[cleaned.length - 1];
        const cur = vertices[i];
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        if (Math.sqrt(dx * dx + dy * dy) > EPS) {
            cleaned.push(cur);
        }
    }

    if (cleaned.length > 1) {
        const first = cleaned[0];
        const last = cleaned[cleaned.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) <= EPS) {
            cleaned.pop();
        }
    }

    polygon.vertices.length = 0;
    polygon.vertices.push(...cleaned);
    polygon.edges.length = 0;
    for (let i = 0; i < cleaned.length; i++) {
        const start = cleaned[i];
        const end = cleaned[(i + 1) % cleaned.length];
        polygon.edges.push(new Edge(start, end));
    }
}

export function crossProduct(p1: Point, p2: Point, p3: Point): number {
    return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
}

