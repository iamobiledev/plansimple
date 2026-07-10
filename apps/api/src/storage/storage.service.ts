import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream, createReadStream, existsSync, mkdirSync } from "node:fs";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly localDir: string;
  private readonly useLocal: boolean;

  constructor(config: ConfigService) {
    this.bucket = config.get("S3_BUCKET") || "plansimple";
    this.localDir = config.get("FILE_STORAGE_DIR") || path.join(process.cwd(), "uploads");
    const endpoint = config.get("S3_ENDPOINT");
    const driver = config.get("STORAGE_DRIVER") || (endpoint ? "s3" : "local");
    // Prefer S3/MinIO when STORAGE_DRIVER=s3 or endpoint is set.
    this.useLocal = driver === "local";
    if (!this.useLocal) {
      this.s3 = new S3Client({
        region: config.get("S3_REGION") || "us-east-1",
        endpoint,
        forcePathStyle: (config.get("S3_FORCE_PATH_STYLE") || "true") === "true",
        credentials: {
          accessKeyId: config.get("S3_ACCESS_KEY") || "plansimple",
          secretAccessKey: config.get("S3_SECRET_KEY") || "plansimplesecret",
        },
      });
    } else {
      this.s3 = null;
      if (!existsSync(this.localDir)) mkdirSync(this.localDir, { recursive: true });
    }
  }

  async putObject(key: string, body: Buffer | Readable, contentType?: string) {
    if (this.useLocal || !this.s3) {
      const full = path.join(this.localDir, key);
      await mkdir(path.dirname(full), { recursive: true });
      if (Buffer.isBuffer(body)) {
        await writeFile(full, body);
      } else {
        await pipeline(body, createWriteStream(full));
      }
      return;
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getObjectBuffer(key: string): Promise<Buffer> {
    if (this.useLocal || !this.s3) {
      return readFile(path.join(this.localDir, key));
    }
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const stream = res.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async exists(key: string): Promise<boolean> {
    if (this.useLocal || !this.s3) {
      return existsSync(path.join(this.localDir, key));
    }
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /** Presigned PUT for direct browser upload (MinIO/S3). Local mode returns API proxy URL. */
  async getUploadUrl(key: string, contentType = "application/pdf", expiresIn = 3600) {
    if (this.useLocal || !this.s3) {
      return {
        mode: "proxy" as const,
        url: `/api/storage/upload/${encodeURIComponent(key)}`,
        key,
      };
    }
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn }
    );
    return { mode: "s3" as const, url, key };
  }

  async getDownloadUrl(key: string, expiresIn = 3600) {
    if (this.useLocal || !this.s3) {
      return {
        mode: "proxy" as const,
        url: `/api/storage/object/${encodeURIComponent(key)}`,
        key,
      };
    }
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn }
    );
    return { mode: "s3" as const, url, key };
  }

  createLocalReadStream(key: string) {
    return createReadStream(path.join(this.localDir, key));
  }

  localPath(key: string) {
    return path.join(this.localDir, key);
  }
}
