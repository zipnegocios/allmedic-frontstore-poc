import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: getEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

function getBucket(): string {
  return getEnv("R2_BUCKET");
}

export async function presignPut(key: string, mimeType: string, sizeBytes: number): Promise<string> {
  // No se firma Cache-Control aquí: el bucket R2 solo permite Content-Type/Content-Length
  // en su política CORS (ver plan de imágenes), y cualquier header adicional en la firma
  // obliga al navegador a incluirlo en el preflight — si no está en AllowedHeaders del bucket,
  // el preflight falla con CORS y la subida se bloquea por completo.
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 15 * 60 });
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function copyObject(fromKey: string, toKey: string): Promise<void> {
  const bucket = getBucket();
  await getClient().send(new CopyObjectCommand({
    Bucket: bucket,
    Key: toKey,
    CopySource: `${bucket}/${encodeURIComponent(fromKey)}`,
  }));
}

export async function headObject(key: string): Promise<{ sizeBytes: number; mimeType?: string } | null> {
  try {
    const result = await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return { sizeBytes: result.ContentLength ?? 0, mimeType: result.ContentType };
  } catch {
    return null;
  }
}

export async function putObject(key: string, body: Buffer, mimeType: string, cacheControl?: string): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: mimeType,
    CacheControl: cacheControl,
  }));
}
