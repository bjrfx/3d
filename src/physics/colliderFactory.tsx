import { BallCollider, CapsuleCollider, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { JSX } from 'react';
import type { MeshKind } from '../stores/interactionStore';
import type { PhysicsMaterial } from './types';

const safeHalf = (value: number): number => Math.max(0.02, value / 2);

export const createColliderForKind = (
  kind: MeshKind,
  scale: [number, number, number],
  material: Pick<PhysicsMaterial, 'friction' | 'restitution'>
): JSX.Element => {
  const [sx, sy, sz] = scale;
  const materialProps = {
    friction: material.friction,
    restitution: material.restitution,
  };

  switch (kind) {
    case 'box':
      return <CuboidCollider args={[0.6 * sx, 0.6 * sy, 0.6 * sz]} {...materialProps} />;
    case 'sphere':
      return <BallCollider args={[0.78 * Math.max(sx, sy, sz)]} {...materialProps} />;
    case 'capsule':
      return <CapsuleCollider args={[safeHalf(0.9 * sy), 0.34 * Math.max(sx, sz)]} {...materialProps} />;
    case 'cylinder':
      return <CylinderCollider args={[safeHalf(1.5 * sy), 0.48 * Math.max(sx, sz)]} {...materialProps} />;
    case 'torus':
    case 'torusknot':
      return <BallCollider args={[0.84 * Math.max(sx, sy, sz)]} {...materialProps} />;
    case 'plane':
    case 'ring':
    case 'circle':
    case 'sprite':
      return <CuboidCollider args={[0.66 * sx, 0.04 * sy, 0.66 * sz]} {...materialProps} />;
    case 'lathe':
    case 'tube':
      return <CapsuleCollider args={[safeHalf(1 * sy), 0.38 * Math.max(sx, sz)]} {...materialProps} />;
    case 'dodecahedron':
    case 'icosahedron':
    case 'octahedron':
    case 'tetrahedron':
      return <BallCollider args={[0.8 * Math.max(sx, sy, sz)]} {...materialProps} />;
    default:
      return <CuboidCollider args={[0.6 * sx, 0.6 * sy, 0.6 * sz]} {...materialProps} />;
  }
};
