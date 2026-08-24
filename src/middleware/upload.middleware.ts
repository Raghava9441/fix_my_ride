import multer from "multer";
import { Request } from "express";
import { config } from "../config/environment";
import { AppError } from "../utils/appError";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(
      AppError.fromCode("VALIDATION_FAILED", {
        message: `Unsupported file type: ${file.mimetype}`,
      }),
    );
    return;
  }
  cb(null, true);
};

/**
 * In-memory storage — the multer layer only validates and buffers the
 * upload; `storage.service.ts` owns actually persisting the bytes (to disk
 * today, to a real object store later without this middleware changing).
 */
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileSize },
  fileFilter,
}).single("file");
