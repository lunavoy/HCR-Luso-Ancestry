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

export function polygonCentroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 }
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0
  let area = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += (points[j].x + points[i].x) * (points[j].y - points[i].y)
  }
  return Math.abs(area) / 2
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}
