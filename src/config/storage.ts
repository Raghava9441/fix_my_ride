// src/config/storage.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { config } from "./environment";
import { logger } from "./logger";

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

export interface StorageConfig {
  provider: "local" | "s3" | "cloudinary";
  localPath: string;
  s3Config?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
    region?: string;
  };
  cloudinaryConfig?: {
    cloudName?: string;
    apiKey?: string;
    apiSecret?: string;
  };
}

const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getLocalStoragePath = (): string => {
  const uploadDir =
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  ensureDirectoryExists(uploadDir);
  return uploadDir;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = getLocalStoragePath();
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB default
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".pdf",
      ".csv",
      ".xls",
      ".xlsx",
    ];

    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowed =
      allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext);

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 10);
export const uploadFields = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "documents", maxCount: 3 },
]);

const localDeleteFile = async (filePath: string): Promise<void> => {
  const fullPath = path.join(getLocalStoragePath(), filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    logger.info(`Deleted file: ${fullPath}`);
  }
};

const localListFiles = async (dirPath?: string): Promise<string[]> => {
  const targetPath = dirPath
    ? path.join(getLocalStoragePath(), dirPath)
    : getLocalStoragePath();
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  return fs.readdirSync(targetPath);
};

export const getStorageConfig = (): StorageConfig => {
  const storageProvider = config.storage.provider || "local";

  const storageConfig: StorageConfig = {
    provider: storageProvider as "local" | "s3" | "cloudinary",
    localPath: getLocalStoragePath(),
  };

  if (storageProvider === "s3" && config.storage.s3) {
    storageConfig.s3Config = {
      accessKeyId: config.storage.s3.accessKeyId,
      secretAccessKey: config.storage.s3.secretAccessKey,
      bucket: config.storage.s3.bucket,
      region: config.storage.s3.region,
    };
  }

  if (storageProvider === "cloudinary" && config.storage.cloudinary) {
    storageConfig.cloudinaryConfig = {
      cloudName: config.storage.cloudinary.cloudName,
      apiKey: config.storage.cloudinary.apiKey,
      apiSecret: config.storage.cloudinary.apiSecret,
    };
  }

  return storageConfig;
};

export const storageDeleteFile = async (filePath: string): Promise<void> => {
  const provider = config.storage.provider || "local";

  switch (provider) {
    case "local":
      await localDeleteFile(filePath);
      break;
    case "s3":
    case "cloudinary":
      logger.warn(`${provider} storage not fully implemented`);
      break;
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
};

export const storageListFiles = async (dirPath?: string): Promise<string[]> => {
  const provider = config.storage.provider || "local";

  switch (provider) {
    case "local":
      return localListFiles(dirPath);
    case "s3":
    case "cloudinary":
      logger.warn(`${provider} storage not fully implemented`);
      return [];
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
};

export const checkStorageHealth = async (): Promise<{
  status: string;
  message: string;
}> => {
  const provider = config.storage.provider || "local";

  try {
    if (provider === "local") {
      const storagePath = getLocalStoragePath();
      ensureDirectoryExists(storagePath);
      return { status: "healthy", message: "Local storage ready" };
    }

    if (provider === "s3" && !config.storage.s3?.bucket) {
      return { status: "unhealthy", message: "S3 bucket not configured" };
    }

    if (provider === "cloudinary" && !config.storage.cloudinary?.cloudName) {
      return { status: "unhealthy", message: "Cloudinary not configured" };
    }

    return { status: "healthy", message: `${provider} storage ready` };
  } catch (err: any) {
    return { status: "unhealthy", message: err.message };
  }
};
