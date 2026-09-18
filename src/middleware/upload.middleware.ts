import multer from "multer";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { config } from "../config/environment";
import { AppError } from "../utils/appError";
import { asyncLocalStorage } from "./requestContext.middleware";

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
const multerSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxFileSize },
  fileFilter,
}).single("file");

/**
 * Busboy reads the multipart body from socket "data" events whose async
 * resources were created when the connection opened — before
 * `requestContext` entered its AsyncLocalStorage scope. The store is
 * therefore gone by the time multer calls next(), so everything downstream
 * of an upload sees an empty context: `tenantPlugin` stamps no tenantId on
 * save and scopes every subsequent read to nothing, which silently makes
 * freshly uploaded documents unreadable. Re-entering the store that was
 * active when this middleware ran restores it for the rest of the chain.
 * Only multipart requests lose it, which is why this went unnoticed.
 */
export const uploadSingle: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const store = asyncLocalStorage.getStore();
  multerSingle(req, res, (err?: unknown) => {
    if (!store) return next(err);
    asyncLocalStorage.run(store, () => next(err));
  });
};
