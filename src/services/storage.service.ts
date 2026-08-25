import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { config } from "../config/environment";

export interface StoredFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  storageProvider: "local" | "cloudinary";
  url: string;
  path: string;
}

let cloudinaryConfigured = false;
function getCloudinary() {
  if (!cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: config.storage.cloudinary.cloudName,
      api_key: config.storage.cloudinary.apiKey,
      api_secret: config.storage.cloudinary.apiSecret,
      secure: true,
    });
    cloudinaryConfigured = true;
  }
  return cloudinary;
}

const UPLOAD_ROOT = config.storage.uploadDir || path.join("public", "uploads");

function safeExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  // Only keep a small, expected extension; anything unusual is dropped rather
  // than trusted verbatim into a filesystem path.
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

/**
 * Storage backend dispatch. `local` (default) writes under
 * `public/uploads/<entityType>/`, which `app.ts` already serves statically
 * at `/uploads`. `cloudinary` uploads to the configured Cloudinary account.
 * `s3`/`gcs`/`azure` are valid schema values for STORAGE_PROVIDER but have
 * no SDK integration in this codebase yet — calling this service with one
 * of those configured throws rather than silently writing to disk anyway.
 */
export class StorageService {
  async saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    subfolder = "documents",
  ): Promise<StoredFile> {
    if (config.storage.provider === "cloudinary") {
      return this.saveToCloudinary(buffer, originalName, mimeType, subfolder);
    }

    if (config.storage.provider !== "local") {
      throw new Error(
        `Storage provider "${config.storage.provider}" is not implemented yet — only "local" and "cloudinary" are wired up.`,
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

  private async saveToCloudinary(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    subfolder: string,
  ): Promise<StoredFile> {
    const extension = safeExtension(originalName);
    const client = getCloudinary();

    const result = await new Promise<{ secure_url: string; public_id: string; bytes: number }>(
      (resolve, reject) => {
        const uploadStream = client.uploader.upload_stream(
          { folder: subfolder, resource_type: "auto" },
          (err, res) => {
            if (err || !res) return reject(err ?? new Error("Cloudinary upload returned no result"));
            resolve(res as any);
          },
        );
        uploadStream.end(buffer);
      },
    );

    return {
      fileName: result.public_id,
      originalName,
      mimeType,
      size: result.bytes ?? buffer.length,
      extension,
      storageProvider: "cloudinary",
      url: result.secure_url,
      path: result.public_id,
    };
  }

  async deleteFile(subfolder: string, fileName: string): Promise<void> {
    if (config.storage.provider === "cloudinary") {
      await getCloudinary().uploader.destroy(fileName).catch(() => {});
      return;
    }

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
