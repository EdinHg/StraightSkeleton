import { Point } from './models/Point';
import { Polygon } from './models/Polygon';
import { LAV } from './models/LAV';
import { BisectorIntersection } from './models/BisectorIntersection';
import type { StraightSkeletonResult } from './models/StraightSkeletonResult';
import FlatQueue from 'flatqueue';
import { VertexNode } from './models/VertexNode';
import { EPS } from './constants';
import { sanitizePolygon } from './utils/geometryUtils';

function computeScale(polygon: Polygon): number {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const v of polygon.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
    }
    return Math.max(1, Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2));
}

export function computeStraightSkeleton(polygon: Polygon): StraightSkeletonResult | null {
    const result: StraightSkeletonResult = {
        edges: [],
        polygonHistory: []
    };
    const queue = new FlatQueue<number>();
    const polygonHistory: Polygon[] = [];

    polygon.orientCCW();
    sanitizePolygon(polygon);

    if (polygon.vertices.length < 3) return null;

    const scale = computeScale(polygon);
    const TIME_EPSILON = EPS * scale;

    const lav = new LAV(polygon);
    const head = lav.node;
    let current = head;
    const intersections: BisectorIntersection[] = [];

    const registerIntersection = (nodeA: VertexNode | null, nodeB: VertexNode | null) => {
        if (!nodeA || !nodeB || nodeA.processed || nodeB.processed) return;

        const intersection = new BisectorIntersection(nodeA, nodeB);

        if (!intersection.isValid || !Number.isFinite(intersection.distance)) return;

        const currentTime = Math.max(nodeA.time, nodeB.time);

        if (intersection.distance < currentTime - TIME_EPSILON) return;

        intersections.push(intersection);
        queue.push(intersections.length - 1, intersection.distance);
    };

    do {
        registerIntersection(current, current!.next);
        current = current!.next;
    } while (current !== head);


    while (queue.length > 0) {
        const intersectionId = queue.pop();
        if (intersectionId === undefined) continue;
        const intersection = intersections[intersectionId];

        // 1. Skip if already processed or invalid
        if (
            !intersection || 
            intersection.nodeA.processed || 
            intersection.nodeB.processed
        ) continue;

        intersection.nodeA.processed = true;
        intersection.nodeB.processed = true;

        // Add the two edges for the vertices that are merging
        result.edges.push(
            { 
                source: intersection.nodeA.vertex,
                target: intersection.intersectionPoint,
                leftEdge: intersection.nodeA.prevEdge ?? null,
                rightEdge: intersection.nodeA.nextEdge ?? null,
                timeSource: intersection.nodeA.time,
                timeTarget: intersection.distance
            },
            { 
                source: intersection.nodeB.vertex,
                target: intersection.intersectionPoint,
                leftEdge: intersection.nodeB.prevEdge ?? null,
                rightEdge: intersection.nodeB.nextEdge ?? null,
                timeSource: intersection.nodeB.time,
                timeTarget: intersection.distance
            }
        );

        const prevNode = intersection.nodeA.previous!;
        const nextNode = intersection.nodeB.next!;

        // FIX 1 & 2: Peak Event (3 vertices shrinking to 1 point)
        // If the node before A is the same as the node after B, we have a triangle collapsing.
        if (prevNode === nextNode) {
            result.edges.push({
                source: prevNode.vertex,
                target: intersection.intersectionPoint,
                leftEdge: prevNode.prevEdge ?? null,
                rightEdge: prevNode.nextEdge ?? null,
                timeSource: prevNode.time,
                timeTarget: intersection.distance
            });
            prevNode.processed = true;
            // Add the final collapsed point to the history
            polygonHistory.push(new Polygon([intersection.intersectionPoint]));
            break; // The polygon has fully collapsed
        }

        // FIX 3: Linked list management
        const newNode = new VertexNode(intersection.intersectionPoint);
        newNode.time = intersection.distance;
        newNode.setEdges(
            intersection.nodeA.prevEdge!,
            intersection.nodeB.nextEdge!
        );

        // Splice the new node into the circular linked list
        prevNode.next = newNode;
        newNode.previous = prevNode;
        nextNode.previous = newNode;
        newNode.next = nextNode;

        newNode.computeBisector();

        // Check for new potential edge events
        registerIntersection(prevNode, newNode);
        registerIntersection(newNode, nextNode);

        // FIX 4: Only record polygon history if there are no more simultaneous events.
        // This prevents capturing deformed polygons when multiple edges collapse at the exact same millisecond.
        const nextEventId = queue.peek();
        const nextEvent = nextEventId !== undefined ? intersections[nextEventId] : null;
        if (!nextEvent || Math.abs(nextEvent.distance - intersection.distance) > TIME_EPSILON) {
            const currentPolygonVertices: Point[] = [];
            let tempNode = newNode;
            do {
                const timeElapsed = intersection.distance - (tempNode.time ?? 0);
                const bisector = tempNode.bisector;

                if (bisector) {
                    const newX = tempNode.vertex.x + bisector.velocity.x * timeElapsed;
                    const newY = tempNode.vertex.y + bisector.velocity.y * timeElapsed;
                    currentPolygonVertices.push(new Point(newX, newY));
                } else {
                    currentPolygonVertices.push(tempNode.vertex);
                }

                tempNode = tempNode.next!;
            } while (tempNode !== newNode);

            polygonHistory.push(new Polygon(currentPolygonVertices));
        }
    }

    result.polygonHistory = polygonHistory;
    return result;
}
