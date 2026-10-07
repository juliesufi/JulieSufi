import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
export function publicMediaRoot() {
  return path.join(process.cwd(), "public");
}

export function uploadTempRoot() {
  return path.join(process.cwd(), ".uploads-temp");
}

export function resolveMediaKey(key: string) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized.startsWith("images" + path.sep) && !normalized.startsWith("images/") &&
      !normalized.startsWith("videos" + path.sep) && !normalized.startsWith("videos/")) {
    throw new Error("Invalid media key.");
  }
  return path.join(publicMediaRoot(), normalized.split("/").join(path.sep));
}

export async function ensureMediaDir(key: string) {
  const filePath = resolveMediaKey(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  return filePath;
}

export async function writeMediaFile(key: string, data: Uint8Array | Buffer) {
  const filePath = await ensureMediaDir(key);
  await writeFile(filePath, data);
  return filePath;
}

export async function writeMediaStream(key: string, stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    chunks.push(chunk.value);
  }
  const length = chunks.reduce((total, part) => total + part.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return writeMediaFile(key, bytes);
}

export async function mediaFileStat(key: string) {
  const filePath = resolveMediaKey(key);
  if (!existsSync(filePath)) return null;
  const info = await stat(filePath);
  return { path: filePath, size: info.size };
}

export async function deleteMediaFile(key: string) {
  const filePath = resolveMediaKey(key);
  if (existsSync(filePath)) await rm(filePath, { force: true });
}

export async function readMediaFile(key: string, range?: { offset: number; length: number }) {
  const filePath = resolveMediaKey(key);
  if (!existsSync(filePath)) return null;
  const info = await stat(filePath);
  if (range) {
    const buffer = Buffer.alloc(range.length);
    const handle = await import("node:fs/promises").then((fs) => fs.open(filePath, "r"));
    try {
      await handle.read(buffer, 0, range.length, range.offset);
    } finally {
      await handle.close();
    }
    return { body: buffer, size: info.size, contentType: contentTypeForKey(key) };
  }
  const buffer = await readFile(filePath);
  return { body: buffer, size: info.size, contentType: contentTypeForKey(key) };
}

function contentTypeForKey(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

export function nodeReadableToWeb(body: Buffer, offset: number, length: number) {
  const slice = body.subarray(offset, offset + length);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(slice);
      controller.close();
    },
  });
}

export function createMediaReadStream(key: string, start?: number, end?: number) {
  const filePath = resolveMediaKey(key);
  return createReadStream(filePath, start !== undefined && end !== undefined ? { start, end } : undefined);
}

export async function ensureUploadTempDir(id: string) {
  const dir = path.join(uploadTempRoot(), id);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function writeUploadPart(id: string, part: number, bytes: Uint8Array) {
  const dir = await ensureUploadTempDir(id);
  await writeFile(path.join(dir, String(part)), bytes);
}

export async function assembleUploadParts(id: string, key: string, partCount: number, expectedSize: number) {
  const dir = path.join(uploadTempRoot(), id);
  const filePath = await ensureMediaDir(key);
  const handle = await import("node:fs/promises").then((fs) => fs.open(filePath, "w"));
  let written = 0;
  try {
    for (let part = 1; part <= partCount; part++) {
      const chunk = await readFile(path.join(dir, String(part)));
      await handle.write(chunk);
      written += chunk.byteLength;
    }
  } finally {
    await handle.close();
  }
  await rm(dir, { recursive: true, force: true });
  if (written !== expectedSize) {
    await deleteMediaFile(key);
    throw new Error("Size mismatch");
  }
  return filePath;
}

export async function abortUploadSession(id: string) {
  await rm(path.join(uploadTempRoot(), id), { recursive: true, force: true });
}
