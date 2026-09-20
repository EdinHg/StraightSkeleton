import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';
import { Point } from './models/Point';
import { Polygon } from './models/Polygon';
import { POLYGON_PRESETS } from './presets';

function computePreset(name: string) {
    const preset = POLYGON_PRESETS.find(p => p.name === name)!;
    const outer = preset.outer.map(p => new Point(p.x, p.y));
    const holes = (preset.holes ?? []).map(h => h.map(p => new Point(p.x, p.y)));
    const result = new Skeleton(new Polygon(outer, holes)).compute();
    const nonZeroEdges = (result?.edges ?? []).filter(
        e => e.source!.distanceTo(e.target!) > 1e-6
    );
    return { preset, result, nonZeroEdges };
}

function sourcesOf(edges: { source?: Point }[]): Set<string> {
    return new Set(edges.map(e => `${e.source!.x},${e.source!.y}`));
}

describe('Skeleton with holes', () => {
    it('computes the skeleton of a polygon with one hole', () => {
        const { nonZeroEdges } = computePreset('Square Ring');

        // 4 arcs from the outer corners + 4 from the hole corners + 4 midline arcs.
        expect(nonZeroEdges.length).toBe(12);

        const sources = sourcesOf(nonZeroEdges);
        for (const corner of ['260,360', '540,360', '540,190', '260,190']) {
            expect(sources.has(corner)).toBe(true);
        }
    });

    it('computes the skeleton of a polygon with multiple holes', () => {
        const { nonZeroEdges } = computePreset('Twin Courtyards');

        expect(nonZeroEdges.length).toBe(25);

        const sources = sourcesOf(nonZeroEdges);
        for (const corner of ['250,190', '380,190', '250,360', '420,190', '550,190', '420,360']) {
            expect(sources.has(corner)).toBe(true);
        }
    });

    it('computes the skeleton of an H-shaped polygon with four courtyards', () => {
        const { nonZeroEdges } = computePreset('H-shape with Courtyards');
        expect(nonZeroEdges.length).toBe(53);
    });

    it('terminates on a complex polygon with irregular holes', () => {
        const { result, nonZeroEdges } = computePreset('Castle with Towers & Atriums');

        expect(result).not.toBeNull();
        expect(nonZeroEdges.length).toBe(90);
        for (const edge of nonZeroEdges) {
            expect(Number.isFinite(edge.source!.x)).toBe(true);
            expect(Number.isFinite(edge.target!.x)).toBe(true);
        }
    });
});
