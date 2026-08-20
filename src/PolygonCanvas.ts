import { Point } from './models/Point'
import { Polygon } from './models/Polygon'
import type { StraightSkeletonResult } from './models/StraightSkeletonResult'

const HIT_RADIUS = 10

export class PolygonCanvas {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private statusEl: HTMLElement
    private points: Point[] = []
    private closed = false
    private mousePos: Point | null = null
    private dragIndex = -1
    private didDrag = false
    private clickTimer = -1
    private pendingClickPoint: Point | null = null
    private currentSkeleton: StraightSkeletonResult | null = null
    private hoveredSkeletonEdge = -1
    private holes: Point[][] = []
    public onPolygonChanged: (() => void) | null = null

    constructor(canvas: HTMLCanvasElement, statusEl: HTMLElement) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')!
        this.statusEl = statusEl
        this.bindEvents()
        this.resize()
    }

    private bindEvents() {
        this.canvas.addEventListener('click', this.onClick)
        this.canvas.addEventListener('dblclick', this.onDblClick)
        this.canvas.addEventListener('mousedown', this.onMouseDown)
        this.canvas.addEventListener('mousemove', this.onMouseMove)
        this.canvas.addEventListener('mouseup', this.onMouseUp)
        this.canvas.addEventListener('mouseleave', this.onMouseLeave)
        window.addEventListener('resize', this.onResize)
    }

    private onClick = (e: MouseEvent) => {
        if (this.didDrag || this.closed) return
        const pos = this.getCanvasPoint(e)
        if (this.clickTimer !== -1) clearTimeout(this.clickTimer)
        this.pendingClickPoint = pos
        this.clickTimer = window.setTimeout(() => {
            this.clickTimer = -1
            if (this.pendingClickPoint && !this.closed && !this.didDrag) {
                this.points.push(this.pendingClickPoint)
                this.statusEl.textContent = `Points: ${this.points.length} — Double-click to close.`
                this.draw()
            }
            this.pendingClickPoint = null
        }, 250)
    }

    private onDblClick = () => {
        if (this.clickTimer !== -1) {
            clearTimeout(this.clickTimer)
            this.clickTimer = -1
            this.pendingClickPoint = null
        }
        if (this.didDrag || this.closed) return
        if (this.points.length < 3) {
            this.statusEl.textContent = 'Need at least 3 points to form a polygon.'
            return
        }
        this.closed = true
        this.statusEl.textContent = `Polygon closed with ${this.points.length} points.`
        this.draw()
    }

    private onMouseDown = (e: MouseEvent) => {
        const idx = this.hitTest(this.getCanvasPoint(e))
        if (idx !== -1) {
            this.dragIndex = idx
            this.didDrag = false
            this.canvas.style.cursor = 'grabbing'
            e.preventDefault()
        }
    }

    private onMouseMove = (e: MouseEvent) => {
        const pos = this.getCanvasPoint(e)
        if (this.dragIndex !== -1) {
            this.points[this.dragIndex] = pos
            this.didDrag = true
            this.draw()
            if (this.closed && this.onPolygonChanged) {
                this.onPolygonChanged()
            }
            return
        }
        const hit = this.hitTest(pos)
        if (hit !== -1) {
            this.canvas.style.cursor = 'grab'
        } else if (this.currentSkeleton) {
            const prev = this.hoveredSkeletonEdge
            this.hoveredSkeletonEdge = this.hitTestSkeletonEdge(pos)
            this.canvas.style.cursor = this.hoveredSkeletonEdge !== -1 ? 'pointer' : 'crosshair'
            if (this.hoveredSkeletonEdge !== prev) this.draw()
        } else {
            this.hoveredSkeletonEdge = -1
            this.canvas.style.cursor = 'crosshair'
        }
        if (!this.closed) {
            this.mousePos = pos
            this.draw()
        }
    }

    private onMouseUp = () => {
        if (this.dragIndex !== -1) {
            this.dragIndex = -1
            this.canvas.style.cursor = 'crosshair'
        }
    }

    private onMouseLeave = () => {
        this.mousePos = null
        this.dragIndex = -1
        this.hoveredSkeletonEdge = -1
        this.canvas.style.cursor = 'crosshair'
        this.draw()
    }

    private onResize = () => {
        this.resize()
    }

    private resize() {
        this.canvas.width = this.canvas.clientWidth * devicePixelRatio
        this.canvas.height = this.canvas.clientHeight * devicePixelRatio
        this.ctx.scale(devicePixelRatio, devicePixelRatio)
        this.draw()
    }

    private getCanvasPoint(e: MouseEvent): Point {
        const rect = this.canvas.getBoundingClientRect()
        return new Point(e.clientX - rect.left, e.clientY - rect.top)
    }

    private hitTest(pos: Point): number {
        for (let i = this.points.length - 1; i >= 0; i--) {
            if (this.points[i].distanceTo(pos) <= HIT_RADIUS) return i
        }
        return -1
    }

    private hitTestSkeletonEdge(pos: Point): number {
        if (!this.currentSkeleton) return -1
        let best = -1
        let bestDist = HIT_RADIUS
        for (let i = 0; i < this.currentSkeleton.edges.length; i++) {
            const e = this.currentSkeleton.edges[i]
            if (!e.source || !e.target) continue
            const d = this.distanceToSegment(pos, e.source, e.target)
            if (d < bestDist) {
                bestDist = d
                best = i
            }
        }
        return best
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lenSq = dx * dx + dy * dy
        if (lenSq === 0) return p.distanceTo(a)
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
        t = Math.max(0, Math.min(1, t))
        return p.distanceTo(new Point(a.x + t * dx, a.y + t * dy))
    }

    private draw() {
        const w = this.canvas.clientWidth
        const h = this.canvas.clientHeight
        this.ctx.clearRect(0, 0, w, h)

        if (this.points.length === 0) return

        this.ctx.strokeStyle = '#fff'
        this.ctx.lineWidth = 2
        this.ctx.lineJoin = 'round'

        this.ctx.beginPath()
        this.ctx.moveTo(this.points[0].x, this.points[0].y)
        for (let i = 1; i < this.points.length; i++) {
            this.ctx.lineTo(this.points[i].x, this.points[i].y)
        }
        if (this.closed) {
            this.ctx.closePath()
        } else if (this.mousePos && this.points.length > 0) {
            this.ctx.lineTo(this.mousePos.x, this.mousePos.y)
        }
        this.ctx.stroke()

        if (this.closed && this.holes.length > 0) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.08)'
            this.ctx.beginPath()
            this.ctx.moveTo(this.points[0].x, this.points[0].y)
            for (let i = 1; i < this.points.length; i++) {
                this.ctx.lineTo(this.points[i].x, this.points[i].y)
            }
            this.ctx.closePath()
            for (const hole of this.holes) {
                if (hole.length < 3) continue
                this.ctx.moveTo(hole[0].x, hole[0].y)
                for (let i = 1; i < hole.length; i++) {
                    this.ctx.lineTo(hole[i].x, hole[i].y)
                }
                this.ctx.closePath()
            }
            this.ctx.fill('evenodd')
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            this.ctx.lineWidth = 1
            for (const hole of this.holes) {
                if (hole.length < 3) continue
                this.ctx.beginPath()
                this.ctx.moveTo(hole[0].x, hole[0].y)
                for (let i = 1; i < hole.length; i++) {
                    this.ctx.lineTo(hole[i].x, hole[i].y)
                }
                this.ctx.closePath()
                this.ctx.stroke()
            }
            this.ctx.strokeStyle = '#fff'
            this.ctx.lineWidth = 2
        }

        this.ctx.fillStyle = '#fff'
        for (const p of this.points) {
            this.ctx.beginPath()
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
            this.ctx.fill()
        }

        if (this.currentSkeleton?.polygonHistory) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.18)'
            this.ctx.lineWidth = 1
            for (const poly of this.currentSkeleton.polygonHistory) {
                if (poly.vertices.length < 3) continue
                this.ctx.beginPath()
                this.ctx.moveTo(poly.vertices[0].x, poly.vertices[0].y)
                for (let i = 1; i < poly.vertices.length; i++) {
                    this.ctx.lineTo(poly.vertices[i].x, poly.vertices[i].y)
                }
                this.ctx.closePath()
                this.ctx.stroke()
            }
        }

        if (this.currentSkeleton) {
            for (let i = 0; i < this.currentSkeleton.edges.length; i++) {
                const edge = this.currentSkeleton.edges[i]
                if (!edge.source || !edge.target) continue
                const isHovered = i === this.hoveredSkeletonEdge
                this.ctx.strokeStyle = `hsl(${(i * 360) / this.currentSkeleton.edges.length}, 100%, 50%)`
                this.ctx.lineWidth = isHovered ? 4 : 2
                this.ctx.beginPath()
                this.ctx.moveTo(edge.source.x, edge.source.y)
                this.ctx.lineTo(edge.target.x, edge.target.y)
                this.ctx.stroke()
            }

            if (this.hoveredSkeletonEdge !== -1) {
                const he = this.currentSkeleton.edges[this.hoveredSkeletonEdge]
                if (he) {
                    this.ctx.lineWidth = 4
                    if (he.leftEdge) {
                        this.ctx.strokeStyle = '#0ff'
                        this.ctx.beginPath()
                        this.ctx.moveTo(he.leftEdge.start.x, he.leftEdge.start.y)
                        this.ctx.lineTo(he.leftEdge.end.x, he.leftEdge.end.y)
                        this.ctx.stroke()
                    }
                    if (he.rightEdge) {
                        this.ctx.strokeStyle = '#f0f'
                        this.ctx.beginPath()
                        this.ctx.moveTo(he.rightEdge.start.x, he.rightEdge.start.y)
                        this.ctx.lineTo(he.rightEdge.end.x, he.rightEdge.end.y)
                        this.ctx.stroke()
                    }
                }
            }
        }
    }

    public clear() {
        this.points = []
        this.holes = []
        this.closed = false
        this.mousePos = null
        this.dragIndex = -1
        this.didDrag = false
        this.currentSkeleton = null
        this.hoveredSkeletonEdge = -1
        if (this.clickTimer !== -1) { clearTimeout(this.clickTimer); this.clickTimer = -1 }
        this.pendingClickPoint = null
        this.statusEl.textContent = 'Click to place points. Double-click to close the polygon.'
        this.draw()
    }

    public undo() {
        if (this.points.length === 0) return
        if (this.closed) this.closed = false
        this.points.pop()
        this.holes = []
        this.dragIndex = -1
        this.didDrag = false
        this.currentSkeleton = null
        this.hoveredSkeletonEdge = -1
        if (this.clickTimer !== -1) { clearTimeout(this.clickTimer); this.clickTimer = -1 }
        this.pendingClickPoint = null
        this.statusEl.textContent = this.points.length > 0
            ? `Points: ${this.points.length} — Double-click to close.`
            : 'Click to place points. Double-click to close the polygon.'
        this.draw()
    }

    public getPolygon(): Polygon | null {
        if (!this.closed || this.points.length < 3) return null
        return new Polygon(this.points)
    }

    public isClosed(): boolean {
        return this.closed
    }

    public setSkeleton(skeleton: StraightSkeletonResult) {
        this.currentSkeleton = skeleton
        this.draw()
    }

    public clearSkeleton() {
        this.currentSkeleton = null
        this.hoveredSkeletonEdge = -1
        this.draw()
    }

    public loadPolygon(points: Point[]) {
        this.clear()
        this.points = points
        this.closed = true
        this.statusEl.textContent = `Loaded polygon with ${points.length} points.`
        this.draw()
    }

    public loadPreset(outer: Point[], holes: Point[][], label: string) {
        this.clear()
        this.points = outer
        this.holes = holes
        this.closed = true
        this.statusEl.textContent = `Preset "${label}" (${outer.length} points, ${holes.length} holes).`
        this.draw()
    }

    public getPoints(): Point[] {
        return this.points
    }
}
