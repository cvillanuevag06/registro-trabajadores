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

export async function deleteFace(faceId) {
  try {
    await callFaceFunction({ action: 'delete', face_id: faceId });
  } catch (e) {
    console.error('deleteFace error', e);
  }
}
