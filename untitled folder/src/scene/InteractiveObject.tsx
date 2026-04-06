import { useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { Color, Mesh, MeshStandardMaterial } from 'three';
import type { MeshKind } from '../stores/interactionStore';

interface InteractiveObjectProps {
  id: string;
  selected: boolean;
  kind: MeshKind;
  position: [number, number, number];
  onReady: (id: string, mesh: Mesh) => void;
}

export const InteractiveObject = ({
  id,
  selected,
  kind,
  position,
  onReady,
}: InteractiveObjectProps) => {
  const meshRef = useRef<Mesh>(null);
  const baseColor = useMemo(() => {
    switch (kind) {
      case 'cube':
        return new Color('#3498db');
      case 'sphere':
        return new Color('#ff8f4c');
      case 'capsule':
        return new Color('#ff5d9e');
      case 'circle':
        return new Color('#6fd3ff');
      case 'cylinder':
        return new Color('#c18cff');
      case 'torus':
        return new Color('#55d99b');
      default:
        return new Color('#c7d4ed');
    }
  }, [kind]);

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
      emissive: selected ? '#2fd6a2' : '#000000',
      emissiveIntensity: selected ? 0.45 : 0,
    });
    return m;
  }, [baseColor, selected]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      material={material}
      rotation={kind === 'circle' ? [-Math.PI / 2, 0, 0] : undefined}
      onUpdate={register}
      userData={{ selectable: true, interactionId: id }}
      castShadow
      receiveShadow
    >
      {kind === 'cube' && <boxGeometry args={[1.2, 1.2, 1.2]} />}
      {kind === 'sphere' && <sphereGeometry args={[0.78, 32, 32]} />}
      {kind === 'capsule' && <capsuleGeometry args={[0.52, 1.15, 6, 16]} />}
      {kind === 'circle' && <circleGeometry args={[0.9, 40]} />}
      {kind === 'cylinder' && <cylinderGeometry args={[0.6, 0.6, 1.5, 28]} />}
      {kind === 'torus' && <torusGeometry args={[0.72, 0.22, 18, 50]} />}
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
