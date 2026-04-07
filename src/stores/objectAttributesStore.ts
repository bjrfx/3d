import { create } from 'zustand';
import type { MeshKind } from './interactionStore';

export interface GeometryData {
  type: string;
  vertices: number;
  faces: number;
}

export interface SceneObjectAttributes {
  id: string;
  name: string;
  kind: MeshKind;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  color: string;
  opacity: number;
  geometry: GeometryData;
}

interface ObjectAttributesState {
  objects: SceneObjectAttributes[];
  nextId: number;
  addObject: (object: Omit<SceneObjectAttributes, 'id'>) => string;
  updateObject: (id: string, patch: Partial<Omit<SceneObjectAttributes, 'id' | 'kind'>>) => void;
  updateObjectVector: (
    id: string,
    field: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2,
    value: number
  ) => void;
  setObjectGeometry: (id: string, geometry: GeometryData) => void;
}

const DEFAULT_GEOMETRY: GeometryData = {
  type: 'Unknown',
  vertices: 0,
  faces: 0,
};

const makeDefaultObject = (
  id: string,
  kind: MeshKind,
  name: string,
  position: [number, number, number],
  color: string
): SceneObjectAttributes => ({
  id,
  name,
  kind,
  position,
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  color,
  opacity: 1,
  geometry: DEFAULT_GEOMETRY,
});

export const useObjectAttributesStore = create<ObjectAttributesState>()((set) => ({
  objects: [
    makeDefaultObject('mesh-1', 'box', 'Primary Box', [-1.8, 0.62, 0], '#3498db'),
    makeDefaultObject('mesh-2', 'sphere', 'Accent Sphere', [1.8, 0.62, 0], '#ff8f4c'),
  ],
  nextId: 3,
  addObject: (object) => {
    let id = '';
    set((state) => {
      id = `mesh-${state.nextId}`;
      return {
        nextId: state.nextId + 1,
        objects: [
          ...state.objects,
          {
            ...object,
            id,
          },
        ],
      };
    });
    return id;
  },
  updateObject: (id, patch) =>
    set((state) => {
      const index = state.objects.findIndex((obj) => obj.id === id);
      if (index < 0) {
        return state;
      }

      const current = state.objects[index];
      const next = { ...current, ...patch };
      if (
        next.name === current.name &&
        next.visible === current.visible &&
        next.color === current.color &&
        next.opacity === current.opacity &&
        next.position === current.position &&
        next.rotation === current.rotation &&
        next.scale === current.scale
      ) {
        return state;
      }

      const objects = [...state.objects];
      objects[index] = next;
      return { objects };
    }),
  updateObjectVector: (id, field, axis, value) =>
    set((state) => {
      const index = state.objects.findIndex((obj) => obj.id === id);
      if (index < 0) {
        return state;
      }

      const current = state.objects[index];
      const currentValue = current[field][axis];
      if (Math.abs(currentValue - value) < 1e-6) {
        return state;
      }

      const vector = [...current[field]] as [number, number, number];
      vector[axis] = value;
      const objects = [...state.objects];
      objects[index] = {
        ...current,
        [field]: vector,
      };
      return { objects };
    }),
  setObjectGeometry: (id, geometry) =>
    set((state) => {
      const index = state.objects.findIndex((obj) => obj.id === id);
      if (index < 0) {
        return state;
      }

      const current = state.objects[index];
      if (
        current.geometry.type === geometry.type &&
        current.geometry.vertices === geometry.vertices &&
        current.geometry.faces === geometry.faces
      ) {
        return state;
      }

      const objects = [...state.objects];
      objects[index] = {
        ...current,
        geometry,
      };
      return { objects };
    }),
}));