import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { trackingRuntime } from '../tracking/runtime';
import { useInteractionStore, type MeshKind } from '../stores/interactionStore';

const CLEAR_HOLD_MS = 400;

const MESH_LABELS: Record<MeshKind, string> = {
  box: 'Box',
  capsule: 'Capsule',
  circle: 'Circle',
  cylinder: 'Cylinder',
  dodecahedron: 'Dodecahedron',
  icosahedron: 'Icosahedron',
  lathe: 'Lathe',
  octahedron: 'Octahedron',
  plane: 'Plane',
  ring: 'Ring',
  sphere: 'Sphere',
  sprite: 'Sprite',
  tetrahedron: 'Tetrahedron',
  torus: 'Torus',
  torusknot: 'TorusKnot',
  tube: 'Tube',
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const SelectedMeshTooltip = () => {
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const setSelectedMeshKind = useInteractionStore((s) => s.setSelectedMeshKind);

  const [clearHoverProgress, setClearHoverProgress] = useState(0);
  const [clearHovered, setClearHovered] = useState(false);
  const holdStartAtRef = useRef<number | null>(null);

  const selectedLabel = useMemo(() => {
    if (!selectedMeshKind) {
      return null;
    }
    return MESH_LABELS[selectedMeshKind] ?? selectedMeshKind;
  }, [selectedMeshKind]);

  useEffect(() => {
    if (!selectedMeshKind) {
      setClearHoverProgress(0);
      setClearHovered(false);
      holdStartAtRef.current = null;
      return;
    }

    let frame = 0;

    const tick = () => {
      const right = trackingRuntime.hands.right;
      const rightState = trackingRuntime.gestures.right;
      const pinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';

      if (!right) {
        setClearHovered(false);
        setClearHoverProgress(0);
        holdStartAtRef.current = null;
        frame = requestAnimationFrame(tick);
        return;
      }

      const tip = right.landmarks[8] ?? right.centroid;
      const x = (1 - tip.x) * window.innerWidth;
      const y = tip.y * window.innerHeight;
      const element = document.elementFromPoint(clamp(x, 0, window.innerWidth), clamp(y, 0, window.innerHeight)) as HTMLElement | null;
      const clearButton = element?.closest('[data-selection-clear="mesh"]') as HTMLElement | null;
      const hovered = Boolean(clearButton);

      setClearHovered(hovered);

      if (!hovered || !pinchActive) {
        setClearHoverProgress(0);
        holdStartAtRef.current = null;
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!holdStartAtRef.current) {
        holdStartAtRef.current = performance.now();
      }

      const elapsed = performance.now() - holdStartAtRef.current;
      const progress = clamp(elapsed / CLEAR_HOLD_MS, 0, 1);
      setClearHoverProgress(progress);

      if (progress >= 1) {
        setSelectedMeshKind(null);
        setClearHovered(false);
        setClearHoverProgress(0);
        holdStartAtRef.current = null;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selectedMeshKind, setSelectedMeshKind]);

  if (!selectedLabel) {
    return null;
  }

  return (
    <div className="selected-mesh-tooltip" aria-live="polite" role="status">
      <span className="selected-mesh-tooltip__label">{selectedLabel}</span>
      <button
        type="button"
        className={[
          'selected-mesh-tooltip__clear',
          clearHovered ? 'is-hovered' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-selection-clear="mesh"
        aria-label="Clear selected mesh"
        onClick={() => setSelectedMeshKind(null)}
      >
        <span aria-hidden="true">X</span>
        {clearHovered && (
          <span
            className="selected-mesh-tooltip__clear-fill"
            style={{ '--clear-progress': String(clearHoverProgress) } as CSSProperties}
          />
        )}
      </button>
    </div>
  );
};
