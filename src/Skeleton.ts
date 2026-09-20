import { Point } from './models/Point';
import { Edge } from './models/Edge';
import { Polygon } from './models/Polygon';
import { LAV } from './models/LAV';
import { SLAV } from './models/SLAV';
import { BisectorIntersection } from './models/BisectorIntersection';
import type { StraightSkeletonResult } from './models/StraightSkeletonResult';
import FlatQueue from 'flatqueue';
import { VertexNode } from './models/VertexNode';
import { EPS } from './constants';

export const DEBUG = false;

function debug(...args: unknown[]): void {
    if (DEBUG) console.debug('[SS]', ...args);
}

export type EdgeEvent = { type: 'edge'; time: number; point: Point; nodeA: VertexNode; nodeB: VertexNode; };
export type SplitEvent = { type: 'split'; time: number; point: Point; node: VertexNode; edgeStartNode: VertexNode; splitEdge: Edge; };
export type SkeletonEvent = EdgeEvent | SplitEvent;

export class Skeleton {
    polygon: Polygon;
    result?: StraightSkeletonResult;
    queue?: FlatQueue<number>;
    events?: SkeletonEvent[];
    private slav?: SLAV;
    private nodes: VertexNode[] = []; // Historical list for the final result
    private nodeDependentEdges = new Map<VertexNode, Set<Edge>>(); // reflex node -> edges whose holder changes affect it
    private edgeDependents = new Map<Edge, Set<VertexNode>>(); // edge -> reflex nodes affected by its holder change
    timeEpsilon = 0;
    private pointEpsilon = 0;
    private currentTime = 0;

    constructor(polygon: Polygon) {
        this.polygon = polygon;
        this._initialize();
    }

    private _initialize() {
        this.queue = new FlatQueue<number>();
        this.events = [];
        this.nodes = [];
        this.slav = new SLAV();
        this.currentTime = 0;
        this.nodeDependentEdges.clear();
        this.edgeDependents.clear();
        this.result = { edges: [], nodes: [], polygonHistory: null };
    }

    private isValidEdgeEvent(event: EdgeEvent): boolean {
        return event.time >= this.currentTime - this.timeEpsilon &&
               !event.nodeA.processed && !event.nodeB.processed && 
               event.nodeA.next === event.nodeB && event.nodeB.previous === event.nodeA;
    }

    private isValidSplitEvent(event: SplitEvent): boolean {
        const { node, edgeStartNode, splitEdge, time, point } = event;
        const edgeEndNode = edgeStartNode.next;
        
        if (node.processed || edgeStartNode.processed || !edgeEndNode || edgeEndNode.processed ||
            edgeStartNode.nextEdge !== splitEdge || splitEdge === node.prevEdge || splitEdge === node.nextEdge ||
            edgeStartNode === node.previous || edgeEndNode === node ||
            time < this.currentTime - this.timeEpsilon ||
            time < Math.max(node.time, edgeStartNode.time, edgeEndNode.time) - this.timeEpsilon) {
            return false;
        }

        const currentEvent = calculateSplitIntersection(node, splitEdge, edgeStartNode, this.timeEpsilon);
        return !!currentEvent && 
               Math.abs(currentEvent.time - time) <= this.timeEpsilon &&
               currentEvent.point.distanceTo(point) <= this.pointEpsilon &&
               isSplitInRegion(currentEvent, currentEvent.time, edgeStartNode, edgeEndNode, this.pointEpsilon);
    }

    private processCluster(cluster: SkeletonEvent[]): void {
        const splits = cluster.filter((e): e is SplitEvent => e.type === 'split');
        const edges = cluster.filter((e): e is EdgeEvent => e.type === 'edge' && this.isValidEdgeEvent(e));
        const edgeNodes = new Set<VertexNode>(edges.flatMap(e => [e.nodeA, e.nodeB]));

        if (edgeNodes.size > 0) {
            const chains: VertexNode[][] = [];
            const visited = new Set<VertexNode>();

            for (const node of edgeNodes) {
                if (visited.has(node)) continue;

                let startNode = node;
                while (edgeNodes.has(startNode.previous!) && !visited.has(startNode.previous!)) {
                    startNode = startNode.previous!;
                    if (startNode === node) break;
                }

                const chain: VertexNode[] = [];
                let curr = startNode;
                do {
                    chain.push(curr);
                    visited.add(curr);
                    curr = curr.next!;
                } while (edgeNodes.has(curr) && curr !== startNode && !visited.has(curr));

                chains.push(chain);
            }

            const { point, time } = cluster[0];
            const affectedEdges = new Set<Edge>();

            for (const chain of chains) {
                for (const node of chain) {
                    this.markProcessed(node);
                    this.addEdge(node, point, time);
                }

                const prev = chain[0].previous!;
                const next = chain[chain.length - 1].next!;

                if (chain[0].prevEdge) affectedEdges.add(chain[0].prevEdge);
                for (const node of chain) if (node.nextEdge) affectedEdges.add(node.nextEdge);

                if (prev === chain[chain.length - 1] || next === chain[0]) continue; // Total collapse

                if (prev === next) {
                    if (!prev.processed) {
                        this.markProcessed(prev);
                        this.addEdge(prev, point, time);
                    }
                } else {
                    const newNode = this.createNode(point, time, chain[0].prevEdge!, chain[chain.length - 1].nextEdge!);
                    newNode.lav = prev.lav;
                    this.linkNodes(prev, newNode, next);
                    this.pushNextNodeEvents(newNode);
                }
            }
            this.pruneEmptyLavs();
            this.recomputeAffectedSplitEvents(affectedEdges);
        }

        for (const split of splits) {
            if (this.isValidSplitEvent(split)) this.processSplitEvent(split);
        }
    }

    private processSplitEvent(event: SplitEvent): void {
        const { node, edgeStartNode, point, time, splitEdge } = event;
        const edgeEndNode = edgeStartNode.next!;
        const nodeLav = node.lav;
        const edgeLav = edgeStartNode.lav;

        this.markProcessed(node);
        this.addEdge(node, point, time);

        const v1 = this.createNode(point, time, node.prevEdge!, splitEdge);
        const v2 = this.createNode(point, time, splitEdge, node.nextEdge!);

        this.linkNodes(node.previous!, v1, edgeEndNode);
        this.linkNodes(edgeStartNode, v2, node.next!);

        if (nodeLav && edgeLav) {
            this.slav!.remove(nodeLav);
            if (nodeLav === edgeLav) {
                // Same contour: the split divides it into two chains.
                this.addChainOrCollapse(v1);
                this.addChainOrCollapse(v2);
            } else {
                // Opposite edge belongs to another contour (e.g. a hole): the
                // split merges the two LAVs into a single chain.
                this.slav!.remove(edgeLav);
                this.addChainOrCollapse(v1);
            }
        }

        this.pushNextNodeEvents(v1);
        this.pushNextNodeEvents(v2);

        const affectedEdges = new Set<Edge>([node.prevEdge!, splitEdge, node.nextEdge!, edgeStartNode.prevEdge!]);
        this.recomputeAffectedSplitEvents(affectedEdges);
    }

    /**
     * Adds a freshly created chain as a new LAV. Chains with two or fewer
     * vertices are already degenerate (the contour collapsed into a line at the
     * event point), so they are collapsed immediately instead of generating
     * further events — mirroring polyskel's `handle_split_event`.
     */
    private addChainOrCollapse(head: VertexNode): void {
        const nodes = this.collectChain(head);

        if (nodes.length > 2) {
            this.slav!.add(LAV.fromChain(head));
            return;
        }

        if (nodes.length === 2) {
            const [a, b] = nodes;
            if (!a.processed) {
                this.markProcessed(a);
                this.addEdge(a, b.vertex, b.time);
            }
            if (!b.processed) {
                this.markProcessed(b);
            }
            return;
        }

        for (const node of nodes) {
            if (!node.processed) this.markProcessed(node);
        }
    }

    private collectChain(head: VertexNode): VertexNode[] {
        const nodes: VertexNode[] = [];
        const seen = new Set<VertexNode>();
        let current: VertexNode | null = head;

        while (current && !seen.has(current)) {
            seen.add(current);
            nodes.push(current);
            current = current.next;
            if (current === head) break;
        }

        return nodes;
    }

    private pruneEmptyLavs(): void {
        if (!this.slav) return;
        for (let i = this.slav.lavs.length - 1; i >= 0; i--) {
            if (this.isLavDead(this.slav.lavs[i])) {
                this.slav.remove(this.slav.lavs[i]);
            }
        }
    }

    private isLavDead(lav: LAV): boolean {
        const head = lav.node;
        let current: VertexNode | null = head;
        const visited = new Set<VertexNode>();

        while (current && !visited.has(current)) {
            if (!current.processed) return false;
            visited.add(current);
            current = current.next;
        }
        return true;
    }

    // Helper to streamline node creation and caching
    private createNode(point: Point, time: number, prevEdge: Edge, nextEdge: Edge): VertexNode {
        const node = new VertexNode(point);
        node.time = time;
        node.setEdges(prevEdge, nextEdge);
        node.computeBisector();
        
        const cross = prevEdge.normal.cross(nextEdge.normal);
        node.isReflex = cross < 0;

        this.nodes.push(node);
        return node;
    }

    private markProcessed(node: VertexNode): void {
        node.processed = true;
        const deps = this.nodeDependentEdges.get(node);
        if (deps) {
            for (const edge of deps) {
                const set = this.edgeDependents.get(edge);
                if (set) {
                    set.delete(node);
                    if (set.size === 0) this.edgeDependents.delete(edge);
                }
            }
            this.nodeDependentEdges.delete(node);
        }
    }

    private pushNextNodeEvents(node: VertexNode): void {
        if (node.processed) return;
        if (node.previous && !node.previous.processed) this.registerEdgeEvent(node.previous, node);
        if (node.next && !node.next.processed) this.registerEdgeEvent(node, node.next);
        this.pushNextSplitEvent(node);
    }

    private pushNextSplitEvent(node: VertexNode): void {
        if (!node.isReflex || node.processed) return;

        const candidates: { event: SplitEvent; valid: boolean }[] = [];

        // Consider edges from every LAV (the reflex vertex's own contour and all
        // holes), not just its own circular list.
        this.slav!.forEachNode((current) => {
            const oppositeEdge = current.nextEdge;
            const endNode = current.next;

            if (!current.processed && !endNode?.processed && oppositeEdge && endNode &&
                oppositeEdge !== node.prevEdge && oppositeEdge !== node.nextEdge &&
                current !== node.previous && endNode !== node) {

                const candidate = calculateSplitIntersection(node, oppositeEdge, current, this.timeEpsilon);
                if (candidate && candidate.time >= this.currentTime - this.timeEpsilon) {
                    const valid = isSplitInRegion(candidate, candidate.time, current, endNode, this.pointEpsilon);
                    candidates.push({ event: candidate, valid });
                }
            }
        });

        let target: SplitEvent | null = null;
        for (const c of candidates) {
            if (c.valid && (!target || c.event.time < target.time - this.timeEpsilon)) {
                target = c.event;
            }
        }

        const newEdges = new Set<Edge>();
        if (target) {
            newEdges.add(target.splitEdge);
            for (const c of candidates) {
                if (!c.valid && c.event.time < target.time - this.timeEpsilon) {
                    newEdges.add(c.event.splitEdge);
                }
            }
        } else {
            for (const c of candidates) {
                newEdges.add(c.event.splitEdge);
            }
        }

        const oldEdges = this.nodeDependentEdges.get(node);
        if (oldEdges) {
            for (const edge of oldEdges) {
                const set = this.edgeDependents.get(edge);
                if (set) {
                    set.delete(node);
                    if (set.size === 0) this.edgeDependents.delete(edge);
                }
            }
            this.nodeDependentEdges.delete(node);
        }

        if (newEdges.size > 0) {
            this.nodeDependentEdges.set(node, newEdges);
            for (const edge of newEdges) {
                let set = this.edgeDependents.get(edge);
                if (!set) {
                    set = new Set();
                    this.edgeDependents.set(edge, set);
                }
                set.add(node);
            }
        }

        if (target) {
            this.events!.push(target);
            this.queue!.push(this.events!.length - 1, target.time);
        }
    }

    private recomputeAffectedSplitEvents(affectedEdges: Set<Edge>): void {
        const affectedNodes = new Set<VertexNode>();
        for (const edge of affectedEdges) {
            const set = this.edgeDependents.get(edge);
            if (set) for (const node of set) affectedNodes.add(node);
        }
        for (const node of affectedNodes) {
            this.pushNextSplitEvent(node);
        }
    }

    private registerEdgeEvent(nodeA: VertexNode, nodeB: VertexNode): void {
        const intersection = new BisectorIntersection(nodeA, nodeB);
        if (!intersection.isValid || !Number.isFinite(intersection.distance)) return;

        const earliestTime = Math.max(nodeA.time, nodeB.time, this.currentTime);
        if (intersection.distance < earliestTime - this.timeEpsilon) return;

        this.events!.push({ type: 'edge', time: intersection.distance, point: intersection.intersectionPoint, nodeA, nodeB });
        this.queue!.push(this.events!.length - 1, intersection.distance);
    }

    private addEdge(node: VertexNode, target: Point, timeTarget: number): void {
        this.result!.edges.push({
            source: node.vertex, target, leftEdge: node.prevEdge ?? null,
            rightEdge: node.nextEdge ?? null, timeSource: node.time, timeTarget,
        });
    }

    private linkNodes(prev: VertexNode, curr: VertexNode, next: VertexNode): void {
        prev.next = curr; curr.previous = prev;
        curr.next = next; next.previous = curr;
    }

    public compute(): StraightSkeletonResult | null {
        if (this.polygon.vertices.length < 3) return null;

        this.timeEpsilon = EPS; 
        this.pointEpsilon = Math.max(this.timeEpsilon * 10, Number.EPSILON);
        VertexNode.resetIds();
        this._initialize();

        const contours = this.polygon.getContours();
        for (const contour of contours) {
            if (contour.vertices.length < 3) continue;

            const lav = LAV.fromContour(contour);
            this.slav!.add(lav);

            let current = lav.node;
            const head = current;

            do {
                this.nodes.push(current);
                this.pushNextNodeEvents(current);
                current = current.next!;
            } while (current && current !== head);
        }

        let iterations = 0;
        const iterationLimit = Math.max(1000, this.polygon.vertices.length * this.polygon.vertices.length * 100);

        while (this.queue!.length > 0 && !this.slav!.isEmpty() && iterations++ < iterationLimit) {
            const baseTime = this.events![this.queue!.peek()!]?.time;
            if (baseTime === undefined) break;
            this.currentTime = baseTime;

            const timeEvents: SkeletonEvent[] = [];
            
            // Simplified batch extraction
            while (this.queue!.length > 0 && this.events![this.queue!.peek()!]!.time <= baseTime + this.timeEpsilon) {
                timeEvents.push(this.events![this.queue!.pop()!]!);
            }

            const clusters: SkeletonEvent[][] = [];
            for (const ev of timeEvents) {
                const cluster = clusters.find(c => c[0].point.distanceTo(ev.point) <= this.pointEpsilon);
                if (cluster) cluster.push(ev);
                else clusters.push([ev]);
            }

            for (const cluster of clusters) this.processCluster(cluster);
        }

        this.result!.nodes = this.nodes;
        return this.result!;
    }
}

export function calculateSplitIntersection(
    reflexNode: VertexNode,
    oppositeEdge: Edge,
    edgeStartNode: VertexNode,
    epsilon = EPS
): SplitEvent | null {
    if (!reflexNode || !reflexNode.bisector || !oppositeEdge || !oppositeEdge.normal) {
        debug('calculateSplitIntersection: null input');
        return null;
    }

    const pX = reflexNode.vertex.x;
    const pY = reflexNode.vertex.y;
    const t0 = reflexNode.time ?? 0;

    const vX = reflexNode.bisector.velocity.x;
    const vY = reflexNode.bisector.velocity.y;

    const nX = oppositeEdge.normal.x;
    const nY = oppositeEdge.normal.y;

    const vDotN = (vX * nX) + (vY * nY);
    const denom = vDotN - 1;

    if (denom >= -EPS) {
        debug('calculateSplitIntersection: denom too large (' + denom.toFixed(6) + ') for node=#' + reflexNode.id);
        return null;
    }

    const eStartX = oppositeEdge.start.x + (t0 * nX);
    const eStartY = oppositeEdge.start.y + (t0 * nY);

    const dx = eStartX - pX;
    const dy = eStartY - pY;
    const numerator = (dx * nX) + (dy * nY);

    const deltaT = numerator / denom;

    // A non-positive advance means the reflex vertex already lies on the
    // opposite edge at its creation time. Such a split is degenerate (it would
    // produce a zero-length edge and re-trigger itself indefinitely).
    if (!Number.isFinite(deltaT) || deltaT <= epsilon) {
        debug('calculateSplitIntersection: deltaT non-positive (' + deltaT.toFixed(6) + ') for node=#' + reflexNode.id);
        return null;
    }

    const absoluteTime = t0 + deltaT;
    const intersectionPoint = new Point(pX + (deltaT * vX), pY + (deltaT * vY));

    debug('calculateSplitIntersection: node=#' + reflexNode.id + ' edgeStart=#' + edgeStartNode.id,
        'Δt=' + deltaT.toFixed(4), 'absT=' + absoluteTime.toFixed(4));

    return {
        type: 'split',
        node: reflexNode,
        point: intersectionPoint,
        time: absoluteTime,
        edgeStartNode,
        splitEdge: oppositeEdge
    };
}

export function isSplitInRegion(
    splitEvent: SplitEvent,
    time: number,
    startNode: VertexNode,
    endNode: VertexNode,
    epsilon = EPS
): boolean {
    if (!startNode || !endNode || !startNode.bisector || !endNode.bisector) {
        debug('isSplitInRegion: null input');
        return false;
    }

    const startT0 = startNode.time ?? 0;
    const endT0 = endNode.time ?? 0;

    const startV = startNode.bisector.velocity;
    const endV = endNode.bisector.velocity;

    if (!startV || !endV) return false;

    const advancedStartX = startNode.vertex.x + (time - startT0) * startV.x;
    const advancedStartY = startNode.vertex.y + (time - startT0) * startV.y;

    const advancedEndX = endNode.vertex.x + (time - endT0) * endV.x;
    const advancedEndY = endNode.vertex.y + (time - endT0) * endV.y;

    const segmentVectorX = advancedEndX - advancedStartX;
    const segmentVectorY = advancedEndY - advancedStartY;
    const segmentLengthSq = (segmentVectorX * segmentVectorX) + (segmentVectorY * segmentVectorY);

    const biVectorX = splitEvent.point.x - advancedStartX;
    const biVectorY = splitEvent.point.y - advancedStartY;

    const projection = (biVectorX * segmentVectorX) + (biVectorY * segmentVectorY);

    const tolerance = -epsilon * Math.max(1, Math.sqrt(segmentLengthSq));
    if (projection <= tolerance) {
        debug('isSplitInRegion: projection=' + projection.toFixed(6) + ' <= tolerance');
        return false;
    }

    if (segmentLengthSq <= epsilon * epsilon) {
        const result = biVectorX * biVectorX + biVectorY * biVectorY <= epsilon * epsilon;
        if (!result) debug('isSplitInRegion: degenerate segment, point outside');
        return result;
    }

    if (projection >= segmentLengthSq - tolerance) {
        debug('isSplitInRegion: projection=' + projection.toFixed(6) + ' >= segLen=' + segmentLengthSq.toFixed(6));
        return false;
    }

    return true;
}
