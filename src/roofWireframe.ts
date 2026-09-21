import type { StraightSkeletonResult } from './models/StraightSkeletonResult'
import type { Polygon } from './models/Polygon'

export interface Point3D {
    x: number
    y: number
    z: number
}

export interface Segment3D {
    start: Point3D
    end: Point3D
}

/**
 * Maps a 2D skeleton/polygon point into three.js space. The planar Y axis
 * becomes three.js Z and the roof height becomes three.js Y, so "up" matches
 * three.js conventions.
 */
function toPoint3D(x: number, y: number, height: number): Point3D {
    return { x, y: height, z: y }
}

/**
 * Lifts every skeleton edge into 3D by raising both endpoints along the roof
 * height with the wavefront time scaled by the pitch.
 */
export function generateRoofWireframe(
    skeleton: StraightSkeletonResult,
    pitchDegrees = 45,
): Segment3D[] {
    const zFactor = Math.tan((pitchDegrees * Math.PI) / 180)

    const segments: Segment3D[] = []
    for (const edge of skeleton.edges) {
        if (!edge.source || !edge.target) continue
        segments.push({
            start: toPoint3D(edge.source.x, edge.source.y, (edge.timeSource ?? 0) * zFactor),
            end: toPoint3D(edge.target.x, edge.target.y, (edge.timeTarget ?? 0) * zFactor),
        })
    }
    return segments
}

/**
 * The base polygon outline (outer contour plus any holes) traced at height 0.
 */
export function generateBaseOutline(polygon: Polygon): Segment3D[] {
    const segments: Segment3D[] = []

    const addContour = (points: { x: number; y: number }[]) => {
        for (let i = 0; i < points.length; i++) {
            const a = points[i]
            const b = points[(i + 1) % points.length]
            segments.push({
                start: toPoint3D(a.x, a.y, 0),
                end: toPoint3D(b.x, b.y, 0),
            })
        }
    }

    addContour(polygon.vertices)
    for (const hole of polygon.holes) addContour(hole)

    return segments
}

/**
 * Area-weighted centroid of the polygon's outer contour, expressed in three.js
 * space (planar Y mapped to Z, height 0). Falls back to the vertex average for
 * degenerate (zero-area) contours.
 */
export function polygonCentroid(polygon: Polygon): Point3D {
    const pts = polygon.vertices
    if (pts.length === 0) return { x: 0, y: 0, z: 0 }

    let area = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        const cross = a.x * b.y - b.x * a.y
        area += cross
        cx += (a.x + b.x) * cross
        cy += (a.y + b.y) * cross
    }
    area /= 2

    if (Math.abs(area) < 1e-9) {
        let sx = 0
        let sy = 0
        for (const p of pts) {
            sx += p.x
            sy += p.y
        }
        return toPoint3D(sx / pts.length, sy / pts.length, 0)
    }

    return toPoint3D(cx / (6 * area), cy / (6 * area), 0)
}
