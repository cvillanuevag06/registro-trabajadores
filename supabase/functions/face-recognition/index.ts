import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AWS_ACCESS_KEY = Deno.env.get('AWS_ACCESS_KEY_ID') || '';
const AWS_SECRET_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY') || '';
const AWS_REGION = 'us-east-1';
const COLLECTION_ID = 'umma-workers';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg));
}

async function sha256hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Generic AWS SigV4 request (works for any JSON or Query-protocol service) =====
async function awsRequest(opts: {
  service: string;
  host: string;
  region: string;
  target?: string; // x-amz-target header, used by JSON-protocol services (rekognition, cognito-identity)
  contentType: string;
  bodyStr: string;
}): Promise<{ status: number; data: any; rawText: string }> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256hex(opts.bodyStr);

  const headerLines: [string, string][] = [
    ['content-type', opts.contentType],
    ['host', opts.host],
    ['x-amz-date', amzDate],
  ];
  if (opts.target) headerLines.push(['x-amz-target', opts.target]);
  headerLines.sort((a, b) => a[0].localeCompare(b[0]));

  const signedHeaders = headerLines.map(h => h[0]).join(';');
  const canonicalHeaders = headerLines.map(h => `${h[0]}:${h[1]}\n`).join('');
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256hex(canonicalRequest)].join('\n');

  const kDate = await hmac(new TextEncoder().encode('AWS4' + AWS_SECRET_KEY), dateStamp);
  const kRegion = await hmac(kDate, opts.region);
  const kService = await hmac(kRegion, opts.service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': opts.contentType,
    'X-Amz-Date': amzDate,
    'Authorization': authHeader,
  };
  if (opts.target) fetchHeaders['X-Amz-Target'] = opts.target;

  const resp = await fetch(`https://${opts.host}/`, {
    method: 'POST',
    headers: fetchHeaders,
    body: opts.bodyStr,
  });

  const rawText = await resp.text();
  let data: any = null;
  try { data = JSON.parse(rawText); } catch (_e) { data = null; }
  return { status: resp.status, data, rawText };
}

async function rekognitionRequest(target: string, body: unknown): Promise<{ status: number, data: any }> {
  const r = await awsRequest({
    service: 'rekognition',
    host: `rekognition.${AWS_REGION}.amazonaws.com`,
    region: AWS_REGION,
    target: `RekognitionService.${target.replace(/^RekognitionService\./, '')}`,
    contentType: 'application/x-amz-json-1.1',
    bodyStr: JSON.stringify(body),
  });
  return { status: r.status, data: r.data ?? { parseError: true, rawText: r.rawText } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
      return json({ error: 'AWS credentials not configured in Supabase Secrets' }, 500);
    }

    const body = await req.json();
    const { action, image_base64, external_id, face_id } = body;

    // ===== TEST: verificar conexión con AWS =====
    if (action === 'test') {
      const r = await rekognitionRequest('ListCollections', {});
      return json({ awsStatus: r.status, awsResponse: r.data });
    }

    // ===== INDEX: registrar cara =====
    if (action === 'index') {
      if (!image_base64 || !external_id) return json({ error: 'image_base64 y external_id requeridos' }, 400);

      const r = await rekognitionRequest('IndexFaces', {
        CollectionId: COLLECTION_ID,
        Image: { Bytes: image_base64 },
        ExternalImageId: external_id,
        MaxFaces: 1,
        QualityFilter: 'NONE',
      });

      if (r.status !== 200) {
        return json({ faceId: null, error: 'AWS error', awsStatus: r.status, awsResponse: r.data });
      }
      if (r.data.FaceRecords && r.data.FaceRecords.length > 0) {
        return json({ faceId: r.data.FaceRecords[0].Face.FaceId });
      }
      return json({ faceId: null, error: 'No face detected', unindexed: r.data.UnindexedFaces || [] });
    }

    // ===== SEARCH: buscar cara =====
    if (action === 'search') {
      if (!image_base64) return json({ error: 'image_base64 requerido' }, 400);

      const r = await rekognitionRequest('SearchFacesByImage', {
        CollectionId: COLLECTION_ID,
        Image: { Bytes: image_base64 },
        MaxFaces: 1,
        FaceMatchThreshold: 70,
      });

      if (r.status !== 200) {
        return json({ faceId: null, similarity: 0, externalId: null, error: 'AWS error', awsStatus: r.status, awsResponse: r.data });
      }
      if (r.data.FaceMatches && r.data.FaceMatches.length > 0) {
        const match = r.data.FaceMatches[0];
        return json({ faceId: match.Face.FaceId, similarity: match.Similarity, externalId: match.Face.ExternalImageId || null });
      }
      return json({ faceId: null, similarity: 0, externalId: null });
    }

    // ===== DELETE: eliminar cara =====
    if (action === 'delete') {
      if (!face_id) return json({ error: 'face_id requerido' }, 400);
      const r = await rekognitionRequest('DeleteFaces', {
        CollectionId: COLLECTION_ID,
        FaceIds: [face_id],
      });
      return json({ deleted: r.status === 200, awsStatus: r.status });
    }

    // ===== CREATE-LIVENESS-SESSION: iniciar sesión de Face Liveness =====
    if (action === 'create-liveness-session') {
      const r = await rekognitionRequest('CreateFaceLivenessSession', {});
      if (r.status !== 200) {
        return json({ error: 'AWS error', awsStatus: r.status, awsResponse: r.data }, 500);
      }
      return json({ sessionId: r.data.SessionId });
    }

    // ===== GET-LIVENESS-SESSION-RESULTS: obtener resultado de la sesión =====
    if (action === 'get-liveness-session-results') {
      const { session_id } = body;
      if (!session_id) return json({ error: 'session_id requerido' }, 400);
      const r = await rekognitionRequest('GetFaceLivenessSessionResults', { SessionId: session_id });
      if (r.status !== 200) {
        return json({ error: 'AWS error', awsStatus: r.status, awsResponse: r.data }, 500);
      }
      return json({
        status: r.data.Status,
        confidence: r.data.Confidence,
        referenceImage: r.data.ReferenceImage?.Bytes || null,
      });
    }

    return json({ error: 'Acción no reconocida' }, 400);

  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
