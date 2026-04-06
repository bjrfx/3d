import { create } from 'zustand';
import type { GestureState } from '../types';

export type MoveMode = 'relative' | 'absolute';
export type InteractionMode = 'OBJECT_MODE' | 'CAMERA_MODE';
export type MenuLifecycle = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';
export type LeftMenuStage = 'IDLE' | 'PALM_SHOWN' | 'CONFIRMED';
export type MenuTarget = 'mesh' | `mesh:${MeshKind}` | 'toggle:hud';
export type MeshKind =
  | 'box'
  | 'capsule'
  | 'circle'
  | 'cylinder'
  | 'dodecahedron'
  | 'icosahedron'
  | 'lathe'
  | 'octahedron'
  | 'plane'
  | 'ring'
  | 'sphere'
  | 'sprite'
  | 'tetrahedron'
  | 'torus'
  | 'torusknot'
  | 'tube';

export type InteractionStateLabel = 'IDLE' | 'HOVER' | 'SELECT' | 'DRAG' | 'RELEASE';

interface InteractionState {
  fps: number;
  currentGesture: string;
  selectedObjectId: string | null;
  trackerStatus: 'loading' | 'ready' | 'error';
  showLandmarkOverlay: boolean;
  hudVisible: boolean;
  invertLeftPinch: boolean;
  moveMode: MoveMode;
  interactionMode: InteractionMode;
  interactionState: InteractionStateLabel;
  menuLifecycle: MenuLifecycle;
  leftMenuStage: LeftMenuStage;
  menuHoveredTarget: MenuTarget | null;
  menuHoldTarget: MenuTarget | null;
  menuHoldProgress: number;
  menuHoldStartedAt: number | null;
  menuSubmenuOpen: boolean;
  selectedMeshKind: MeshKind | null;
  sceneInputLocked: boolean;
  setFps: (fps: number) => void;
  setCurrentGesture: (gesture: string) => void;
  setSelectedObjectId: (id: string | null) => void;
  setTrackerStatus: (status: InteractionState['trackerStatus']) => void;
  toggleLandmarkOverlay: () => void;
  toggleHudVisible: () => void;
  toggleInvertLeftPinch: () => void;
  setMoveMode: (mode: MoveMode) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setInteractionState: (state: InteractionStateLabel) => void;
  startMenuOpening: () => void;
  confirmMenuOpen: () => void;
  startMenuClosing: () => void;
  finishMenuClosed: () => void;
  setLeftMenuStage: (stage: LeftMenuStage) => void;
  setMenuHoveredTarget: (target: MenuTarget | null) => void;
  beginMenuHold: (target: MenuTarget, now: number) => void;
  updateMenuHoldProgress: (progress: number) => void;
  cancelMenuHold: () => void;
  setMenuSubmenuOpen: (open: boolean) => void;
  setSelectedMeshKind: (kind: MeshKind | null) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  fps: 0,
  currentGesture: 'IDLE',
  selectedObjectId: null,
  trackerStatus: 'loading',
  showLandmarkOverlay: true,
  hudVisible: true,
  invertLeftPinch: true,
  moveMode: 'relative',
  interactionMode: 'CAMERA_MODE',
  interactionState: 'IDLE',
  menuLifecycle: 'CLOSED',
  leftMenuStage: 'IDLE',
  menuHoveredTarget: null,
  menuHoldTarget: null,
  menuHoldProgress: 0,
  menuHoldStartedAt: null,
  menuSubmenuOpen: false,
  selectedMeshKind: null,
  sceneInputLocked: false,
  setFps: (fps) => set({ fps }),
  setCurrentGesture: (gesture) => set({ currentGesture: gesture }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setTrackerStatus: (trackerStatus) => set({ trackerStatus }),
  toggleLandmarkOverlay: () => set((state) => ({ showLandmarkOverlay: !state.showLandmarkOverlay })),
  toggleHudVisible: () => set((state) => ({ hudVisible: !state.hudVisible })),
  toggleInvertLeftPinch: () => set((state) => ({ invertLeftPinch: !state.invertLeftPinch })),
  setMoveMode: (moveMode) => set({ moveMode }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setInteractionState: (interactionState) => set({ interactionState }),
  startMenuOpening: () =>
    set({ menuLifecycle: 'OPENING', sceneInputLocked: true, menuSubmenuOpen: false }),
  confirmMenuOpen: () => set({ menuLifecycle: 'OPEN', sceneInputLocked: true }),
  startMenuClosing: () =>
    set({
      menuLifecycle: 'CLOSING',
      leftMenuStage: 'IDLE',
      menuHoveredTarget: null,
      menuHoldTarget: null,
      menuHoldProgress: 0,
      menuHoldStartedAt: null,
      menuSubmenuOpen: false,
    }),
  finishMenuClosed: () =>
    set({
      menuLifecycle: 'CLOSED',
      leftMenuStage: 'IDLE',
      menuHoveredTarget: null,
      menuHoldTarget: null,
      menuHoldProgress: 0,
      menuHoldStartedAt: null,
      menuSubmenuOpen: false,
      sceneInputLocked: false,
    }),
  setLeftMenuStage: (leftMenuStage) => set({ leftMenuStage }),
  setMenuHoveredTarget: (menuHoveredTarget) => set({ menuHoveredTarget }),
  beginMenuHold: (menuHoldTarget, menuHoldStartedAt) => set({ menuHoldTarget, menuHoldStartedAt, menuHoldProgress: 0 }),
  updateMenuHoldProgress: (menuHoldProgress) => set({ menuHoldProgress }),
  cancelMenuHold: () => set({ menuHoldTarget: null, menuHoldStartedAt: null, menuHoldProgress: 0 }),
  setMenuSubmenuOpen: (menuSubmenuOpen) => set({ menuSubmenuOpen }),
  setSelectedMeshKind: (selectedMeshKind) => set({ selectedMeshKind }),
}));

export const useOverlayState = () => {
  const fps = useInteractionStore((s) => s.fps);
  const currentGesture = useInteractionStore((s) => s.currentGesture);
  const selectedObjectId = useInteractionStore((s) => s.selectedObjectId);
  const trackerStatus = useInteractionStore((s) => s.trackerStatus);
  const showLandmarkOverlay = useInteractionStore((s) => s.showLandmarkOverlay);
  const hudVisible = useInteractionStore((s) => s.hudVisible);
  const invertLeftPinch = useInteractionStore((s) => s.invertLeftPinch);
  const moveMode = useInteractionStore((s) => s.moveMode);
  const interactionMode = useInteractionStore((s) => s.interactionMode);
  const interactionState = useInteractionStore((s) => s.interactionState);
  const menuLifecycle = useInteractionStore((s) => s.menuLifecycle);
  const leftMenuStage = useInteractionStore((s) => s.leftMenuStage);
  const menuSubmenuOpen = useInteractionStore((s) => s.menuSubmenuOpen);
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const toggleLandmarkOverlay = useInteractionStore((s) => s.toggleLandmarkOverlay);
  const toggleHudVisible = useInteractionStore((s) => s.toggleHudVisible);
  const toggleInvertLeftPinch = useInteractionStore((s) => s.toggleInvertLeftPinch);
  const setMoveMode = useInteractionStore((s) => s.setMoveMode);

  return {
    fps,
    currentGesture,
    selectedObjectId,
    trackerStatus,
    showLandmarkOverlay,
    hudVisible,
    invertLeftPinch,
    moveMode,
    interactionMode,
    interactionState,
    menuLifecycle,
    leftMenuStage,
    menuSubmenuOpen,
    selectedMeshKind,
    toggleLandmarkOverlay,
    toggleHudVisible,
    toggleInvertLeftPinch,
    setMoveMode,
  };
};

export const toGestureLabel = (left: GestureState, right: GestureState): string => {
  if (left === 'TRANSFORM' && right === 'TRANSFORM') {
    return 'TRANSFORM';
  }

  if (right !== 'IDLE') {
    return `RIGHT_${right}`;
  }

  if (left !== 'IDLE') {
    return `LEFT_${left}`;
  }

  return 'IDLE';
};
