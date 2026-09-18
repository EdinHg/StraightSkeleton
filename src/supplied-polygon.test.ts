import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';
import { Point } from './models/Point';
import { Polygon } from './models/Polygon';

describe('Skeleton', () => {
    it('keeps arcs from all vertices of the supplied polygon', () => {
        const polygon = new Polygon([
            new Point(552, 216),
            new Point(829, 376),
            new Point(604, 401),
            new Point(540, 584),
            new Point(483, 455),
            new Point(355, 536),
            new Point(268, 450),
            new Point(326, 209),
        ]);

        const result = new Skeleton(polygon).compute();
        const sources = new Set(
            result?.edges
                .filter(edge => edge.source)
                .map(edge => `${edge.source!.x},${edge.source!.y}`)
        );

        expect(sources.has('552,216')).toBe(true);
        expect(sources.has('483,455')).toBe(true);
    });
});
