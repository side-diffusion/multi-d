import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';


const endpoint = import.meta.env.VITE_CLOUDFLARE_ENDPOINT;
const accessKey = import.meta.env.VITE_CLOUDFLARE_ACCESS_KEY;
const secretKey = import.meta.env.VITE_CLOUDFLARE_SERCRET_KEY;

const publicUrl = import.meta.env.VITE_CLOUDFLARE_PUBLIC_ENDPOINT;


const s3 = new S3Client({
  region: 'auto',
  endpoint:endpoint,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});
const BUCKET = 'exhibition2025';

export async function POST({ request }) {
  const { url, ext } = await request.json();

  // 파일 다운로드
  const res = await fetch(url);
  if (!res.ok) return new Response('Download failed', { status: 400 });
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';

  // R2 업로드
  const key = `${Date.now()}${ext || ''}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: contentType,
  }));

  // R2 URL 반환
  const r2Url = `${publicUrl}/${key}`;
  return new Response(JSON.stringify({ url: r2Url }), { headers: { 'Content-Type': 'application/json' } });
}