import { Point } from './models/Point'

const EPS = 1e-10

function cross(o: Point, a: Point, b: Point): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function onSegment(p: Point, q: Point, r: Point): boolean {
    return r.x >= Math.min(p.x, q.x) - EPS &&
        r.x <= Math.max(p.x, q.x) + EPS &&
        r.y >= Math.min(p.y, q.y) - EPS &&
        r.y <= Math.max(p.y, q.y) + EPS
}

function segmentsCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
    const d1 = cross(b1, b2, a1)
    const d2 = cross(b1, b2, a2)
    const d3 = cross(a1, a2, b1)
    const d4 = cross(a1, a2, b2)

    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
        ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) {
        return true
    }

    const aEq = Math.abs(a1.x - b1.x) < EPS && Math.abs(a1.y - b1.y) < EPS
    const aEqB = Math.abs(a1.x - b2.x) < EPS && Math.abs(a1.y - b2.y) < EPS
    const a2Eq = Math.abs(a2.x - b1.x) < EPS && Math.abs(a2.y - b1.y) < EPS
    const a2EqB = Math.abs(a2.x - b2.x) < EPS && Math.abs(a2.y - b2.y) < EPS

    if (Math.abs(d1) < EPS && Math.abs(d2) < EPS && Math.abs(d3) < EPS && Math.abs(d4) < EPS) {
        if (onSegment(a1, a2, b1) && !aEq && !aEqB) return true
        if (onSegment(a1, a2, b2) && !aEq && !a2EqB) return true
        if (onSegment(b1, b2, a1) && !aEq && !a2Eq) return true
        if (onSegment(b1, b2, a2) && !aEqB && !a2Eq) return true
    }

    return false
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
    let inside = false
    const n = poly.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i].x, yi = poly[i].y
        const xj = poly[j].x, yj = poly[j].y
        if (((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) {
            inside = !inside
        }
    }
    return inside
}

function isSimplePolygon(pts: Point[]): boolean {
    const n = pts.length
    if (n < 3) return false

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = pts[i].x - pts[j].x
            const dy = pts[i].y - pts[j].y
            if (dx * dx + dy * dy < EPS * EPS) return false
        }
    }

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        for (let k = i + 2; k < n; k++) {
            const l = (k + 1) % n
            if (j === k || l === i) continue
            if (segmentsCross(pts[i], pts[j], pts[k], pts[l])) return false
        }
    }

    for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n]
        const b = pts[i]
        const c = pts[(i + 1) % n]
        if (Math.abs(cross(a, b, c)) < EPS) return false
    }

    return true
}

function convexHull(points: Point[]): Point[] {
    const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y)
    if (pts.length <= 1) return pts

    const lower: Point[] = []
    for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= EPS) {
            lower.pop()
        }
        lower.push(p)
    }

    const upper: Point[] = []
    for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i]
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= EPS) {
            upper.pop()
        }
        upper.push(p)
    }

    lower.pop()
    upper.pop()
    return lower.concat(upper)
}

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function dist2(a: Point, b: Point): number {
    const dx = a.x - b.x, dy = a.y - b.y
    return dx * dx + dy * dy
}

function edgesCross(a: Point, b: Point, poly: Point[]): boolean {
    const n = poly.length
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        if (segmentsCross(a, b, poly[i], poly[j])) return true
    }
    return false
}

function tryInsertPoint(p: Point, poly: Point[]): Point[] | null {
    const edgeOrder = shuffle(Array.from({ length: poly.length }, (_, i) => i))

    for (const ei of edgeOrder) {
        const ej = (ei + 1) % poly.length
        const a = poly[ei]
        const b = poly[ej]

        if (!pointInPolygon(p, poly)) return null

        if (edgesCross(a, p, poly)) continue
        if (edgesCross(p, b, poly)) continue

        const next = poly.slice()
        next.splice(ej, 0, p)
        return next
    }

    return null
}

export function generateRandomSimplePolygon(n: number, width: number, height: number): Point[] {
    if (n < 3) n = 3

    const margin = Math.min(width, height) * 0.08
    const minX = margin, maxX = width - margin
    const minY = margin, maxY = height - margin
    const rangeX = maxX - minX
    const rangeY = maxY - minY

    const maxAttempts = 50
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const points: Point[] = []
        const minDist = Math.min(rangeX, rangeY) * 0.05
        const minDist2 = minDist * minDist

        for (let i = 0; i < n; i++) {
            let placed = false
            for (let t = 0; t < 200; t++) {
                const p = new Point(
                    minX + Math.random() * rangeX,
                    minY + Math.random() * rangeY,
                )
                let ok = true
                for (const q of points) {
                    if (dist2(p, q) < minDist2) { ok = false; break }
                }
                if (ok) { points.push(p); placed = true; break }
            }
            if (!placed) {
                points.push(new Point(
                    minX + Math.random() * rangeX,
                    minY + Math.random() * rangeY,
                ))
            }
        }

        if (n <= 3) return points

        const hull = convexHull(points)
        const hullSet = new Set(hull)
        const interior = points.filter(p => !hullSet.has(p))

        const poly = hull.slice()
        const interiorOrder = shuffle(interior)

        let failed = false
        for (const p of interiorOrder) {
            const result = tryInsertPoint(p, poly)
            if (!result) { failed = true; break }
            poly.length = 0
            poly.push(...result)
        }

        if (!failed && isSimplePolygon(poly)) return poly
    }

    const points: Point[] = []
    for (let i = 0; i < n; i++) {
        points.push(new Point(
            minX + Math.random() * rangeX,
            minY + Math.random() * rangeY,
        ))
    }
    const cx = points.reduce((s, p) => s + p.x, 0) / n
    const cy = points.reduce((s, p) => s + p.y, 0) / n
    points.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
    return points
}
