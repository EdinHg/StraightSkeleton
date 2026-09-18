import { Polygon } from "./Polygon";
import { Point } from "./Point";
import { Edge } from "./Edge";
import type { VertexNode } from "./VertexNode";


export interface SkeletonEdge {
    source: Point;
    target: Point;
    leftEdge: Edge | null; // Index of the left edge in the original polygon
    rightEdge: Edge | null; // Index of the right edge in the original polygon
    timeSource: number; // Wavefront time t at source vertex
    timeTarget: number; // Wavefront time t at target vertex
}

export interface StraightSkeletonResult {
    edges: Partial<SkeletonEdge>[];          // All interior skeleton line segments
    polygonHistory: Polygon[] | null;      // For animation pu
    nodes: VertexNode[];                  // All vertex nodes created during computation
}
