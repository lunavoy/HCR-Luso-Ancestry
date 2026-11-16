import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PCFShadowMap, Vector3, type Group } from 'three'
import { FamilyHome, VillageLandscape } from './VillageLandscape'
import type { Action, Resident } from './data'

export type Performance = { personId: string; action: Action; sequence: number }

function Block({ at, size, color, tilt = 0 }: {
  at: [number, number, number]; size: [number, number, number]; color: string; tilt?: number
}) {
  return <mesh position={at} rotation={[0, 0, tilt]} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.95} />
  </mesh>
}

type Position = [number, number, number]

const courtyard: Position[] = [[2.55, 0, 1.44], [-0.55, 0, 2.87], [-2.62, 0, 2.54], [-3.6, 0, 0.91]]
const livingRoom: Position[] = [[-0.71, 0.11, -0.24], [-2.37, 0.11, -0.82], [-1.58, 0.11, -0.19], [-0.86, 0.11, -1.19]]

function Capsule({ at, radius, length, color, lean = 0 }: {
  at: Position; radius: number; length: number; color: string; lean?: number
}) {
  return <mesh position={at} rotation={[0, 0, lean]} castShadow>
    <capsuleGeometry args={[radius, length, 4, 8]} /><meshStandardMaterial color={color} roughness={0.9} />
  </mesh>
}

function Character({ person, index, inside, selected, playing, visible, select }: {
  person: Resident; index: number; inside: boolean; selected: boolean; playing?: Performance; visible: boolean; select: () => void
}) {
  const body = useRef<Group>(null)
  const arms = useRef<Group>(null)
  const prop = useRef<Group>(null)
  const elapsed = useRef(0)
  const invalidate = useThree(state => state.invalidate)
  const child = person.profile === 'crianca'
  const elder = person.profile === 'idoso'
  const woman = person.profile === 'mulher'
  const height = child ? 0.6 : elder ? 0.83 : woman ? 0.94 : 1.08
  const color = child ? '#d5a136' : elder ? '#617d6d' : woman ? '#ae4b3c' : '#365d96'
  const [x, y, z] = (inside ? livingRoom : courtyard)[index]
  const posture = elder ? 0.23 : 0
  useEffect(() => {
    elapsed.current = 0
    body.current?.position.set(x, y, z)
    body.current?.rotation.set(posture, inside ? 0.68 : 0.27, 0)
    arms.current?.rotation.set(0, 0, 0)
    if (prop.current) prop.current.visible = !!playing
    invalidate()
  }, [playing, x, y, z, posture, inside, invalidate])
  useEffect(() => { if (visible) invalidate() }, [visible, invalidate])

  useFrame((_, delta) => {
    if (!visible || !playing || !body.current || !arms.current || elapsed.current >= 2.8) return
    elapsed.current = Math.min(2.8, elapsed.current + Math.min(delta, 0.05))
    const time = elapsed.current
    const envelope = Math.sin(Math.PI * time / 2.8)
    const field = playing.action === 'Arar' || playing.action === 'Colher'
    const rest = playing.action === 'Repousar'
    body.current.position.set(x + (field ? (2.83 - x) * envelope : 0), y, z + (field ? (0.5 - z) * envelope : 0))
    const speed = playing.action === 'Arar' ? 8 : playing.action === 'Colher' ? 5 : playing.action === 'Lavar roupa' ? 13 : 10
    const motion = Math.sin(time * speed) * envelope
    body.current.rotation.x = posture + (rest ? 0.24 * envelope : 0.14 * motion)
    arms.current.rotation.x = rest ? 0 : -0.45 * envelope + motion * 0.48
    if (prop.current) prop.current.visible = time < 2.8
    if (time < 2.8) invalidate()
  })

  return <group ref={body} position={[x, y, z]} rotation={[posture, inside ? 0.68 : 0.27, 0]} onClick={event => { event.stopPropagation(); select() }}>
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
      <ringGeometry args={[0.42, 0.46, 40]} /><meshBasicMaterial color="#53c8e8" />
    </mesh>}
    <group scale={height}>
      <Capsule at={[-0.12, 0.26, 0]} radius={0.083} length={0.34} color="#443d36" />
      <Capsule at={[0.12, 0.26, 0]} radius={0.083} length={0.34} color="#443d36" />
      <Capsule at={[0, 0.72, 0]} radius={woman ? 0.174 : 0.211} length={0.2} color={color} />
      {woman && <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.18, 0.34, 0.62, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>}
      <group ref={arms} position={[0, 0.9, 0]}>
        <Capsule at={[-0.23, -0.17, 0.035]} radius={0.066} length={0.29} color={color} lean={-0.23} />
        <Capsule at={[0.23, -0.17, 0.035]} radius={0.066} length={0.29} color={color} lean={0.23} />
        <group ref={prop}>
        {playing?.action === 'Arar' && <group position={[0.28, -0.29, 0.34]} rotation={[0.65, 0, 0]}>
          <Block at={[0, -0.33, 0]} size={[0.057, 0.83, 0.057]} color="#66492e" />
          <Block at={[0, -0.75, 0]} size={[0.25, 0.1, 0.12]} color="#40463f" />
        </group>}
        {playing?.action === 'Colher' && <Block at={[0.28, -0.29, 0.15]} size={[0.25, 0.33, 0.18]} color="#d9b44e" />}
        {(playing?.action === 'Preparar comida' || playing?.action === 'Lavar roupa') &&
          <Block at={[0, -0.28, 0.28]} size={[0.42, 0.12, 0.26]} color={playing.action === 'Lavar roupa' ? '#dae7e3' : '#ad7145'} />}
        </group>
      </group>
      <mesh position={[0, 1.18, 0.024]} castShadow>
        <sphereGeometry args={[child ? 0.196 : 0.169, 12, 8]} /><meshStandardMaterial color="#d6a27c" />
      </mesh>
      <mesh position={[0, 1.252, -0.016]} scale={[1.02, 0.78, 1.05]} castShadow>
        <sphereGeometry args={[0.177, 12, 8]} /><meshStandardMaterial color={elder ? '#dcd8cd' : woman ? '#513b2f' : '#795638'} />
      </mesh>
      {woman && <Capsule at={[0, 1.19, -0.16]} radius={0.099} length={0.155} color="#513b2f" />}
      {!child && !elder && !woman && <mesh position={[0, 1.32, 0.01]}>
        <cylinderGeometry args={[0.17, 0.233, 0.063, 14]} /><meshStandardMaterial color="#715d48" />
      </mesh>}
      {elder && <Block at={[0.31, 0.41, 0.2]} size={[0.048, 0.83, 0.048]} color="#583f2d" tilt={-0.1} />}
    </group>
  </group>
}

function FrameScene({ inside, target, visible }: { inside: boolean; target?: number; visible: boolean }) {
  const { camera, size, invalidate } = useThree()
  const look = useRef(new Vector3(0, 0.45, 0))
  const destination = useRef(new Vector3())
  const zoom = useRef(1)
  const active = useRef(false)
  const offset = useRef(new Vector3(11, 10, 12))
  useEffect(() => {
    const focus = target === undefined ? undefined : courtyard[target]
    const portrait = size.width < 760
    if (inside) destination.current.set(-1.1, 0.65, -0.5)
    else if (focus) destination.current.set(focus[0] - 0.1, 0.65, focus[2] - 0.48)
    else destination.current.set(0, 0.52, -0.25)
    if ((inside || focus) && !portrait) destination.current.x += 1.25
    zoom.current = Math.min(size.width / (inside ? 8.7 : focus ? 10.5 : 24), size.height / (inside ? 4.8 : focus ? 5.7 : 13.7))
    active.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || camera.zoom === 1) {
      look.current.copy(destination.current)
      camera.position.copy(look.current).add(offset.current)
      camera.lookAt(look.current)
      camera.zoom = zoom.current
      camera.updateProjectionMatrix()
      active.current = false
    }
    if (visible) invalidate()
  }, [camera, inside, target, visible, size, invalidate])

  useFrame((_, delta) => {
    if (!visible || !active.current) return
    const amount = 1 - Math.exp(-8 * Math.max(0.012, Math.min(delta, 0.05)))
    look.current.lerp(destination.current, amount)
    camera.zoom += (zoom.current - camera.zoom) * amount
    const finished = look.current.distanceToSquared(destination.current) < 0.00005 && Math.abs(camera.zoom - zoom.current) < 0.04
    if (finished) {
      look.current.copy(destination.current)
      camera.zoom = zoom.current
      active.current = false
    }
    camera.position.copy(look.current).add(offset.current)
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()
    if (!finished) invalidate()
  })
  return null
}

export default function VillageScene({ residents, performance, selected, inside, visible, onHouse, onPerson }: {
  residents: Resident[]; performance?: Performance; selected?: string; inside: boolean; visible: boolean
  onHouse: () => void; onPerson: (id: string) => void
}) {
  const selection = residents.findIndex(person => person.id === selected)
  return <Canvas orthographic camera={{ position: [11, 10, 12], zoom: 1, near: 0.1, far: 80 }}
    dpr={[1, 1.5]} frameloop={visible ? 'demand' : 'never'} shadows={{ type: PCFShadowMap }}
    gl={{ antialias: true }} fallback={<p>3D indisponível. Consulte os moradores abaixo.</p>}>
    <FrameScene inside={inside} target={selection < 0 ? undefined : selection} visible={visible} />
    <color attach="background" args={['#e4dfd5']} /><fog attach="fog" args={['#e4dfd5', 22, 42]} />
    <hemisphereLight args={['#fff5e8', '#a69b8a', 2.05]} />
    <directionalLight position={[-5, 10, 5]} color="#fff3da" intensity={2.6} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-13} shadow-camera-right={13}
      shadow-camera-top={13} shadow-camera-bottom={-13} shadow-camera-far={45} shadow-normalBias={0.026} shadow-bias={-0.00015} shadow-radius={2.8} />
    <VillageLandscape />
    <FamilyHome inside={inside} onClick={onHouse} />
    {residents.map((person, index) => <Character key={person.id} person={person} index={index}
      inside={inside} selected={selected === person.id} playing={performance?.personId === person.id ? performance : undefined}
      visible={visible} select={() => onPerson(person.id)} />)}
  </Canvas>
}
