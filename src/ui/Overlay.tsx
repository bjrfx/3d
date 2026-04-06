import { useState } from 'react';
import { useOverlayState } from '../stores/interactionStore';

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
    toggleLandmarkOverlay,
    setMoveMode,
  } = useOverlayState();

  const [isOpen, setIsOpen] = useState(true);

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
            <p>Status: {trackerStatus}</p>

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
            </div>
          </>
        )}
      </div>

      <p className="hud__tip">
        Stage 1 active: right hand pinch selects, right hand grab performs smoothed X/Y/Z object drag.
      </p>
    </div>
  );
};