import { useCallback, useEffect, useState } from 'react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import { ThemeProvider } from '@aws-amplify/ui-react';
import { createLivenessSession, getLivenessSessionResults } from '../lib/faceApi';

const REGION = import.meta.env.VITE_AWS_REGION;

export default function LivenessCapture({ onSuccess, onCancel }) {
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      <FaceLivenessDetector
        sessionId={sessionId}
        region={REGION}
        onAnalysisComplete={handleAnalysisComplete}
        onError={handleError}
      />
    </ThemeProvider>
  );
}
