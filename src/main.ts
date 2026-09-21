import './style.css'
import { PolygonEditor } from './PolygonEditor'
import { RoofViewer } from './RoofViewer'
import { Skeleton } from './Skeleton'
import { loadSavedPolygons, savePolygon, deletePolygon } from './PolygonStorage'
import { Point } from './models/Point'
import { POLYGON_PRESETS } from './presets'
import type { PolygonPreset } from './presets'
import { generateRandomSimplePolygon } from './randomPolygon'

const CHEVRON = '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>'

const THEME_KEY = 'straight-skeleton-theme'

const PRESET_CATEGORIES: { key: string; label: string }[] = [
    { key: 'convex', label: 'Convex' },
    { key: 'concave', label: 'Concave' },
    { key: 'holes', label: 'With Holes' },
]

const app = document.getElementById('app')!
app.innerHTML = `
  <main class="workspace">
    <section class="pane editor-pane">
      <aside class="panel" id="polygon-panel">
        <button class="panel-header" id="panel-header" title="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          <span class="panel-title">Shapes</span>
        </button>
        <div class="panel-body" id="panel-body"></div>
      </aside>
      <div class="editor-overlay">
        <button class="icon-btn" id="theme-toggle" title="Toggle light/dark">
          ${SUN}
        </button>
        <button class="icon-btn" id="undo" title="Undo last point">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
        </button>
        <button class="icon-btn" id="clear" title="Clear polygon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
        <button class="icon-btn" id="save" title="Save polygon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
        </button>
        <button class="icon-btn" id="generate-random" title="Generate random polygon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/></svg>
        </button>
      </div>
      <div id="konva-container" class="editor-canvas"></div>
    </section>
    <div class="divider" id="divider"></div>
    <section class="pane viewer-pane">
      <div id="three-container" class="viewer-canvas"></div>
    </section>
  </main>
`

const editorContainer = document.getElementById('konva-container') as HTMLDivElement
const panel = document.getElementById('polygon-panel') as HTMLElement
const panelBody = document.getElementById('panel-body') as HTMLElement
const workspace = document.querySelector('.workspace') as HTMLElement
const editorPane = document.querySelector('.editor-pane') as HTMLElement
const divider = document.getElementById('divider') as HTMLElement

const editor = new PolygonEditor(editorContainer)
const viewer = new RoofViewer(document.getElementById('three-container') as HTMLElement)

document.getElementById('panel-header')!.addEventListener('click', () => {
    panel.classList.toggle('collapsed')
})

let dragging = false

function setSplit(clientX: number) {
    const rect = workspace.getBoundingClientRect()
    const ratio = Math.min(0.8, Math.max(0.2, (clientX - rect.left) / rect.width))
    editorPane.style.flex = `0 0 ${ratio * 100}%`
    editor.resize()
    viewer.resize()
}

divider.addEventListener('pointerdown', (e) => {
    dragging = true
    divider.setPointerCapture(e.pointerId)
    divider.classList.add('dragging')
    e.preventDefault()
})

divider.addEventListener('pointermove', (e) => {
    if (dragging) setSplit(e.clientX)
})

divider.addEventListener('pointerup', (e) => {
    dragging = false
    divider.classList.remove('dragging')
    divider.releasePointerCapture(e.pointerId)
})

function createGroup(label: string): HTMLDivElement {
    const group = document.createElement('div')
    group.className = 'panel-group collapsed'

    const header = document.createElement('button')
    header.className = 'group-header'
    header.innerHTML = `<span></span>${CHEVRON}`
    header.firstElementChild!.textContent = label

    const items = document.createElement('div')
    items.className = 'group-items'

    header.addEventListener('click', () => {
        const wasCollapsed = group.classList.contains('collapsed')
        for (const other of panelBody.querySelectorAll('.panel-group')) {
            other.classList.add('collapsed')
        }
        if (wasCollapsed) group.classList.remove('collapsed')
    })
    group.append(header, items)
    panelBody.appendChild(group)
    return items
}

function recompute() {
    if (!editor.isClosed()) return
    const polygon = editor.getPolygon()
    if (!polygon) return
    const skeleton = new Skeleton(polygon).compute()
    if (!skeleton) {
        editor.clearSkeleton()
        viewer.setSkeleton(null)
        return
    }
    editor.setSkeleton(skeleton)
    viewer.setSkeleton(skeleton, polygon)
}

function loadPreset(preset: PolygonPreset) {
    const outer = preset.outer.map(p => new Point(p.x, p.y))
    const holes = (preset.holes ?? []).map(h => h.map(p => new Point(p.x, p.y)))
    editor.loadPreset(outer, holes, preset.name)
    recompute()
}

editor.onPolygonChanged = recompute

const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement
let lightTheme = localStorage.getItem(THEME_KEY) === 'light'

function applyTheme() {
    document.documentElement.dataset.theme = lightTheme ? 'light' : 'dark'
    themeToggle.innerHTML = lightTheme ? MOON : SUN
    editor.setTheme(lightTheme)
    viewer.setTheme(lightTheme)
    recompute()
}

themeToggle.addEventListener('click', () => {
    lightTheme = !lightTheme
    localStorage.setItem(THEME_KEY, lightTheme ? 'light' : 'dark')
    applyTheme()
})

const presetGroups: Record<string, HTMLDivElement> = {}
for (const category of PRESET_CATEGORIES) {
    presetGroups[category.key] = createGroup(category.label)
}

for (const preset of POLYGON_PRESETS) {
    const items = presetGroups[preset.category]
    if (!items) continue
    const btn = document.createElement('button')
    btn.className = 'item'
    btn.textContent = preset.name
    btn.addEventListener('click', () => loadPreset(preset))
    items.appendChild(btn)
}

const savedItems = createGroup('Saved')

function renderSavedGroup() {
    savedItems.innerHTML = ''
    const saved = loadSavedPolygons()

    if (saved.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'empty'
        empty.textContent = 'No saved polygons'
        savedItems.appendChild(empty)
        return
    }

    for (const entry of saved) {
        const row = document.createElement('div')
        row.className = 'item-row'

        const load = document.createElement('button')
        load.className = 'item'
        load.textContent = entry.name
        load.addEventListener('click', () => {
            editor.loadPolygon(entry.points.map(p => new Point(p.x, p.y)))
            recompute()
        })

        const remove = document.createElement('button')
        remove.className = 'item-delete'
        remove.title = 'Delete'
        remove.innerHTML = CROSS
        remove.addEventListener('click', () => {
            deletePolygon(entry.name)
renderSavedGroup()
applyTheme()
        })

        row.append(load, remove)
        savedItems.appendChild(row)
    }
}

document.getElementById('clear')!.addEventListener('click', () => editor.clear())
document.getElementById('undo')!.addEventListener('click', () => editor.undo())

document.getElementById('generate-random')!.addEventListener('click', () => {
    const count = 10 + Math.floor(Math.random() * 91)
    const points = generateRandomSimplePolygon(count, editorContainer.clientWidth, editorContainer.clientHeight)
    editor.loadPolygon(points)
    recompute()
})

document.getElementById('save')!.addEventListener('click', () => {
    const points = editor.getPoints()
    if (points.length < 3) return
    const name = window.prompt('Polygon name:')
    if (!name || !name.trim()) return
    savePolygon(name.trim(), points)
    renderSavedGroup()
})

renderSavedGroup()
