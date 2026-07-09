import fs from "node:fs/promises";
import path from "node:path";
import { put, del, list } from "@vercel/blob";

/**
 * Storage abstraction for sheet PDFs. Keys are opaque file names (UUIDs).
 *
 * - Local dev: files on disk under FILE_STORAGE_DIR (default ./uploads).
 * - Vercel: serverless filesystems are ephemeral, so when a Blob store is
 *   connected (BLOB_READ_WRITE_TOKEN present) files go to Vercel Blob.
 *   Blob URLs are public-but-unguessable; the app always serves files
 *   through the auth-gated /api/files/[key] route.
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  load(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalDiskStorage implements FileStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    return path.join(this.baseDir, path.basename(key)); // prevent path traversal
  }

  async save(key: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.resolve(key), data);
  }

  async load(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}

class VercelBlobStorage implements FileStorage {
  private async find(key: string): Promise<string | null> {
    const { blobs } = await list({ prefix: path.basename(key), limit: 1 });
    return blobs[0]?.url ?? null;
  }

  async save(key: string, data: Buffer): Promise<void> {
    await put(path.basename(key), data, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/pdf",
    });
  }

  async load(key: string): Promise<Buffer> {
    const url = await this.find(key);
    if (!url) throw new Error(`File not found in blob storage: ${key}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const url = await this.find(key);
    if (url) await del(url);
  }
}

export const storage: FileStorage = process.env.BLOB_READ_WRITE_TOKEN
  ? new VercelBlobStorage()
  : new LocalDiskStorage(process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "uploads"));
