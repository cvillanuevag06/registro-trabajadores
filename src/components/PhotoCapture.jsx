import { useEffect, useRef, useState } from 'react';

export default function PhotoCapture({ onCapture, label = '📷 Tomar foto' }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOpen(true);
    } catch {
      setError('No se pudo acceder a la cámara.');
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stop();
    onCapture(dataUrl);
  };

  if (error) {
    return (
      <>
        <div className="al al-e" style={{ display: 'block' }}>{error}</div>
        <button className="btn btn-s" type="button" onClick={start}>Reintentar</button>
      </>
    );
  }

  if (!open) {
    return (
      <button className="btn btn-s" type="button" onClick={start} style={{ fontSize: 13 }}>{label}</button>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div className="cam-wrap" style={{ aspectRatio: '4/3', marginBottom: 8 }}>
        <video ref={videoRef} autoPlay playsInline muted></video>
        <div className="cam-over">
          <div className="oval det"></div>
          <div className="cam-msg">Coloca la cara en el óvalo</div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      <button className="btn btn-s" type="button" onClick={capture} style={{ fontSize: 13 }}>📸 Capturar foto</button>
    </div>
  );
}
