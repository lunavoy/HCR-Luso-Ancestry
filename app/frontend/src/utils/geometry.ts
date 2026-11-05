import type { Point } from '../types/domain'

export const flattenPoints = (points: Point[]) => points.flatMap(point => [point.x, point.y])

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function polygonBounds(points: Point[]) {
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

export const translatePolygon = (points: Point[], deltaX: number, deltaY: number): Point[] =>
  points.map(point => ({ x: point.x + deltaX, y: point.y + deltaY }))
