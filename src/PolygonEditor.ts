import Konva from 'konva'
import { Point } from './models/Point'
import { Polygon } from './models/Polygon'
import type { StraightSkeletonResult } from './models/StraightSkeletonResult'

const HIT_RADIUS = 10
const CLICK_DELAY = 250
const MIN_SCALE = 0.2
const MAX_SCALE = 8
const ZOOM_STEP = 1.1

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

const OUTLINE = '#e6e6e6'
const SKELETON = '#ff5a4d'
const NODE = '#4dd2ff'
const LABEL = '#ffd34d'

export class PolygonEditor {
    private container: HTMLDivElement
    private stage: Konva.Stage
    private skeletonLayer: Konva.Layer
    private polygonLayer: Konva.Layer
    private overlayLayer: Konva.Layer

    private points: Point[] = []
    private holes: Point[][] = []
    private closed = false
    private mousePos: Point | null = null
    private dragIndex = -1
    private didDrag = false
    private clickTimer = -1
    private pendingClickPoint: Point | null = null
    private currentSkeleton: StraightSkeletonResult | null = null
    private panning = false
    private spaceDown = false
    private panStart = { clientX: 0, clientY: 0, stageX: 0, stageY: 0 }

    public onPolygonChanged: (() => void) | null = null

    constructor(container: HTMLDivElement) {
        this.container = container
        this.stage = new Konva.Stage({
            container,
            width: container.clientWidth,
            height: container.clientHeight,
        })
        this.skeletonLayer = new Konva.Layer()
        this.polygonLayer = new Konva.Layer()
        this.overlayLayer = new Konva.Layer()
        this.stage.add(this.skeletonLayer, this.polygonLayer, this.overlayLayer)
        this.bindEvents()
        this.render()
    }

    private bindEvents() {
        this.stage.on('click', this.onClick)
        this.stage.on('dblclick', this.onDblClick)
        this.stage.on('mousedown', this.onMouseDown)
        this.stage.on('mousemove', this.onMouseMove)
        this.stage.on('mouseup', this.onMouseUp)
        this.stage.on('mouseleave', this.onMouseLeave)
        this.stage.on('wheel', this.onWheel)

        this.container.addEventListener('mousedown', this.onContainerMouseDown)
        this.container.addEventListener('contextmenu', this.onContextMenu)
        window.addEventListener('mousemove', this.onPanMove)
        window.addEventListener('mouseup', this.onPanEnd)
        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onPanEnd)
        window.addEventListener('resize', this.onResize)
    }

    private onContextMenu = (e: MouseEvent) => {
        e.preventDefault()
    }

    private onContainerMouseDown = (e: MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && (this.spaceDown || e.ctrlKey || e.metaKey))) {
            e.preventDefault()
            this.startPan(e)
        }
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !this.isTextInput(e.target)) {
            this.spaceDown = true
            e.preventDefault()
        }
    }

    private onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') this.spaceDown = false
    }

    private isTextInput(target: EventTarget | null): boolean {
        const el = target as HTMLElement | null
        return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }

    private startPan(e: MouseEvent) {
        this.panning = true
        this.panStart = { clientX: e.clientX, clientY: e.clientY, stageX: this.stage.x(), stageY: this.stage.y() }
        this.container.style.cursor = 'grabbing'
    }

    private onPanMove = (e: MouseEvent) => {
        if (!this.panning) return
        this.didDrag = true
        this.stage.position({
            x: this.panStart.stageX + (e.clientX - this.panStart.clientX),
            y: this.panStart.stageY + (e.clientY - this.panStart.clientY),
        })
    }

    private onPanEnd = () => {
        if (!this.panning) return
        this.panning = false
        this.container.style.cursor = 'crosshair'
    }

    private onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault()
        const oldScale = this.stage.scaleX()
        const pointer = this.stage.getPointerPosition()
        if (!pointer) return
        const direction = e.evt.deltaY > 0 ? -1 : 1
        const newScale = clamp(oldScale * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), MIN_SCALE, MAX_SCALE)

        this.stage.scale({ x: newScale, y: newScale })
        this.stage.position({
            x: pointer.x - ((pointer.x - this.stage.x()) / oldScale) * newScale,
            y: pointer.y - ((pointer.y - this.stage.y()) / oldScale) * newScale,
        })
    }

    private onClick = () => {
        if (this.didDrag || this.closed) return
        const pos = this.pointer()
        if (!pos || this.hitTest(pos) !== -1) return
        if (this.clickTimer !== -1) clearTimeout(this.clickTimer)
        this.pendingClickPoint = pos
        this.clickTimer = window.setTimeout(() => {
            this.clickTimer = -1
            if (this.pendingClickPoint && !this.closed && !this.didDrag) {
                this.points.push(this.pendingClickPoint)
                this.render()
            }
            this.pendingClickPoint = null
        }, CLICK_DELAY)
    }

    private onDblClick = () => {
        if (this.clickTimer !== -1) {
            clearTimeout(this.clickTimer)
            this.clickTimer = -1
        }
        this.pendingClickPoint = null
        if (this.didDrag || this.closed) return
        if (this.points.length < 3) return
        this.closed = true
        this.render()
        this.onPolygonChanged?.()
    }

    private onMouseDown = () => {
        const pos = this.pointer()
        if (!pos) return
        const idx = this.hitTest(pos)
        if (idx !== -1) {
            this.dragIndex = idx
            this.didDrag = false
            this.container.style.cursor = 'grabbing'
        }
    }

    private onMouseMove = () => {
        const pos = this.pointer()
        if (!pos) return
        if (this.dragIndex !== -1) {
            this.points[this.dragIndex] = pos
            this.didDrag = true
            this.render()
            if (this.closed) this.onPolygonChanged?.()
            return
        }
        this.container.style.cursor = this.hitTest(pos) !== -1 ? 'grab' : 'crosshair'
        if (!this.closed) {
            this.mousePos = pos
            this.render()
        }
    }

    private onMouseUp = () => {
        if (this.dragIndex !== -1) {
            this.dragIndex = -1
            this.container.style.cursor = 'crosshair'
        }
    }

    private onMouseLeave = () => {
        this.mousePos = null
        this.dragIndex = -1
        this.container.style.cursor = 'crosshair'
        if (!this.closed) this.render()
    }

    private onResize = () => this.resize()

    public resize() {
        this.stage.width(this.container.clientWidth)
        this.stage.height(this.container.clientHeight)
        this.render()
    }

    private pointer(): Point | null {
        const p = this.stage.getRelativePointerPosition()
        return p ? new Point(p.x, p.y) : null
    }

    private hitTest(pos: Point): number {
        const worldRadius = HIT_RADIUS / this.stage.scaleX()
        for (let i = this.points.length - 1; i >= 0; i--) {
            if (this.points[i].distanceTo(pos) <= worldRadius) return i
        }
        return -1
    }

    private pathData(pts: Point[]): string {
        let d = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`
        return d + ' Z'
    }

    private render() {
        const invScale = 1 / this.stage.scaleX()
        this.skeletonLayer.destroyChildren()
        this.polygonLayer.destroyChildren()
        this.overlayLayer.destroyChildren()

        const history = this.currentSkeleton?.polygonHistory
        if (history) {
            const subpaths: string[] = []
            for (const poly of history) {
                if (poly.vertices.length < 3) continue
                subpaths.push(this.pathData(poly.vertices))
            }
            if (subpaths.length > 0) {
                this.skeletonLayer.add(new Konva.Path({
                    data: subpaths.join(' '),
                    fill: 'rgba(230,230,230,0.05)',
                    fillRule: 'evenodd',
                    stroke: 'rgba(230,230,230,0.16)',
                    strokeWidth: invScale,
                }))
            }
        }

        if (this.points.length > 0) {
            if (this.closed) {
                const subpaths = [this.pathData(this.points)]
                for (const hole of this.holes) {
                    if (hole.length >= 3) subpaths.push(this.pathData(hole))
                }
                this.polygonLayer.add(new Konva.Path({
                    data: subpaths.join(' '),
                    fill: 'rgba(255,255,255,0.06)',
                    fillRule: 'evenodd',
                    stroke: OUTLINE,
                    strokeWidth: 2 * invScale,
                    lineJoin: 'round',
                }))
            } else {
                const preview: number[] = []
                for (const p of this.points) preview.push(p.x, p.y)
                if (this.mousePos) preview.push(this.mousePos.x, this.mousePos.y)
                this.polygonLayer.add(new Konva.Line({
                    points: preview,
                    stroke: OUTLINE,
                    strokeWidth: 2 * invScale,
                    lineJoin: 'round',
                }))
            }
        }

        if (this.currentSkeleton) {
            for (const edge of this.currentSkeleton.edges) {
                if (!edge.source || !edge.target) continue
                this.skeletonLayer.add(new Konva.Line({
                    points: [edge.source.x, edge.source.y, edge.target.x, edge.target.y],
                    stroke: SKELETON,
                    strokeWidth: 2 * invScale,
                }))
            }
            for (const node of this.currentSkeleton.nodes) {
                this.overlayLayer.add(new Konva.Circle({
                    x: node.vertex.x,
                    y: node.vertex.y,
                    radius: 2.5 * invScale,
                    fill: NODE,
                    listening: false,
                }))
            }
        }

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i]
            this.overlayLayer.add(new Konva.Circle({
                x: p.x, y: p.y, radius: 4 * invScale, fill: '#fff', listening: false,
            }))
            this.overlayLayer.add(new Konva.Text({
                x: p.x + 6 * invScale,
                y: p.y - 15 * invScale,
                text: String(i),
                fontSize: 11 * invScale,
                fontFamily: 'monospace',
                fill: LABEL,
                listening: false,
            }))
        }

        this.skeletonLayer.draw()
        this.polygonLayer.draw()
        this.overlayLayer.draw()
    }

    public clear() {
        if (this.clickTimer !== -1) {
            clearTimeout(this.clickTimer)
            this.clickTimer = -1
        }
        this.pendingClickPoint = null
        this.points = []
        this.holes = []
        this.closed = false
        this.mousePos = null
        this.dragIndex = -1
        this.didDrag = false
        this.currentSkeleton = null
        this.stage.scale({ x: 1, y: 1 })
        this.stage.position({ x: 0, y: 0 })
        this.render()
    }

    public undo() {
        if (this.points.length === 0) return
        if (this.clickTimer !== -1) {
            clearTimeout(this.clickTimer)
            this.clickTimer = -1
        }
        this.pendingClickPoint = null
        this.points.pop()
        this.closed = false
        this.holes = []
        this.dragIndex = -1
        this.didDrag = false
        this.currentSkeleton = null
        this.render()
    }

    public getPolygon(): Polygon | null {
        if (!this.closed || this.points.length < 3) return null
        return new Polygon(this.points, this.holes)
    }

    public isClosed(): boolean {
        return this.closed
    }

    public setSkeleton(skeleton: StraightSkeletonResult) {
        this.currentSkeleton = skeleton
        this.render()
    }

    public clearSkeleton() {
        this.currentSkeleton = null
        this.render()
    }

    public loadPolygon(points: Point[]) {
        this.clear()
        this.points = points
        this.closed = true
        this.render()
    }

    public loadPreset(outer: Point[], holes: Point[][], _label: string) {
        this.clear()
        this.points = outer
        this.holes = holes
        this.closed = true
        this.render()
    }

    public getPoints(): Point[] {
        return this.points
    }

    public destroy() {
        window.removeEventListener('resize', this.onResize)
        window.removeEventListener('mousemove', this.onPanMove)
        window.removeEventListener('mouseup', this.onPanEnd)
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onPanEnd)
        this.container.removeEventListener('mousedown', this.onContainerMouseDown)
        this.container.removeEventListener('contextmenu', this.onContextMenu)
        this.stage.destroy()
    }
}
