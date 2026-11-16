import { useLayoutEffect, useRef } from 'react'
import { Object3D, Shape, type InstancedMesh } from 'three'

type Point = [number, number, number]
type Instance = { position: Point; scale: Point; angle?: number }

const plaster = '#e0d8c8'
const roof = '#b9b4a8'
const wood = '#a1947e'
const gable = new Shape().moveTo(-0.5, 0).lineTo(0.5, 0).lineTo(0, 1).closePath()
const roofExtrusion = { depth: 1, bevelEnabled: false }

export function Solid({ position, size, color = plaster }: { position: Point; size: Point; color?: string }) {
  return <mesh position={position} castShadow receiveShadow>
    <boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.93} />
  </mesh>
}

function Batch({ items, color, shape = 'box', shadow = true }: {
  items: Instance[]; color: string; shape?: 'box' | 'leaf' | 'land'; shadow?: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const batch = mesh.current
    if (!batch) return
    const transform = new Object3D()
    items.forEach(({ position, scale, angle }, index) => {
      transform.position.set(...position)
      transform.scale.set(...scale)
      transform.rotation.set(0, angle ?? 0, 0)
      transform.updateMatrix()
      batch.setMatrixAt(index, transform.matrix)
    })
    batch.instanceMatrix.needsUpdate = true
    batch.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={mesh} args={[undefined, undefined, items.length]} castShadow={shadow} receiveShadow>
    {shape === 'box' ? <boxGeometry /> : shape === 'leaf' ? <icosahedronGeometry args={[0.5, 0]} /> : <icosahedronGeometry args={[0.5, 1]} />}
    <meshStandardMaterial color={color} flatShading roughness={1} />
  </instancedMesh>
}

const cottages = [
  [-7, -5, 0.2, 1.1], [-4.4, -6.2, 0, 0.86], [0, -6, -0.18, 1.05], [3, -6, 0.12, 0.65],
  [6, -4.4, -0.28, 1], [-7, -1, 0.15, 0.82], [-5.5, 2.2, -0.24, 1.03], [-6.7, 5.1, 0, 0.8],
  [5.4, 2.4, 0.2, 0.73], [7.2, 0.2, -0.12, 1], [4.6, 5.3, 0, 0.88], [0.4, 5.55, 0.3, 0.73],
  [6.9, 5.5, 0.2, 0.94], [-1.7, -8, 0.2, 0.63], [-5, -8.2, 0, 0.67], [7, -7.4, 0, 0.8],
]
const walls: Instance[] = []
const roofs: Instance[] = []
const flues: Instance[] = []
const cottageWindows: Instance[] = []
for (const [x, z, angle, s] of cottages) {
  const local = (dx: number, y: number, dz: number): Point =>
    [x + (dx * Math.cos(angle) + dz * Math.sin(angle)) * s, y * s, z + (-dx * Math.sin(angle) + dz * Math.cos(angle)) * s]
  walls.push({ position: local(0, 0.62, 0), scale: [2.2*s, 1.24*s, 1.6*s], angle })
  roofs.push({ position: local(0, 1.24, -0.94), scale: [2.48*s, 0.69*s, 1.88*s], angle })
  flues.push({ position: local(0.6, 1.65, -0.25), scale: [0.24*s, 0.82*s, 0.24*s], angle })
  for (const dx of [-0.63, 0.63]) cottageWindows.push({ position: local(dx, 0.68, 0.81), scale: [0.32*s, 0.45*s, 0.05], angle })
}
const trees: Instance[] = []
const trunks: Instance[] = []
for (let i = 0; i < 38; i++) {
  const angle = i * 2.39996
  const distance = 8 + (i % 6) * 0.64
  const x = Math.cos(angle) * distance
  const z = Math.sin(angle) * distance
  const s = 0.68 + (i % 5) * 0.11
  trees.push({ position: [x, 0.85*s, z], scale: [s, 1.34*s, s], angle })
  trunks.push({ position: [x, 0.26*s, z], scale: [0.11, 0.52*s, 0.11] })
}
const plants: Instance[] = []
const furrows: Instance[] = []
for (let row = 0; row < 6; row++) {
  const x = 1.8 + row * 0.43
  furrows.push({ position: [x, 0.045, 0.76], scale: [0.29, 0.09, 3.1] })
  for (let plant = 0; plant < 12; plant++) {
    const z = -0.65 + plant * 0.26
    if (row === 2 && plant > 6 && plant < 10) continue
    plants.push({ position: [x, 0.16, z], scale: [0.26, 0.28 + (plant % 3) * 0.06, 0.24], angle: plant })
  }
}
const fencePosts: Instance[] = []
const fenceRails: Instance[] = []
for (const [start, end] of [
  [[1.5, 2.44], [4.35, 2.44]], [[4.35, 2.44], [4.35, -0.93]], [[4.35, -0.93], [2.25, -0.93]],
] as const) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1])
  const angle = Math.atan2(start[1] - end[1], end[0] - start[0])
  const spacing = Math.ceil(length / 0.52)
  for (let index = 0; index <= spacing; index++) {
    const t = index / spacing
    fencePosts.push({ position: [start[0] + t * (end[0] - start[0]), 0.25, start[1] + t * (end[1] - start[1])], scale: [0.075, 0.5, 0.075] })
  }
  for (const y of [0.17, 0.36]) fenceRails.push({
    position: [(start[0] + end[0]) / 2, y, (start[1] + end[1]) / 2], scale: [length, 0.05, 0.055], angle,
  })
}

function CottageRoofs() {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const transform = new Object3D()
    roofs.forEach(({ position, scale, angle }, index) => {
      transform.position.set(...position)
      transform.scale.set(...scale)
      transform.rotation.y = angle ?? 0
      transform.updateMatrix()
      mesh.current?.setMatrixAt(index, transform.matrix)
    })
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true
      mesh.current.computeBoundingSphere()
    }
  }, [])
  return <instancedMesh ref={mesh} args={[undefined, undefined, roofs.length]} castShadow receiveShadow>
    <extrudeGeometry args={[gable, roofExtrusion]} /><meshStandardMaterial color={roof} roughness={1} />
  </instancedMesh>
}

export function VillageLandscape() {
  return <>
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[160, 160]} /><meshStandardMaterial color="#ddd8cc" />
    </mesh>
    <Batch color="#d8d4c8" shape="land" shadow={false} items={[
      { position: [-8, -0.78, -7], scale: [11, 4.3, 9], angle: 0.5 },
      { position: [2, -1, -10], scale: [13, 5.8, 7], angle: -0.3 },
      { position: [9, -1.1, -7], scale: [7, 4.8, 9] },
      { position: [-9, -0.88, 6], scale: [7, 3.2, 9] },
    ]} />
    <Solid position={[-0.4, -0.022, 3.55]} size={[15.5, 0.025, 1.12]} color="#ebe3d5" />
    <group rotation={[0, -0.31, 0]}><Solid position={[0.1, -0.02, -2.1]} size={[15, 0.026, 1.05]} color="#ebe3d5" /></group>
    <Batch items={walls} color={plaster} /><CottageRoofs /><Batch items={flues} color="#b5ac9b" />
    <Batch items={cottageWindows} color="#9f998d" shadow={false} />
    <Batch items={trunks} color="#b1a895" /><Batch items={trees} color="#cec9b9" shape="leaf" />
    <group position={[3.15, 0, -3.4]} rotation={[0, -0.16, 0]}>
      <Solid position={[0, 0.84, 0]} size={[1.55, 1.68, 1.82]} color="#e9e2d4" />
      <Solid position={[0, 1.5, 0.67]} size={[0.62, 3, 0.67]} color="#e9e2d4" />
      <Solid position={[0, 0.38, 1.02]} size={[0.37, 0.76, 0.05]} color={wood} />
      <mesh position={[0, 3.31, 0.67]} rotation={[0, Math.PI/4, 0]} castShadow>
        <coneGeometry args={[0.48, 0.98, 4]} /><meshStandardMaterial color={roof} />
      </mesh>
      <mesh position={[0, 1.68, -0.99]} scale={[1.76, 0.72, 1.98]} castShadow receiveShadow>
        <extrudeGeometry args={[gable, roofExtrusion]} /><meshStandardMaterial color={roof} />
      </mesh>
    </group>
    <Solid position={[2.88, 0.003, 0.72]} size={[2.7, 0.035, 3.33]} color="#b9ad97" />
    <Batch items={furrows} color="#a89d87" />
    <Batch items={plants} shape="leaf" color="#e6dfcd" />
    <Batch items={fencePosts} color={wood} /><Batch items={fenceRails} color="#c5bba9" />
  </>
}

export function FamilyHome({ inside, onClick }: { inside: boolean; onClick: () => void }) {
  return <group position={[-1.7, 0, -0.6]} onClick={event => { event.stopPropagation(); onClick() }}>
    <Solid position={[0, 0.04, 0]} size={[3.24, 0.09, 2.52]} color="#bdb5a5" />
    <Solid position={[0, 0.95, -1.2]} size={[3.2, 1.9, 0.14]} />
    <Solid position={[-1.54, 0.95, 0]} size={[0.14, 1.9, 2.4]} />
    {inside ? <>
      <mesh position={[0, 1.89, -1.26]} scale={[3.22, 0.77, 0.14]} castShadow receiveShadow>
        <extrudeGeometry args={[gable, roofExtrusion]} /><meshStandardMaterial color="#e0d8c8" />
      </mesh>
      <Solid position={[0, 0.09, 0]} size={[2.96, 0.04, 2.27]} color="#a98460" />
      {Array.from({length: 14}, (_, i) => <Solid key={i} position={[-1.36 + i*0.21, 0.116, 0]} size={[0.012, 0.002, 2.26]} color="#886e56" />)}
      <Solid position={[0.28, 0.58, -0.18]} size={[1.07, 0.11, 0.66]} color="#b58c60" />
      {[-0.16, 0.72].flatMap(x => [-0.43, 0.06].map(z =>
        <Solid key={`${x}:${z}`} position={[x, 0.31, z]} size={[0.08, 0.53, 0.08]} color="#876a50" />))}
      <Solid position={[-1.17, 0.31, -0.65]} size={[0.55, 0.54, 0.76]} color="#a28a70" />
      <Solid position={[-1.17, 0.63, -0.65]} size={[0.56, 0.09, 0.77]} color="#62574b" />
      <Solid position={[0.79, 0.87, -1.1]} size={[1.03, 0.1, 0.27]} color="#ab8259" />
      {[-0.34, 0.86].map(x => <group key={x} position={[x, 0.11, 0.37]}>
        <Solid position={[0, 0.22, 0]} size={[0.29, 0.055, 0.28]} color="#aa8363" />
        <Solid position={[-0.09, 0.11, 0]} size={[0.055, 0.21, 0.19]} color="#876a50" />
        <Solid position={[0.09, 0.11, 0]} size={[0.055, 0.21, 0.19]} color="#876a50" />
      </group>)}
      <mesh position={[0.23, 0.65, -0.19]}>
        <cylinderGeometry args={[0.14, 0.08, 0.08, 12]} /><meshStandardMaterial color="#e5c58d" />
      </mesh>
      <mesh position={[0.22, 1.57, -0.2]}>
        <coneGeometry args={[0.16, 0.16, 10]} /><meshStandardMaterial color="#ffe1a9" emissive="#f8b65d" emissiveIntensity={0.7} />
      </mesh>
      <pointLight position={[0.22, 1.42, -0.2]} color="#ffb970" intensity={4.6} distance={4} />
    </> : <>
      <Solid position={[1.54, 0.95, 0]} size={[0.14, 1.9, 2.4]} />
      <Solid position={[0, 0.95, 1.18]} size={[3.2, 1.9, 0.15]} color="#eee7da" />
      <Solid position={[-0.72, 0.55, 1.27]} size={[0.53, 1.1, 0.06]} color={wood} />
      {[0.02, 0.92].map(x => <group key={x}>
        <Solid position={[x, 1.15, 1.27]} size={[0.46, 0.56, 0.07]} color="#a3a299" />
        <Solid position={[x, 1.15, 1.315]} size={[0.045, 0.56, 0.025]} color="#e9dfcc" />
        <Solid position={[x, 1.15, 1.315]} size={[0.46, 0.045, 0.025]} color="#e9dfcc" />
      </group>)}
      <mesh position={[0, 1.89, -1.43]} scale={[3.61, 0.94, 2.86]} castShadow receiveShadow>
        <extrudeGeometry args={[gable, roofExtrusion]} /><meshStandardMaterial color={roof} roughness={1} />
      </mesh>
      <Solid position={[0.8, 2.41, -0.57]} size={[0.34, 0.78, 0.31]} color="#c5baab" />
    </>}
  </group>
}
