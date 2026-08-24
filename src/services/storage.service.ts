import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "../config/environment";

export interface StoredFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  storageProvider: "local";
  url: string;
  path: string;
}

const UPLOAD_ROOT = config.storage.uploadDir || path.join("public", "uploads");

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  // Only keep a small, expected extension; anything unusual is dropped rather
  // than trusted verbatim into a filesystem path.
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

/**
 * Local-disk storage backend — matches the default `STORAGE_PROVIDER=local`.
 * Files land under `public/uploads/<entityType>/`, which `app.ts` already
 * serves statically at `/uploads`. `s3`/`cloudinary` are valid schema values
 * for STORAGE_PROVIDER but have no SDK integration in this codebase yet —
 * calling this service with anything other than local storage configured
 * throws rather than silently writing to disk anyway.
 */
export class StorageService {
  async saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    subfolder = "documents",
  ): Promise<StoredFile> {
    if (config.storage.provider !== "local") {
      throw new Error(
        `Storage provider "${config.storage.provider}" is not implemented yet — only "local" is wired up.`,
      );
    }

    const extension = safeExtension(originalName);
    const fileName = `${crypto.randomBytes(16).toString("hex")}${extension}`;
    const dir = path.join(UPLOAD_ROOT, subfolder);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);

    return {
      fileName,
      originalName,
      mimeType,
      size: buffer.length,
      extension,
      storageProvider: "local",
      url: `/uploads/${subfolder}/${fileName}`,
      path: filePath,
    };
  }

  async deleteFile(subfolder: string, fileName: string): Promise<void> {
    const filePath = path.join(UPLOAD_ROOT, subfolder, fileName);
    await fs.unlink(filePath).catch((err) => {
      if (err.code !== "ENOENT") throw err;
    });
  }

  resolvePath(subfolder: string, fileName: string): string {
    return path.join(UPLOAD_ROOT, subfolder, fileName);
  }
}

export const storageService = new StorageService();
