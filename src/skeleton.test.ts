import { describe, it, expect } from 'vitest';
import { Point } from './models/Point';
import { Polygon } from './models/Polygon';
import { Vector } from './models/Vector';
import { Bisector } from './models/Bisector';
import { BisectorIntersection } from './models/BisectorIntersection';
import { Edge } from './models/Edge';
import { VertexNode } from './models/VertexNode';
import { computeStraightSkeleton } from './SSImplementation';
import { sanitizePolygon } from './utils/geometryUtils';

function allFinite(result: ReturnType<typeof computeStraightSkeleton>): void {
  expect(result).not.toBeNull();
  for (const edge of result!.edges) {
    expect(edge.source).toBeDefined();
    expect(edge.target).toBeDefined();
    expect(Number.isFinite(edge.source!.x)).toBe(true);
    expect(Number.isFinite(edge.source!.y)).toBe(true);
    expect(Number.isFinite(edge.target!.x)).toBe(true);
    expect(Number.isFinite(edge.target!.y)).toBe(true);
    expect(Number.isFinite(edge.timeSource!)).toBe(true);
    expect(Number.isFinite(edge.timeTarget!)).toBe(true);
  }
  if (result!.polygonHistory) {
    for (const poly of result!.polygonHistory) {
      for (const v of poly.vertices) {
        expect(Number.isFinite(v.x)).toBe(true);
        expect(Number.isFinite(v.y)).toBe(true);
      }
    }
  }
}

function makeConvexRect(w: number, h: number, ox = 0, oy = 0): Polygon {
  return new Polygon([
    new Point(ox, oy),
    new Point(ox + w, oy),
    new Point(ox + w, oy + h),
    new Point(ox, oy + h),
  ]);
}

describe('Vector safety', () => {
  it('divide by zero returns (0,0)', () => {
    const v = new Vector(3, 4);
    const r = v.divide(0);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('normalize of zero vector returns (0,0)', () => {
    const v = new Vector(0, 0);
    const r = v.normalize();
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('normalize of small vector returns (0,0)', () => {
    const v = new Vector(1e-15, 0);
    const r = v.normalize();
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('angleBetween with zero vectors returns 0', () => {
    const a = new Vector(0, 0);
    const b = new Vector(1, 0);
    expect(a.angleBetween(b)).toBe(0);
  });
});

describe('Bisector velocity magnitude', () => {
  it('has correct magnitude for a 90-degree corner (1/sin(45°) = √2)', () => {
    const prevEdge = new Edge(new Point(0, 10), new Point(0, 0));
    const nextEdge = new Edge(new Point(0, 0), new Point(10, 0));
    const node = new VertexNode(new Point(0, 0));
    node.setEdges(prevEdge, nextEdge);

    const bisector = new Bisector(node);
    expect(bisector.velocity.length()).toBeCloseTo(Math.SQRT2, 8);
  });

  it('has correct magnitude for a 60-degree interior corner (1/sin(30) = 2)', () => {
    const prevEdge = new Edge(new Point(0, 10), new Point(0, 0));
    const nextEdge = new Edge(new Point(0, 0), new Point(8.6603, 5));
    const node = new VertexNode(new Point(0, 0));
    node.setEdges(prevEdge, nextEdge);

    const bisector = new Bisector(node);
    expect(bisector.velocity.length()).toBeCloseTo(2, 6);
  });

  it('does not produce NaN velocity for collinear adjacent edges', () => {
    const edge1 = new Edge(new Point(0, 0), new Point(10, 0));
    const edge2 = new Edge(new Point(10, 0), new Point(20, 0));
    const node = new VertexNode(new Point(10, 0));
    node.setEdges(edge1, edge2);

    const bisector = new Bisector(node);
    expect(Number.isFinite(bisector.velocity.x)).toBe(true);
    expect(Number.isFinite(bisector.velocity.y)).toBe(true);
    expect(bisector.velocity.length()).toBeGreaterThan(0);
  });
});

describe('BisectorIntersection', () => {
  it('rejects parallel bisectors', () => {
    const edge1 = new Edge(new Point(0, 0), new Point(10, 0));
    const edge2 = new Edge(new Point(20, 0), new Point(20, 10));
    const a = new VertexNode(new Point(0, 0));
    a.setEdges(edge1, edge2);
    a.computeBisector();
    a.time = 0;

    const b = new VertexNode(new Point(20, 0));
    b.setEdges(edge1, edge2);
    b.computeBisector();
    b.time = 0;

    const ix = new BisectorIntersection(a, b);
    expect(ix.isValid).toBe(false);
  });

  it('produces finite intersection for valid non-parallel bisectors', () => {
    const prevToA = new Edge(new Point(0, 10), new Point(0, 0));
    const aToB = new Edge(new Point(0, 0), new Point(10, 0));
    const bToNext = new Edge(new Point(10, 0), new Point(10, 10));

    const a = new VertexNode(new Point(0, 0));
    a.setEdges(prevToA, aToB);
    a.computeBisector();
    a.time = 0;

    const b = new VertexNode(new Point(10, 0));
    b.setEdges(aToB, bToNext);
    b.computeBisector();
    b.time = 0;

    const ix = new BisectorIntersection(a, b);
    expect(Number.isFinite(ix.distance)).toBe(true);
    expect(Number.isFinite(ix.intersectionPoint.x)).toBe(true);
    expect(Number.isFinite(ix.intersectionPoint.y)).toBe(true);
  });
});

describe('Polygon sanitization', () => {
  it('removes coincident vertices', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(5, 0),
      new Point(5 + 1e-14, 0),
      new Point(5, 10),
      new Point(0, 10),
    ]);
    sanitizePolygon(p);
    expect(p.vertices.length).toBe(4);
  });

  it('handles empty polygon', () => {
    const p = new Polygon([]);
    sanitizePolygon(p);
    expect(p.vertices.length).toBe(0);
  });
});

describe('Polygon.orientCCW rebuilds edges', () => {
  it('edges are consistent after reversing', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(0, 10),
      new Point(10, 10),
      new Point(10, 0),
    ]);
    const cwArea = p.area();
    expect(cwArea).toBeLessThan(0);

    p.orientCCW();
    expect(p.area()).toBeGreaterThan(0);
    expect(p.edges.length).toBe(4);

    for (let i = 0; i < 4; i++) {
      expect(p.edges[i].start).toBe(p.vertices[i]);
      expect(p.edges[i].end).toBe(p.vertices[(i + 1) % 4]);
    }
  });
});

describe('Skeleton on convex polygons', () => {
  it('triangle produces a valid skeleton', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(100, 0),
      new Point(50, 86.6),
    ]);
    const result = computeStraightSkeleton(p);
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(2);
  });

  it('square produces a valid skeleton', () => {
    const result = computeStraightSkeleton(makeConvexRect(100, 100));
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('rectangle produces a valid skeleton', () => {
    const result = computeStraightSkeleton(makeConvexRect(200, 100));
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('regular pentagon produces a valid skeleton', () => {
    const pts: Point[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (2 * Math.PI * i) / 5 - Math.PI / 2;
      pts.push(new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)));
    }
    const result = computeStraightSkeleton(new Polygon(pts));
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('regular hexagon produces a valid skeleton', () => {
    const pts: Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (2 * Math.PI * i) / 6;
      pts.push(new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)));
    }
    const result = computeStraightSkeleton(new Polygon(pts));
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(5);
  });

  it('auto-orients a CW-drawn square and still produces a valid skeleton', () => {
    const cwSquare = new Polygon([
      new Point(0, 0),
      new Point(0, 100),
      new Point(100, 100),
      new Point(100, 0),
    ]);
    expect(cwSquare.area()).toBeLessThan(0);
    const result = computeStraightSkeleton(cwSquare);
    allFinite(result);
    expect(result!.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('near-collinear vertex does not produce NaN', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(100, 0),
      new Point(100, 1e-8),
      new Point(100, 100),
      new Point(0, 100),
    ]);
    const result = computeStraightSkeleton(p);
    allFinite(result);
  });

  it('large-scale coordinates produce finite results', () => {
    const p = new Polygon([
      new Point(1e6, 2e6),
      new Point(1e6 + 500, 2e6),
      new Point(1e6 + 500, 2e6 + 300),
      new Point(1e6, 2e6 + 300),
    ]);
    const result = computeStraightSkeleton(p);
    allFinite(result);
  });

  it('small-scale coordinates produce finite results', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(0.001, 0),
      new Point(0.001, 0.001),
      new Point(0, 0.001),
    ]);
    const result = computeStraightSkeleton(p);
    allFinite(result);
  });
});

describe('Vector.normalize', () => {
  it('produces unit length for a normal vector', () => {
    const v = new Vector(3, 4);
    const n = v.normalize();
    expect(n.length()).toBeCloseTo(1, 10);
    expect(n.x).toBeCloseTo(0.6, 10);
    expect(n.y).toBeCloseTo(0.8, 10);
  });
});

describe('Polygon.isConvex with tolerance', () => {
  it('near-collinear vertex is still classified convex', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(100, 0),
      new Point(100, 1e-14),
      new Point(100, 100),
      new Point(0, 100),
    ]);
    expect(p.isConvex()).toBe(true);
  });

  it('triangle is always convex', () => {
    const p = new Polygon([
      new Point(0, 0),
      new Point(10, 0),
      new Point(5, 8.66),
    ]);
    expect(p.isConvex()).toBe(true);
  });
});

describe('Snapshot vertices lie on bisectors', () => {
  it('for a regular pentagon, each snapshot vertex is on the bisector of its LAV node', () => {
    const pts: Point[] = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      pts.push(new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)));
    }
    const result = computeStraightSkeleton(new Polygon(pts));
    expect(result).not.toBeNull();
    expect(result!.polygonHistory).not.toBeNull();
    expect(result!.polygonHistory!.length).toBeGreaterThan(0);

    const firstSnapshot = result!.polygonHistory![0];

    for (let i = 0; i < firstSnapshot.vertices.length; i++) {
      const sv = firstSnapshot.vertices[i];
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const ov = new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle));

      const dx = sv.x - ov.x;
      const dy = sv.y - ov.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(0);

      const bisectorAngle = angle + Math.PI / 2;
      const bx = Math.cos(bisectorAngle);
      const by = Math.sin(bisectorAngle);
      const cross = dx * by - dy * bx;
      expect(Math.abs(cross)).toBeLessThan(1e-6);
      expect(dx * bx + dy * by).toBeGreaterThan(0);
    }
  });

  it('for a regular hexagon, snapshot vertices move along bisectors', () => {
    const pts: Point[] = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      pts.push(new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle)));
    }
    const result = computeStraightSkeleton(new Polygon(pts));
    expect(result).not.toBeNull();
    expect(result!.polygonHistory!.length).toBeGreaterThan(0);

    const firstSnapshot = result!.polygonHistory![0];

    for (let i = 0; i < firstSnapshot.vertices.length; i++) {
      const sv = firstSnapshot.vertices[i];
      const angle = (2 * Math.PI * i) / n;
      const ov = new Point(100 + 80 * Math.cos(angle), 100 + 80 * Math.sin(angle));

      const dx = sv.x - ov.x;
      const dy = sv.y - ov.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(0);

      const bisectorAngle = angle + Math.PI / 2;
      const bx = Math.cos(bisectorAngle);
      const by = Math.sin(bisectorAngle);
      const cross = dx * by - dy * bx;
      expect(Math.abs(cross)).toBeLessThan(1e-6);
      expect(dx * bx + dy * by).toBeGreaterThan(0);
    }
  });
});

describe('Skeleton edges parallel to polygon edges', () => {
  it('rectangle ridge edge is parallel to horizontal polygon edges', () => {
    const p = makeConvexRect(200, 100);
    const result = computeStraightSkeleton(p);
    expect(result).not.toBeNull();

    for (const se of result!.edges) {
      if (!se.source || !se.target) continue;
      const dx = se.target.x - se.source.x;
      const dy = se.target.y - se.source.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) continue;
      const crossWithHorizontal = dy * 1 - dx * 0;
      const crossWithVertical = dy * 0 - dx * 1;
      const onHorizontal = Math.abs(crossWithHorizontal) < 1e-6;
      const onVertical = Math.abs(crossWithVertical) < 1e-6;
      expect(onHorizontal || onVertical).toBe(true);
    }
  });
});
