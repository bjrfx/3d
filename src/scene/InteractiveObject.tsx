import { useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import { Color, Mesh, MeshStandardMaterial } from 'three';

interface InteractiveObjectProps {
  id: string;
  selected: boolean;
  kind: 'cube' | 'sphere';
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
  const baseColor = useMemo(() => new Color(kind === 'cube' ? '#3498db' : '#ff8f4c'), [kind]);

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
      onUpdate={register}
      userData={{ selectable: true, interactionId: id }}
      castShadow
      receiveShadow
    >
      {kind === 'cube' ? <boxGeometry args={[1.2, 1.2, 1.2]} /> : <sphereGeometry args={[0.78, 32, 32]} />}
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
