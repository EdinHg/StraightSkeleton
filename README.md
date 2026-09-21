# Straight Skeleton

A TypeScript playground for computing straight skeletons of polygons (with holes) and generating 3D roof wireframes.

[Live demo](https://edinhg.github.io/StraightSkeleton/)

## Features

- Click-to-draw polygon editor (Konva) with pan/zoom (press ctrl + mouse wheel)
- Straight-skeleton computation supporting reflex vertices and holes
- 3D roof wireframe preview (Three.js with OrbitControls)
- Presets (convex, concave, with holes), save/load polygons, random polygon generator
- Light/dark theme toggle

## Tech stack

Vite, TypeScript, Konva, Three.js

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## References

- Petr Felkel, Štěpán Obdržálek. [*Straight Skeleton Implementation*](https://www.researchgate.net/publication/2398714_Straight_Skeleton_Implementation). SCCG '98, pp. 210–218, 1998.
- Stefan Huber. [*Computing Straight Skeletons and Motorcycle Graphs: Theory and Practice*](https://www.sthu.org/research/publications/files/phdthesis.pdf). PhD thesis, University of Salzburg, 2011.
