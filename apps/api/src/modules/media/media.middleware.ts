import multer from "multer";
import { AppError } from "../../utils/app-error.js";
import { HTTP_STATUS } from "@addisgebeya/shared";

// Store files in memory buffer so we can validate magic bytes and stream directly to Cloudinary
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const allowedReceiptMimeTypes = [
  ...allowedMimeTypes,
  "application/pdf",
];

export const uploadMedia = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 8, // Max 8 files per request
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError({
          message: "Unsupported file type. Only JPEG, JPG, PNG, and WebP images are allowed.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_FILE_TYPE",
        }),
      );
    }
  },
});

export const uploadReceiptMedia = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per receipt file
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedReceiptMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(
        new AppError({
          message:
            "Unsupported receipt file type. Only JPEG, JPG, PNG, WebP images and PDF documents are accepted.",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "INVALID_FILE_TYPE",
        }),
      );
    }
  },
});

