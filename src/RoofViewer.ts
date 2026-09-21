import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { generateRoofWireframe, generateBaseOutline, polygonCentroid } from './roofWireframe'
import type { Segment3D } from './roofWireframe'
import type { StraightSkeletonResult } from './models/StraightSkeletonResult'
import type { Polygon } from './models/Polygon'

export class RoofViewer {
    private container: HTMLElement
    private renderer: THREE.WebGLRenderer
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private controls: OrbitControls
    private roof: THREE.Group | null = null
    private frame = 0
    private pitchDegrees = 45
    private light = false

    constructor(container: HTMLElement) {
        this.container = container

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x0d0f12)

        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000)
        this.camera.position.set(90, 80, 120)

        this.renderer = new THREE.WebGLRenderer({ antialias: true })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(this.renderer.domElement)

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.08
        this.controls.target.set(0, 0, 0)

        const hemi = new THREE.HemisphereLight(0xffffff, 0x1b2026, 1.1)
        this.scene.add(hemi)
        const key = new THREE.DirectionalLight(0xffffff, 1.4)
        key.position.set(80, 140, 60)
        this.scene.add(key)

        window.addEventListener('resize', this.onResize)
        this.resize()
        this.animate()
    }

    public setTheme(light: boolean) {
        this.light = light
        this.scene.background = new THREE.Color(light ? 0xffffff : 0x0d0f12)
    }

    public setSkeleton(skeleton: StraightSkeletonResult | null, polygon: Polygon | null = null) {
        if (this.roof) {
            this.scene.remove(this.roof)
            disposeGroup(this.roof)
            this.roof = null
        }
        if (!skeleton || !polygon) return

        const segments = generateRoofWireframe(skeleton, this.pitchDegrees)
        const baseOutline = generateBaseOutline(polygon)

        const group = new THREE.Group()

        const centroid = polygonCentroid(polygon)
        group.position.set(-centroid.x, -centroid.y, -centroid.z)

        if (segments.length > 0) {
            group.add(makeLineSegments(segments, 0xff5a4d))

            for (const seg of segments) {
                const dot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.6, 8, 6),
                    new THREE.MeshBasicMaterial({ color: 0x4dd2ff }),
                )
                dot.position.set(seg.end.x, seg.end.y, seg.end.z)
                group.add(dot)
            }
        }

        if (baseOutline.length > 0) {
            group.add(makeLineSegments(baseOutline, this.light ? 0x333a42 : 0xe6e6e6))
        }

        this.roof = group
        this.scene.add(group)

        const bounds = new THREE.Box3().setFromObject(group)
        this.frameCamera(bounds)
    }

    private frameCamera(bounds: THREE.Box3) {
        if (bounds.isEmpty()) return

        const size = bounds.getSize(new THREE.Vector3())
        const radius = Math.max(size.length(), 1)

        this.controls.target.set(0, 0, 0)
        this.camera.position.set(radius, radius, radius)
        this.controls.update()
    }

    private onResize = () => this.resize()

    public resize() {
        const w = this.container.clientWidth
        const h = this.container.clientHeight
        if (w === 0 || h === 0) return
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(w, h, false)
    }

    private animate = () => {
        this.frame = requestAnimationFrame(this.animate)
        this.controls.update()
        this.renderer.render(this.scene, this.camera)
    }

    public destroy() {
        cancelAnimationFrame(this.frame)
        window.removeEventListener('resize', this.onResize)
        if (this.roof) disposeGroup(this.roof)
        this.controls.dispose()
        this.renderer.dispose()
        this.renderer.domElement.remove()
    }
}

function makeLineSegments(segments: Segment3D[], color: number): THREE.LineSegments {
    const positions: number[] = []
    for (const seg of segments) {
        positions.push(seg.start.x, seg.start.y, seg.start.z)
        positions.push(seg.end.x, seg.end.y, seg.end.z)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeBoundingSphere()
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }))
}

function disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(material)) material.forEach(m => m.dispose())
        else material?.dispose()
    })
}
