const STORAGE_KEY = 'ss-polygons'

export interface SavedPolygon {
    name: string
    points: { x: number; y: number }[]
}

function getAll(): SavedPolygon[] {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
}

function setAll(polygons: SavedPolygon[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(polygons))
}

export function loadSavedPolygons(): SavedPolygon[] {
    return getAll()
}

export function savePolygon(name: string, points: { x: number; y: number }[]): void {
    const polygons = getAll()
    const idx = polygons.findIndex(p => p.name === name)
    const entry: SavedPolygon = { name, points }
    if (idx >= 0) {
        polygons[idx] = entry
    } else {
        polygons.push(entry)
    }
    setAll(polygons)
}

export function deletePolygon(name: string): void {
    setAll(getAll().filter(p => p.name !== name))
}
