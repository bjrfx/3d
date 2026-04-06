import { useRef } from 'react';
import { SceneRoot } from './scene/SceneRoot';
import { useHandTracking } from './tracking/useHandTracking';
import { FloatingMenu } from './ui/FloatingMenu';
import { Overlay } from './ui/Overlay';
import { SelectedMeshTooltip } from './ui/SelectedMeshTooltip';

const App = () => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  useHandTracking(overlayCanvasRef);

  return (
    <div className="app-shell">
      <SceneRoot />
      <FloatingMenu />
      <SelectedMeshTooltip />
      <Overlay />
      <canvas className="landmark-canvas" ref={overlayCanvasRef} />
    </div>
  );
};

export default App;
