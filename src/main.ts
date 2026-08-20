import './style.css'
import { PolygonCanvas } from './PolygonCanvas'
import { computeStraightSkeleton } from './SSImplementation.ts'
import { loadSavedPolygons, savePolygon, deletePolygon } from './PolygonStorage'
import { Point } from './models/Point'
import { POLYGON_PRESETS } from './presets'

const app = document.getElementById('app')!
app.innerHTML = `
  <div class="controls">
    <select id="preset-list"><option value="">-- Roof Presets --</option></select>
    <button id="load-preset">Load Preset</button>
    <span class="separator"></span>
    <button id="clear">Clear</button>
    <button id="undo">Undo</button>
    <button id="compute">Compute Skeleton</button>
    <span class="separator"></span>
    <button id="save">Save</button>
    <select id="polygon-list"><option value="">-- Saved Polygons --</option></select>
    <button id="load">Load</button>
    <button id="delete">Delete</button>
    <span class="status" id="status">Click to place points. Double-click to close the polygon.</span>
  </div>
  <canvas id="canvas"></canvas>
`

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const statusEl = document.getElementById('status')!
const polyCanvas = new PolygonCanvas(canvas, statusEl)
const polygonList = document.getElementById('polygon-list') as HTMLSelectElement
const presetList = document.getElementById('preset-list') as HTMLSelectElement

function refreshDropdown() {
    const saved = loadSavedPolygons()
    polygonList.innerHTML = '<option value="">-- Saved Polygons --</option>'
    for (const p of saved) {
        const opt = document.createElement('option')
        opt.value = p.name
        opt.textContent = p.name
        polygonList.appendChild(opt)
    }
}

function populatePresets() {
    const groups: Record<string, HTMLOptGroupElement> = {}
    const labels: Record<string, string> = {
        convex: 'Convex',
        concave: 'Concave',
        holes: 'With Holes',
    }
    for (const preset of POLYGON_PRESETS) {
        if (!groups[preset.category]) {
            const group = document.createElement('optgroup')
            group.label = labels[preset.category] || preset.category
            groups[preset.category] = group
            presetList.appendChild(group)
        }
        const opt = document.createElement('option')
        opt.value = preset.name
        opt.textContent = preset.name
        groups[preset.category].appendChild(opt)
    }
}

refreshDropdown()
populatePresets()

function recomputeSkeleton(): boolean {
    if (!polyCanvas.isClosed()) {
        statusEl.textContent = 'Polygon is not closed.'
        return false
    }

    const polygon = polyCanvas.getPolygon()
    if (!polygon) {
        statusEl.textContent = 'Invalid polygon. Please ensure it has at least 3 points.'
        return false
    }

    const skeleton = computeStraightSkeleton(polygon)
    if (!skeleton) {
        statusEl.textContent = 'Failed to compute the straight skeleton.'
        polyCanvas.clearSkeleton()
        return false
    }

    polyCanvas.setSkeleton(skeleton)
    statusEl.textContent = `Skeleton computed (${skeleton.edges.length} edges). Drag vertices to update.`
    return true
}

polyCanvas.onPolygonChanged = recomputeSkeleton

document.getElementById('clear')!.addEventListener('click', () => polyCanvas.clear())
document.getElementById('undo')!.addEventListener('click', () => polyCanvas.undo())
document.getElementById('compute')!.addEventListener('click', () => recomputeSkeleton())

document.getElementById('load-preset')!.addEventListener('click', () => {
    const name = presetList.value
    if (!name) {
        statusEl.textContent = 'Select a roof preset to load.'
        return
    }
    const preset = POLYGON_PRESETS.find(p => p.name === name)
    if (!preset) return
    const outer = preset.outer.map(p => new Point(p.x, p.y))
    const holes = (preset.holes ?? []).map(h => h.map(p => new Point(p.x, p.y)))
    polyCanvas.loadPreset(outer, holes, preset.name)
})

document.getElementById('save')!.addEventListener('click', () => {
    const points = polyCanvas.getPoints()
    if (points.length < 3) {
        statusEl.textContent = 'Need at least 3 points to save a polygon.'
        return
    }
    const name = window.prompt('Polygon name:')
    if (!name || !name.trim()) return
    savePolygon(name.trim(), points)
    refreshDropdown()
    statusEl.textContent = `Polygon "${name.trim()}" saved.`
})

document.getElementById('load')!.addEventListener('click', () => {
    const name = polygonList.value
    if (!name) {
        statusEl.textContent = 'Select a polygon to load.'
        return
    }
    const saved = loadSavedPolygons()
    const entry = saved.find(p => p.name === name)
    if (!entry) return
    const points = entry.points.map(p => new Point(p.x, p.y))
    polyCanvas.loadPolygon(points)
    statusEl.textContent = `Loaded "${name}".`
})

document.getElementById('delete')!.addEventListener('click', () => {
    const name = polygonList.value
    if (!name) {
        statusEl.textContent = 'Select a polygon to delete.'
        return
    }
    deletePolygon(name)
    refreshDropdown()
    statusEl.textContent = `Deleted "${name}".`
})
