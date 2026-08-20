import type { Point } from "./Point"
import type { Vector } from "./Vector";
import { calculateNormal } from "../utils/geometryUtils";

export class Edge {
  readonly start: Point;
  readonly end: Point;
  readonly normal: Vector;

  constructor(start: Point, end: Point) {
    this.start = start;
    this.end = end;
    this.normal = calculateNormal(start, end);
  }
}
