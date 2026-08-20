import { EPS } from "../constants";

export class Vector {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(vector: Vector): Vector {
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    subtract(vector: Vector): Vector {
        return new Vector(this.x - vector.x, this.y - vector.y);
    }

    multiply(scalar: number): Vector {
        return new Vector(this.x * scalar, this.y * scalar);
    }

    divide(scalar: number): Vector {
        if (Math.abs(scalar) < EPS) {
            return new Vector(0, 0);
        }
        return new Vector(this.x / scalar, this.y / scalar);
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize(): Vector {
        const length = this.length();
        if (length < EPS) {
            return new Vector(0, 0);
        }

        return new Vector(this.x / length, this.y / length);
    }

    dot(vector: Vector): number {
        return this.x * vector.x + this.y * vector.y;
    }

    cross(vector: Vector): number {
        return this.x * vector.y - this.y * vector.x;
    }

    angleBetween(vector: Vector): number {
        const dotProduct = this.dot(vector);
        const lengthsProduct = this.length() * vector.length();

        if (lengthsProduct < EPS) {
            return 0;
        }

        const cosTheta = dotProduct / lengthsProduct;

        return Math.acos(Math.min(Math.max(cosTheta, -1), 1));
    }
}
