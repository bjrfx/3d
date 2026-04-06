import { useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { CatmullRomCurve3, Color, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import type { MeshKind } from '../stores/interactionStore';

interface InteractiveObjectProps {
  id: string;
  selected: boolean;
  kind: MeshKind;
  position: [number, number, number];
  preview?: boolean;
  onReady: (id: string, mesh: Mesh) => void;
}

export const getMeshYOffset = (kind: MeshKind): number => {
  switch (kind) {
    case 'plane':
    case 'ring':
    case 'circle':
    case 'sprite':
      return 0.04;
    case 'capsule':
      return 0.9;
    case 'cylinder':
      return 0.75;
    case 'lathe':
    case 'tube':
      return 0.55;
    default:
      return 0.62;
  }
};

const meshColor = (kind: MeshKind): string => {
  switch (kind) {
    case 'sphere':
      return '#ff8f4c';
    case 'capsule':
      return '#63d6ff';
    case 'cylinder':
      return '#6f8eff';
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'tetrahedron':
      return '#9ad37a';
    case 'torus':
    case 'torusknot':
    case 'tube':
      return '#c392ff';
    case 'plane':
    case 'ring':
    case 'circle':
    case 'sprite':
      return '#7ec2ff';
    default:
      return '#3498db';
  }
};

const MeshGeometry = ({ kind }: { kind: MeshKind }) => {
  const lathePoints = useMemo(
    () => [
      new Vector2(0, -0.55),
      new Vector2(0.35, -0.45),
      new Vector2(0.48, -0.12),
      new Vector2(0.4, 0.2),
      new Vector2(0.2, 0.5),
      new Vector2(0.05, 0.62),
    ],
    []
  );

  const tubeCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.45, 0, -0.15),
        new Vector3(-0.12, 0.4, 0.25),
        new Vector3(0.22, -0.18, 0.32),
        new Vector3(0.45, 0.24, -0.18),
      ]),
    []
  );

  switch (kind) {
    case 'box':
      return <boxGeometry args={[1.2, 1.2, 1.2]} />;
    case 'capsule':
      return <capsuleGeometry args={[0.34, 0.9, 10, 20]} />;
    case 'circle':
      return <circleGeometry args={[0.72, 48]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.48, 0.48, 1.5, 30]} />;
    case 'dodecahedron':
      return <dodecahedronGeometry args={[0.72, 0]} />;
    case 'icosahedron':
      return <icosahedronGeometry args={[0.72, 0]} />;
    case 'lathe':
      return <latheGeometry args={[lathePoints, 32]} />;
    case 'octahedron':
      return <octahedronGeometry args={[0.74, 0]} />;
    case 'plane':
      return <planeGeometry args={[1.3, 1.3]} />;
    case 'ring':
      return <ringGeometry args={[0.34, 0.7, 40]} />;
    case 'sphere':
      return <sphereGeometry args={[0.78, 32, 32]} />;
    case 'sprite':
      return <planeGeometry args={[1.1, 1.1]} />;
    case 'tetrahedron':
      return <tetrahedronGeometry args={[0.82, 0]} />;
    case 'torus':
      return <torusGeometry args={[0.62, 0.22, 24, 60]} />;
    case 'torusknot':
      return <torusKnotGeometry args={[0.56, 0.16, 96, 18]} />;
    case 'tube':
      return <tubeGeometry args={[tubeCurve, 54, 0.22, 14, false]} />;
    default:
      return <boxGeometry args={[1.2, 1.2, 1.2]} />;
  }
};

export const InteractiveObject = ({
  id,
  selected,
  kind,
  position,
  preview = false,
  onReady,
}: InteractiveObjectProps) => {
  const meshRef = useRef<Mesh>(null);
  const baseColor = useMemo(() => new Color(meshColor(kind)), [kind]);

  const register = () => {
    if (meshRef.current) {
      onReady(id, meshRef.current);
    }
  };

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: baseColor,
      roughness: 0.28,
      metalness: 0.15,
      transparent: preview,
      opacity: preview ? 0.34 : 1,
      emissive: selected ? '#2fd6a2' : preview ? '#89d5ff' : '#000000',
      emissiveIntensity: selected ? 0.45 : preview ? 0.15 : 0,
    });
    return m;
  }, [baseColor, preview, selected]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      material={material}
      onUpdate={register}
      userData={{ selectable: !preview, interactionId: id }}
      castShadow
      receiveShadow
    >
      <MeshGeometry kind={kind} />
      {selected && (
        <group>
          <axesHelper args={[1.9]} />
          <Text position={[2.05, 0, 0]} fontSize={0.16} color="#ff4d4d" anchorX="center" anchorY="middle">
            X
          </Text>
          <Text position={[0, 2.05, 0]} fontSize={0.16} color="#5cf05c" anchorX="center" anchorY="middle">
            Y
          </Text>
          <Text position={[0, 0, 2.05]} fontSize={0.16} color="#4fa5ff" anchorX="center" anchorY="middle">
            Z
          </Text>
        </group>
      )}
    </mesh>
  );
};
