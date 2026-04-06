import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { trackingRuntime } from '../tracking/runtime';
import { useInteractionStore, type MenuTarget, type MeshKind } from '../stores/interactionStore';

interface CursorState {
  x: number;
  y: number;
  visible: boolean;
}

interface Anchor {
  x: number;
  y: number;
}

const HOLD_MS_ITEM = 400;
const HOLD_MS_SUBMENU = 700;

const MESH_ITEMS: Array<{ kind: MeshKind; label: string }> = [
  { kind: 'box', label: 'Box' },
  { kind: 'capsule', label: 'Capsule' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'cylinder', label: 'Cylinder' },
  { kind: 'dodecahedron', label: 'Dodecahedron' },
  { kind: 'icosahedron', label: 'Icosahedron' },
  { kind: 'lathe', label: 'Lathe' },
  { kind: 'octahedron', label: 'Octahedron' },
  { kind: 'plane', label: 'Plane' },
  { kind: 'ring', label: 'Ring' },
  { kind: 'sphere', label: 'Sphere' },
  { kind: 'sprite', label: 'Sprite' },
  { kind: 'tetrahedron', label: 'Tetrahedron' },
  { kind: 'torus', label: 'Torus' },
  { kind: 'torusknot', label: 'TorusKnot' },
  { kind: 'tube', label: 'Tube' },
];

const getHoldMsForTarget = (target: MenuTarget): number => {
  return target === 'mesh' ? HOLD_MS_SUBMENU : HOLD_MS_ITEM;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const FloatingMenu = () => {
  const menuLifecycle = useInteractionStore((s) => s.menuLifecycle);
  const leftMenuStage = useInteractionStore((s) => s.leftMenuStage);
  const menuHoveredTarget = useInteractionStore((s) => s.menuHoveredTarget);
  const menuHoldTarget = useInteractionStore((s) => s.menuHoldTarget);
  const menuHoldProgress = useInteractionStore((s) => s.menuHoldProgress);
  const menuSubmenuOpen = useInteractionStore((s) => s.menuSubmenuOpen);
  const selectedMeshKind = useInteractionStore((s) => s.selectedMeshKind);
  const hudVisible = useInteractionStore((s) => s.hudVisible);

  const meshButtonRef = useRef<HTMLButtonElement | null>(null);
  const committedInPinchRef = useRef(false);
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, visible: false });
  const [submenuAnchor, setSubmenuAnchor] = useState<Anchor>({ x: 356, y: 176 });

  const menuVisible = menuLifecycle !== 'CLOSED';

  const rootClassName = useMemo(() => {
    const classes = ['floating-menu'];
    if (menuLifecycle === 'OPEN' || menuLifecycle === 'OPENING') {
      classes.push('is-open');
    }
    if (menuLifecycle === 'CLOSING') {
      classes.push('is-closing');
    }
    return classes.join(' ');
  }, [menuLifecycle]);

  useEffect(() => {
    if (!menuSubmenuOpen || !meshButtonRef.current) {
      return;
    }

    const syncAnchor = () => {
      if (!meshButtonRef.current) {
        return;
      }
      const rect = meshButtonRef.current.getBoundingClientRect();
      setSubmenuAnchor({
        x: rect.right + 14,
        y: rect.top + rect.height * 0.5,
      });
    };

    syncAnchor();
    window.addEventListener('resize', syncAnchor);
    return () => window.removeEventListener('resize', syncAnchor);
  }, [menuSubmenuOpen]);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const ui = useInteractionStore.getState();
      const right = trackingRuntime.hands.right;
      const rightState = trackingRuntime.gestures.right;
      const pinchActive = rightState === 'PINCH' || rightState === 'TRANSFORM';

      if (!menuVisible || !right) {
        if (cursor.visible) {
          setCursor((prev) => ({ ...prev, visible: false }));
        }
        if (ui.menuHoveredTarget) {
          ui.setMenuHoveredTarget(null);
        }
        if (ui.menuHoldTarget) {
          ui.cancelMenuHold();
        }
        committedInPinchRef.current = false;
        frame = requestAnimationFrame(tick);
        return;
      }

      const tip = right.landmarks[8] ?? right.centroid;
      const x = (1 - tip.x) * window.innerWidth;
      const y = tip.y * window.innerHeight;

      setCursor({ x, y, visible: true });

      const element = document.elementFromPoint(clamp(x, 0, window.innerWidth), clamp(y, 0, window.innerHeight)) as HTMLElement | null;
      const targetEl = element?.closest('[data-menu-target]') as HTMLElement | null;
      const hovered = (targetEl?.dataset.menuTarget as MenuTarget | undefined) ?? null;
      const hoveredMeshTrigger = hovered === 'mesh';
      const hoveredMeshItem = hovered?.startsWith('mesh:') ?? false;
      const hoveredHudToggle = hovered === 'toggle:hud';

      if (hovered !== ui.menuHoveredTarget) {
        ui.setMenuHoveredTarget(hovered);
      }

      if (hoveredMeshTrigger) {
        if (ui.menuSubmenuOpen) {
          if (ui.menuHoldTarget === 'mesh') {
            ui.cancelMenuHold();
          }
          committedInPinchRef.current = false;
          frame = requestAnimationFrame(tick);
          return;
        }

        if (!ui.menuHoldTarget || ui.menuHoldTarget !== 'mesh' || !ui.menuHoldStartedAt) {
          ui.beginMenuHold('mesh', performance.now());
          frame = requestAnimationFrame(tick);
          return;
        }

        const elapsed = performance.now() - ui.menuHoldStartedAt;
        const progress = clamp(elapsed / HOLD_MS_SUBMENU, 0, 1);
        ui.updateMenuHoldProgress(progress);

        if (progress >= 1) {
          ui.setMenuSubmenuOpen(true);
          ui.cancelMenuHold();
        }

        committedInPinchRef.current = false;
        frame = requestAnimationFrame(tick);
        return;
      }

      if (hoveredHudToggle) {
        if (!pinchActive) {
          if (ui.menuHoldTarget) {
            ui.cancelMenuHold();
          }
          committedInPinchRef.current = false;
          frame = requestAnimationFrame(tick);
          return;
        }

        if (committedInPinchRef.current) {
          frame = requestAnimationFrame(tick);
          return;
        }

        if (!ui.menuHoldTarget || ui.menuHoldTarget !== 'toggle:hud' || !ui.menuHoldStartedAt) {
          ui.beginMenuHold('toggle:hud', performance.now());
          frame = requestAnimationFrame(tick);
          return;
        }

        const elapsed = performance.now() - ui.menuHoldStartedAt;
        const progress = clamp(elapsed / HOLD_MS_ITEM, 0, 1);
        ui.updateMenuHoldProgress(progress);

        if (progress >= 1) {
          ui.toggleHudVisible();
          committedInPinchRef.current = true;
          ui.cancelMenuHold();
        }

        frame = requestAnimationFrame(tick);
        return;
      }

      if (!pinchActive || !hovered || !hoveredMeshItem) {
        if (ui.menuHoldTarget) {
          ui.cancelMenuHold();
        }
        committedInPinchRef.current = false;
        frame = requestAnimationFrame(tick);
        return;
      }

      if (committedInPinchRef.current) {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (!ui.menuHoldTarget || ui.menuHoldTarget !== hovered || !ui.menuHoldStartedAt) {
        ui.beginMenuHold(hovered, performance.now());
        frame = requestAnimationFrame(tick);
        return;
      }

      const requiredMs = getHoldMsForTarget(hovered);
      const elapsed = performance.now() - ui.menuHoldStartedAt;
      const progress = clamp(elapsed / requiredMs, 0, 1);
      ui.updateMenuHoldProgress(progress);

      if (progress >= 1) {
        if (hovered.startsWith('mesh:')) {
          const kind = hovered.replace('mesh:', '') as MeshKind;
          ui.setSelectedMeshKind(kind);
        }

        committedInPinchRef.current = true;
        ui.cancelMenuHold();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    cursor.visible,
    menuVisible,
  ]);

  return (
    <>
      <aside className={rootClassName} aria-label="Spatial command panel" role="dialog" data-left-stage={leftMenuStage}>
        <div className="floating-menu__header">
          <p className="floating-menu__eyebrow">Spatial Menu</p>
        </div>

        <button
          ref={meshButtonRef}
          type="button"
          className={[
            'floating-menu__item',
            menuHoveredTarget === 'mesh' ? 'is-hovered' : '',
            menuSubmenuOpen ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-menu-target="mesh"
        >
          <span>Mesh</span>
          <span className="floating-menu__chevron">&gt;</span>
          {menuHoldTarget === 'mesh' && !menuSubmenuOpen && (
            <span className="floating-menu__hold" style={{ '--hold-progress': String(menuHoldProgress) } as CSSProperties} />
          )}
        </button>

        <div
          className={[
            'floating-menu__toggle-row',
            menuHoveredTarget === 'toggle:hud' ? 'is-hovered' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-menu-target="toggle:hud"
        >
          <span className="floating-menu__toggle-label">Show HUD</span>
          <span
            className={[
              'floating-menu__switch',
              hudVisible ? 'is-on' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="floating-menu__switch-thumb" />
          </span>
          {menuHoldTarget === 'toggle:hud' && (
            <span className="floating-menu__hold" style={{ '--hold-progress': String(menuHoldProgress) } as CSSProperties} />
          )}
        </div>
      </aside>

      <aside
        className={[
          'floating-submenu',
          menuSubmenuOpen && menuVisible ? 'is-open' : '',
          menuLifecycle === 'CLOSING' ? 'is-closing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ left: `${submenuAnchor.x}px`, top: `${submenuAnchor.y}px` }}
        aria-label="Mesh presets"
      >
        {MESH_ITEMS.map((item) => {
          const target = `mesh:${item.kind}` as MenuTarget;
          const hovered = menuHoveredTarget === target;
          const selected = selectedMeshKind === item.kind;
          const holding = menuHoldTarget === target;

          return (
            <button
              key={item.kind}
              type="button"
              className={[
                'floating-submenu__item',
                hovered ? 'is-hovered' : '',
                selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              data-menu-target={target}
            >
              <span>{item.label}</span>
              {holding && (
                <span
                  className="floating-submenu__hold"
                  style={{ '--hold-progress': String(menuHoldProgress) } as CSSProperties}
                />
              )}
            </button>
          );
        })}
      </aside>

      <div
        className={['floating-cursor', cursor.visible && menuVisible ? 'is-visible' : '']
          .filter(Boolean)
          .join(' ')}
        style={{ left: `${cursor.x}px`, top: `${cursor.y}px` }}
      />
    </>
  );
};
