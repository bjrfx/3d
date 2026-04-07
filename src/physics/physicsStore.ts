import { create } from 'zustand';
import type { GravityMode } from './types';

interface PhysicsState {
  gravityMode: GravityMode;
  worldGravityStrength: number;
  zeroGravityLinearDamping: number;
  zeroGravityAngularDamping: number;
  planetSourceObjectId: string | null;
  planetGravityStrength: number;
  planetGravityRadius: number;
  setGravityMode: (mode: GravityMode) => void;
  setWorldGravityStrength: (value: number) => void;
  setZeroGravityLinearDamping: (value: number) => void;
  setZeroGravityAngularDamping: (value: number) => void;
  setPlanetSourceObjectId: (id: string | null) => void;
  setPlanetGravityStrength: (value: number) => void;
  setPlanetGravityRadius: (value: number) => void;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const usePhysicsStore = create<PhysicsState>((set) => ({
  gravityMode: 'WORLD_G',
  worldGravityStrength: 1,
  zeroGravityLinearDamping: 0.08,
  zeroGravityAngularDamping: 0.22,
  planetSourceObjectId: null,
  planetGravityStrength: 14,
  planetGravityRadius: 18,
  setGravityMode: (gravityMode) => set({ gravityMode }),
  setWorldGravityStrength: (worldGravityStrength) => set({ worldGravityStrength: clamp(worldGravityStrength, 0.05, 4) }),
  setZeroGravityLinearDamping: (zeroGravityLinearDamping) =>
    set({ zeroGravityLinearDamping: clamp(zeroGravityLinearDamping, 0, 2) }),
  setZeroGravityAngularDamping: (zeroGravityAngularDamping) =>
    set({ zeroGravityAngularDamping: clamp(zeroGravityAngularDamping, 0, 2) }),
  setPlanetSourceObjectId: (planetSourceObjectId) => set({ planetSourceObjectId }),
  setPlanetGravityStrength: (planetGravityStrength) => set({ planetGravityStrength: clamp(planetGravityStrength, 0, 120) }),
  setPlanetGravityRadius: (planetGravityRadius) => set({ planetGravityRadius: clamp(planetGravityRadius, 1, 120) }),
}));
