import { useState } from 'react';
import { useOverlayState } from '../stores/interactionStore';
import { usePhysicsStore } from '../physics/physicsStore';

export const Overlay = () => {
  const {
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
    toggleInvertLeftPinch,
    setMoveMode,
  } = useOverlayState();
  const gravityMode = usePhysicsStore((s) => s.gravityMode);
  const worldGravityStrength = usePhysicsStore((s) => s.worldGravityStrength);
  const zeroGravityLinearDamping = usePhysicsStore((s) => s.zeroGravityLinearDamping);
  const planetSourceObjectId = usePhysicsStore((s) => s.planetSourceObjectId);
  const planetGravityStrength = usePhysicsStore((s) => s.planetGravityStrength);
  const planetGravityRadius = usePhysicsStore((s) => s.planetGravityRadius);
  const setGravityMode = usePhysicsStore((s) => s.setGravityMode);
  const setWorldGravityStrength = usePhysicsStore((s) => s.setWorldGravityStrength);
  const setZeroGravityLinearDamping = usePhysicsStore((s) => s.setZeroGravityLinearDamping);
  const setPlanetSourceObjectId = usePhysicsStore((s) => s.setPlanetSourceObjectId);
  const setPlanetGravityStrength = usePhysicsStore((s) => s.setPlanetGravityStrength);
  const setPlanetGravityRadius = usePhysicsStore((s) => s.setPlanetGravityRadius);

  const [isOpen, setIsOpen] = useState(false);

  if (!hudVisible) {
    return null;
  }

  return (
    <div className="hud">
      <div className="hud__card">
        {/* Header */}
        <div className="hud__header">
          <h1>Interaction HUD</h1>

          <button
            className="hud__eye"
            onClick={() => setIsOpen(!isOpen)}
            type="button"
          >
            {isOpen ? (
              // Eye Open 👁
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
                />
              </svg>
            ) : (
              // Eye Closed 🚫👁
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M2 5l17 17M10.58 10.58A3 3 0 0 0 13.42 13.42M9.88 5.08A9.77 9.77 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-4.35 5.26M6.1 6.1C3.97 7.73 2.5 10 2 12c0 0 3 7 10 7a9.77 9.77 0 0 0 4.1-.9"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        {isOpen && (
          <>
            <p>FPS: {fps.toFixed(1)}</p>
            <p>Gesture: {currentGesture}</p>
            <p>Selected: {selectedObjectId ?? 'None'}</p>
            <p>Mode: {interactionMode}</p>
            <p>State: {interactionState}</p>
            <p>Menu: {menuLifecycle}</p>
            <p>Left Menu Stage: {leftMenuStage}</p>
            <p>Submenu: {menuSubmenuOpen ? 'Open' : 'Closed'}</p>
            <p>Mesh Kind: {selectedMeshKind ?? 'None'}</p>
            <p>Status: {trackerStatus}</p>
            <p>Gravity Mode: {gravityMode}</p>

            <div className="hud__controls">
              <button onClick={toggleLandmarkOverlay} type="button">
                Overlay: {showLandmarkOverlay ? 'On' : 'Off'}
              </button>

              <button
                onClick={() =>
                  setMoveMode(moveMode === 'relative' ? 'absolute' : 'relative')
                }
                type="button"
              >
                Move: {moveMode}
              </button>

              <button
                onClick={() => setGravityMode(gravityMode === 'ZERO_G' ? 'WORLD_G' : 'ZERO_G')}
                type="button"
              >
                0 Gravity: {gravityMode === 'ZERO_G' ? 'On' : 'Off'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="hud__card">
        <div className="hud__header">
          <h1>Scene Physics</h1>
        </div>
        <div className="hud__switch-row">
          <span>Invert Left Pinch</span>
          <button
            aria-label="Toggle invert left pinch"
            aria-pressed={invertLeftPinch}
            className={`hud__switch ${invertLeftPinch ? 'is-on' : ''}`}
            onClick={toggleInvertLeftPinch}
            type="button"
          >
            <span className="hud__switch-thumb" />
          </button>
        </div>
        <div className="hud__physics-row">
          <span>Mode</span>
          <div className="hud__segmented">
            <button className={gravityMode === 'ZERO_G' ? 'is-active' : ''} onClick={() => setGravityMode('ZERO_G')} type="button">
              0G
            </button>
            <button className={gravityMode === 'WORLD_G' ? 'is-active' : ''} onClick={() => setGravityMode('WORLD_G')} type="button">
              World
            </button>
            <button className={gravityMode === 'PLANET_G' ? 'is-active' : ''} onClick={() => setGravityMode('PLANET_G')} type="button">
              Planet
            </button>
          </div>
        </div>
        <div className="hud__physics-row">
          <span>World Gravity</span>
          <input
            max={4}
            min={0.1}
            onChange={(event) => setWorldGravityStrength(Number(event.target.value))}
            step={0.05}
            type="range"
            value={worldGravityStrength}
          />
          <strong>{worldGravityStrength.toFixed(2)}x</strong>
        </div>
        <div className="hud__physics-row">
          <span>0G Damping</span>
          <input
            max={1.5}
            min={0}
            onChange={(event) => setZeroGravityLinearDamping(Number(event.target.value))}
            step={0.01}
            type="range"
            value={zeroGravityLinearDamping}
          />
          <strong>{zeroGravityLinearDamping.toFixed(2)}</strong>
        </div>
        <div className="hud__physics-row">
          <span>Planet Strength</span>
          <input
            max={120}
            min={0}
            onChange={(event) => setPlanetGravityStrength(Number(event.target.value))}
            step={1}
            type="range"
            value={planetGravityStrength}
          />
          <strong>{planetGravityStrength.toFixed(0)}</strong>
        </div>
        <div className="hud__physics-row">
          <span>Planet Radius</span>
          <input
            max={120}
            min={1}
            onChange={(event) => setPlanetGravityRadius(Number(event.target.value))}
            step={1}
            type="range"
            value={planetGravityRadius}
          />
          <strong>{planetGravityRadius.toFixed(0)}</strong>
        </div>
        <div className="hud__controls hud__controls--stacked">
          <button onClick={() => selectedObjectId && setPlanetSourceObjectId(selectedObjectId)} type="button">
            Set Selected As Planet
          </button>
          <button onClick={() => setPlanetSourceObjectId(null)} type="button">
            Clear Planet Source
          </button>
        </div>
        <p>Planet Source: {planetSourceObjectId ?? 'None'}</p>
      </div>

      <p className="hud__tip">
        Stage 1 active: right hand pinch selects, right hand grab performs smoothed X/Y/Z object drag.
      </p>
    </div>
  );
};