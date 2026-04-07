export type GravityMode = 'ZERO_G' | 'WORLD_G' | 'PLANET_G';

export interface PhysicsMaterial {
  mass: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  gravityScale: number;
}

export interface PlanetGravityConfig {
  sourceObjectId: string | null;
  strength: number;
  radius: number;
}

export const DEFAULT_PHYSICS_MATERIAL: PhysicsMaterial = {
  mass: 1,
  friction: 0.72,
  restitution: 0.14,
  linearDamping: 0.1,
  angularDamping: 0.35,
  gravityScale: 1,
};
