import { LAV } from "./LAV";
import type { VertexNode } from "./VertexNode";

/**
 * Set of LAVs (a "set of LAVs" — SLAV) that make up the wavefront of a
 * polygon with holes. The outer contour and every hole are independent LAVs,
 * but split events may involve edges from any of them.
 */
export class SLAV {
    lavs: LAV[] = [];

    add(lav: LAV): void {
        this.lavs.push(lav);
    }

    remove(lav: LAV): void {
        const index = this.lavs.indexOf(lav);
        if (index !== -1) this.lavs.splice(index, 1);
    }

    isEmpty(): boolean {
        return this.lavs.length === 0;
    }

    forEachNode(callback: (node: VertexNode) => void): void {
        for (const lav of this.lavs) {
            const head = lav.node;
            let current: VertexNode | null = head;
            const visited = new Set<VertexNode>();

            while (current && !visited.has(current)) {
                visited.add(current);
                callback(current);
                current = current.next;
                if (current === head) break;
            }
        }
    }
}
