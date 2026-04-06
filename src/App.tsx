import { useRef } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { useHandTracking } from './tracking/useHandTracking';
import { Overlay } from './ui/Overlay';

const App = () => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  useHandTracking(overlayCanvasRef);

  return (
    <div className="app-shell">
      <SceneRoot />
      <Overlay />
      <canvas className="landmark-canvas" ref={overlayCanvasRef} />
    </div>
  );
};

export default App;
