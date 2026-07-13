const FACE_FUNCTION_URL = import.meta.env.VITE_FACE_FUNCTION_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callFaceFunction(body) {
  const resp = await fetch(FACE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return resp.json();
}

const stripDataUrl = (base64Img) => base64Img.split(',')[1] || base64Img;

export async function indexFace(base64Img, externalId) {
  try {
    const data = await callFaceFunction({
      action: 'index',
      image_base64: stripDataUrl(base64Img),
      external_id: externalId,
    });
    if (data.faceId) return data.faceId;
    console.error('indexFace error:', data.error);
    return null;
  } catch (e) {
    console.error('indexFace error', e);
    return null;
  }
}

const MATCH_CONF = 80;

export async function searchFace(base64Img) {
  try {
    const data = await callFaceFunction({
      action: 'search',
      image_base64: stripDataUrl(base64Img),
    });
    if (data.faceId && data.similarity >= MATCH_CONF) {
      return { found: true, faceId: data.faceId, similarity: data.similarity, externalId: data.externalId };
    }
    return { found: false };
  } catch (e) {
    console.error('searchFace error', e);
    return { found: false };
  }
}

export async function findWorkerByFace(base64Img, workers) {
  const r = await searchFace(base64Img);
  if (!r.found || !r.externalId || !r.externalId.startsWith('worker_')) return { found: false };
  const wId = r.externalId.replace('worker_', '');
  const worker = workers.find((w) => String(w.id) === wId);
  if (!worker) return { found: false };
  return { found: true, worker, similarity: r.similarity };
}

export async function findSupervisorByFace(base64Img, sups) {
  const r = await searchFace(base64Img);
  if (!r.found || !r.externalId || !r.externalId.startsWith('sup_')) return { found: false };
  const sId = r.externalId.replace('sup_', '');
  const sup = sups.find((s) => String(s.id) === sId);
  if (!sup) return { found: false };
  return { found: true, sup, similarity: r.similarity };
}

export async function deleteFace(faceId) {
  try {
    await callFaceFunction({ action: 'delete', face_id: faceId });
  } catch (e) {
    console.error('deleteFace error', e);
  }
}

export async function createLivenessSession() {
  const data = await callFaceFunction({ action: 'create-liveness-session' });
  if (!data.sessionId) throw new Error(data.error || 'No se pudo crear la sesión de liveness');
  return data.sessionId;
}

export async function getLivenessSessionResults(sessionId) {
  const data = await callFaceFunction({ action: 'get-liveness-session-results', session_id: sessionId });
  if (data.error) throw new Error(data.error);
  return {
    live: data.status === 'SUCCEEDED' && data.confidence >= 85,
    confidence: data.confidence,
    referenceImageBase64: data.referenceImage ? `data:image/jpeg;base64,${data.referenceImage}` : null,
  };
}
