import { useOverlayState } from '../stores/interactionStore';import { useOverlayState } from '../stores/interactionStore';
































































};  );    </div>      )}        </>          </p>            DCC layout active: use the left rail for Select, Drag, Transform, Scale, Rotate, and mesh creation.          <p className="hud__tip">          </div>            </div>              </button>                Move: {moveMode}              >                type="button"                onClick={() => setMoveMode(moveMode === 'relative' ? 'absolute' : 'relative')}              <button              </button>                Overlay: {showLandmarkOverlay ? 'On' : 'Off'}              <button onClick={toggleLandmarkOverlay} type="button">            <div className="hud__controls">            <p>Status: {trackerStatus}</p>            <p>Action: {lastAction}</p>            <p>Rail: {menuOpen ? 'Open' : 'Collapsed'}</p>            <p>Left Pinch Invert: {invertLeftPinch ? 'On' : 'Off'}</p>            <p>Mesh: {selectedMeshKind}</p>            <p>Tool: {activeTool}</p>            <p>State: {interactionState}</p>            <p>Mode: {interactionMode}</p>            <p>Selected: {selectedObjectId ?? 'None'}</p>            <p>Gesture: {currentGesture}</p>            <p>FPS: {fps.toFixed(1)}</p>            <h1>Two-Hand Interaction</h1>          <div className="hud__card">        <>      {showDiagnostics && (      </button>        {showDiagnostics ? 'Hide Panel' : 'Show Panel'}      <button className="hud__eye" onClick={toggleDiagnostics} type="button">    <div className="hud">  return (  } = useOverlayState();    setMoveMode,    toggleLandmarkOverlay,    toggleDiagnostics,    lastAction,    selectedMeshKind,    invertLeftPinch,    activeTool,    menuOpen,    showDiagnostics,    interactionState,    interactionMode,    moveMode,    showLandmarkOverlay,    trackerStatus,    selectedObjectId,    currentGesture,    fps,  const {export const Overlay = () => {
export const Overlay = () => {
  const {
    fps,
    currentGesture,
    selectedObjectId,
    trackerStatus,
    showLandmarkOverlay,
    moveMode,
    interactionMode,
    interactionState,
    showDiagnostics,
    showDiagnostics,
    menuOpen,
    activeTool,
    invertLeftPinch,
    selectedMeshKind,
    lastAction,
    toggleDiagnostics,
    toggleLandmarkOverlay,
    toggleDiagnostics,
    setMoveMode,
  } = useOverlayState();

      <button className="hud__eye" onClick={toggleDiagnostics} type="button">
        {showDiagnostics ? 'Hide Panel' : 'Show Panel'}
      </button>

      {showDiagnostics && (
        <>
          <div className="hud__card">
            <h1>Two-Hand Interaction</h1>
            <p>FPS: {fps.toFixed(1)}</p>
            <p>Gesture: {currentGesture}</p>
            <p>Selected: {selectedObjectId ?? 'None'}</p>
            <p>Mode: {interactionMode}</p>
            <p>State: {interactionState}</p>
            <p>Tool: {activeTool}</p>
            <p>Mesh: {selectedMeshKind}</p>
            <p>Left Pinch Invert: {invertLeftPinch ? 'On' : 'Off'}</p>
            <p>Rail: {menuOpen ? 'Open' : 'Collapsed'}</p>
            <p>Action: {lastAction}</p>
            <p>Status: {trackerStatus}</p>
            <div className="hud__controls">
              <button onClick={toggleLandmarkOverlay} type="button">
                Overlay: {showLandmarkOverlay ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setMoveMode(moveMode === 'relative' ? 'absolute' : 'relative')}
                type="button"
              >
                Move: {moveMode}
              </button>
            </div>
          </div>
          <p className="hud__tip">
            DCC layout active: use the left rail for Select, Drag, Transform, Scale, Rotate, and mesh creation.
          </p>
        </>
      )}
              >
                Move: {moveMode}
              </button>
            </div>
          </div>
          <p className="hud__tip">
            Right pinch selects objects. Use the left tool rail for Select, Drag, Transform, Scale, Rotate and mesh creation.
          </p>
        </>
      )}
    </div>
  );
};
