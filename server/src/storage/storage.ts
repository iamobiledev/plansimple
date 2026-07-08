import fs from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction so local disk can be swapped for S3 later.
 * Keys are opaque file names (no path separators).
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  load(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorage implements FileStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const safe = path.basename(key); // prevent path traversal
    return path.join(this.baseDir, safe);
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

export const storage: FileStorage = new LocalDiskStorage(
  process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "uploads")
);
