import { useEffect, useRef, useState } from 'react';
import {
  type MeshKind,
  type ToolMode,
  useInteractionStore,
} from '../stores/interactionStore';
import { trackingRuntime } from '../tracking/runtime';

const toolItems: ToolMode[] = ['SELECT', 'DRAG', 'TRANSFORM', 'SCALE', 'ROTATE', 'MESHES'];
const meshItems: MeshKind[] = ['sphere', 'cube', 'capsule', 'circle', 'cylinder', 'torus'];

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const FloatingMenu = () => {
  const menuOpen = useInteractionStore((s) => s.menuOpen);
  const activeTool = useInteractionStore((s) => s.activeTool);
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const invertLeftPinch = useInteractionStore((s) => s.invertLeftPinch);
  const setMenuHoverActive = useInteractionStore((s) => s.setMenuHoverActive);
  const setMenuOpen = useInteractionStore((s) => s.setMenuOpen);
  const setActiveTool = useInteractionStore((s) => s.setActiveTool);
  const setSelectedMeshKind = useInteractionStore((s) => s.setSelectedMeshKind);
  const toggleInvertLeftPinch = useInteractionStore((s) => s.toggleInvertLeftPinch);
  const setLastAction = useInteractionStore((s) => s.setLastAction);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const pinchPrevRef = useRef(false);

  const applyMenuSelection = (item: string) => {
    if (item === 'toggle:rail') {
      setMenuOpen(!menuOpen);
      setLastAction(`Tool rail: ${menuOpen ? 'Collapsed' : 'Expanded'}`);
      return;
    }

    if (item.startsWith('tool:')) {
      const tool = item.replace('tool:', '') as ToolMode;
      setActiveTool(tool);
      setLastAction(`${tool} tool selected`);
      return;
    }

    if (item.startsWith('mesh:')) {
      const mesh = item.replace('mesh:', '') as MeshKind;
      setSelectedMeshKind(mesh);
      setLastAction(`${titleCase(mesh)} selected`);
      return;
    }

    if (item === 'toggle:left-pinch-invert') {
      toggleInvertLeftPinch();
      setLastAction(`Left pinch inverted: ${invertLeftPinch ? 'Off' : 'On'}`);
      return;
    }

    if (item === 'close') {
      setMenuOpen(false);
      setLastAction('Menu closed');
    }
  };

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      const right = trackingRuntime.hands.right;
      const rightState = trackingRuntime.gestures.right;
      const pinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';

      let nextHovered: string | null = null;
      if (right) {
        const tip = right.landmarks[8] ?? right.centroid;
        const x = (1 - tip.x) * window.innerWidth;
        const y = tip.y * window.innerHeight;

        setCursor({ x, y, visible: true });
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        const selectable = el?.closest('[data-menu-item]') as HTMLElement | null;
        if (selectable) {
          nextHovered = selectable.dataset.menuItem ?? null;
        }
      } else {
        setCursor((current) => ({ ...current, visible: false }));
      }

      setHoveredItem(nextHovered);
      setMenuHoverActive(Boolean(nextHovered));

      if (pinchActive && !pinchPrevRef.current && nextHovered) {
        applyMenuSelection(nextHovered);
      }
      pinchPrevRef.current = pinchActive;

      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(raf);
      setMenuHoverActive(false);
      setCursor((current) => ({ ...current, visible: false }));
      setHoveredItem(null);
      pinchPrevRef.current = false;
    };
  }, [
    invertLeftPinch,
    menuOpen,
    setActiveTool,
    setLastAction,
    setMenuHoverActive,
    setMenuOpen,
    setSelectedMeshKind,
    toggleInvertLeftPinch,
  ]);

  return (
    <div className={menuOpen ? 'tool-rail' : 'tool-rail tool-rail--collapsed'} role="dialog" aria-label="Tool rail">
      <div className="tool-rail__header">
        <h2>Tools</h2>
        <button
          type="button"
          className="tool-rail__collapse"
          data-menu-item="toggle:rail"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setLastAction(`Tool rail: ${menuOpen ? 'Collapsed' : 'Expanded'}`);
          }}
        >
          {menuOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {menuOpen && (
        <>
          <p className="tool-rail__section-title">Transform</p>
          <div className="tool-rail__group">
            {toolItems.map((tool) => (
              <button
                key={tool}
                type="button"
                data-menu-item={`tool:${tool}`}
                className={
                  [
                    tool === activeTool ? 'tool-rail__button tool-rail__button--active' : 'tool-rail__button',
                    hoveredItem === `tool:${tool}` ? 'tool-rail__button--hover' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                onClick={() => {
                  setActiveTool(tool);
                  setLastAction(`${tool} tool selected`);
                }}
              >
                {titleCase(tool.toLowerCase())}
              </button>
            ))}
          </div>

          <p className="tool-rail__section-title">Meshes</p>
          <div className="tool-rail__group tool-rail__group--meshes">
            {meshItems.map((mesh) => (
              <button
                key={mesh}
                type="button"
                data-menu-item={`mesh:${mesh}`}
                className={
                  [
                    mesh === selectedMeshKind ? 'tool-rail__button tool-rail__button--active' : 'tool-rail__button',
                    hoveredItem === `mesh:${mesh}` ? 'tool-rail__button--hover' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                onClick={() => {
                  setSelectedMeshKind(mesh);
                  setLastAction(`${titleCase(mesh)} selected`);
                }}
              >
                {titleCase(mesh)}
              </button>
            ))}
          </div>

          <p className="tool-rail__section-title">Camera</p>
          <div className="tool-rail__group">
            <button
              type="button"
              data-menu-item="toggle:left-pinch-invert"
              className={
                [
                  invertLeftPinch ? 'tool-rail__button tool-rail__button--active' : 'tool-rail__button',
                  hoveredItem === 'toggle:left-pinch-invert' ? 'tool-rail__button--hover' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
              onClick={() => {
                toggleInvertLeftPinch();
                setLastAction(`Left pinch inverted: ${invertLeftPinch ? 'Off' : 'On'}`);
              }}
            >
              Left Pinch Invert: {invertLeftPinch ? 'On' : 'Off'}
            </button>
          </div>
        </>
      )}

      {cursor.visible && (
        <div
          className="tool-rail__cursor"
          style={{ left: `${cursor.x}px`, top: `${cursor.y}px` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};
