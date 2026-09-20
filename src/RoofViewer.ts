import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export class RoofViewer {
    private container: HTMLElement
    private renderer: THREE.WebGLRenderer
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private controls: OrbitControls
    private roof: THREE.Group | null = null
    private frame = 0

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

        const grid = new THREE.GridHelper(400, 40, 0x33424f, 0x1a2229)
        this.scene.add(grid)

        window.addEventListener('resize', this.onResize)
        this.resize()
        this.animate()
    }

    public setRoof(group: THREE.Group | null) {
        if (this.roof) this.scene.remove(this.roof)
        this.roof = group
        if (this.roof) this.scene.add(this.roof)
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
        this.controls.dispose()
        this.renderer.dispose()
        this.renderer.domElement.remove()
    }
}
