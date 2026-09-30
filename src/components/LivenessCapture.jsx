import { Component, useCallback, useEffect, useState } from 'react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import { ThemeProvider } from '@aws-amplify/ui-react';
import { createLivenessSession, getLivenessSessionResults } from '../lib/faceApi';

const REGION = import.meta.env.VITE_AWS_REGION;

// The SDK hardcodes a low ideal resolution (640x480) for its getUserMedia call, which on
// high-res phone cameras can make the browser crop to a narrow field of view (digital zoom),
// forcing the user uncomfortably close. Widen the ideal resolution so the browser picks a
// wider crop, while this component is mounted. Kept modest (not e.g. 1920x1440) because the
// SDK also hardcodes a frameRate floor of 15fps and throws if it isn't met — asking for too
// high a resolution on a phone's front camera risks the browser negotiating a lower frame
// rate to compensate, silently tripping that check.
function useWiderCameraFOV() {
  useEffect(() => {
    // The SDK persists the last-used camera's deviceId in localStorage and reuses it as an
    // "ideal" preference on future sessions. Earlier testing forced the rear camera, which left
    // this stale, so the SDK keeps preferring it even though we no longer force a deviceId.
    localStorage.removeItem('AmplifyLivenessCameraId');
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.video && typeof constraints.video === 'object') {
        const widened = {
          ...constraints,
          video: { ...constraints.video, width: { ideal: 1280 }, height: { ideal: 960 } },
        };
        try {
          return await original(widened);
        } catch (e) {
          // Some phone cameras can't satisfy the widened resolution together with the SDK's
          // 15fps floor and throw (e.g. OverconstrainedError). Fall back to the SDK's own
          // default constraints rather than leaving the user with a hard camera failure.
          console.error('Widened camera request failed, falling back to default constraints:', e);
          return original(constraints);
        }
      }
      return original(constraints);
    };
    return () => {
      navigator.mediaDevices.getUserMedia = original;
    };
  }, []);
}

// The SDK's camera-acquisition logic runs inside an async state machine service and can throw
// (e.g. "no camera found with more than 15fps") in a way that never reaches onError or React's
// error boundary — it just leaves the screen blank. Catch those here so the user always sees a
// message instead of a dead screen.
function useUncaughtLivenessErrors(onUncaught) {
  useEffect(() => {
    const handleRejection = (event) => onUncaught(event.reason);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, [onUncaught]);
}

class LivenessErrorBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err) {
    console.error('Liveness crashed:', err);
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="al al-e" style={{ display: 'block' }}>Ocurrió un error con la cámara. Intenta de nuevo.</div>
          <button className="btn btn-p" onClick={this.props.onRetry}>Reintentar</button>
          {this.props.onCancel && <button className="btn btn-s" onClick={this.props.onCancel}>Cancelar</button>}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LivenessCapture({ onSuccess, onCancel }) {
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useWiderCameraFOV();

  const handleUncaught = useCallback((reason) => {
    console.error('Liveness uncaught error:', reason);
    setError(`Ocurrió un error con la cámara: ${reason?.message || reason}. Intenta de nuevo.`);
  }, []);
  useUncaughtLivenessErrors(handleUncaught);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError('');
    setSessionId(null);
    try {
      const id = await createLivenessSession();
      setSessionId(id);
    } catch {
      setError('No se pudo iniciar la verificación facial.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { startSession(); }, [startSession]);

  const handleAnalysisComplete = async () => {
    try {
      const result = await getLivenessSessionResults(sessionId);
      if (result.live && result.referenceImageBase64) {
        onSuccess(result.referenceImageBase64);
      } else {
        setError('No se pudo verificar que eres una persona real. Intenta de nuevo.');
      }
    } catch {
      setError('Error al verificar el resultado. Intenta de nuevo.');
    }
  };

  const handleError = (err) => {
    console.error('Liveness error:', err);
    setError('Ocurrió un error con la cámara. Intenta de nuevo.');
  };

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="al al-e" style={{ display: 'block' }}>{error}</div>
        <button className="btn btn-p" onClick={startSession}>Reintentar</button>
        {onCancel && <button className="btn btn-s" onClick={onCancel}>Cancelar</button>}
      </div>
    );
  }

  if (loading || !sessionId) {
    return (
      <div className="einit">
        <div className="spin"></div>
        <p>Preparando verificación facial...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <LivenessErrorBoundary key={sessionId} onRetry={startSession} onCancel={onCancel}>
        <FaceLivenessDetector
          sessionId={sessionId}
          region={REGION}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
        />
      </LivenessErrorBoundary>
    </ThemeProvider>
  );
}
