const fs = require("fs/promises");
const path = require("path");
const { cloudinary, isConfigured } = require("../config/cloudinary");
const env = require("../config/env");

const UPLOAD_FOLDER = "ethiocraft/products";

function uploadBufferToCloudinary(buffer, originalname) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: UPLOAD_FOLDER,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary upload did not return a URL."));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.on("error", (error) => {
      reject(new Error(`Cloudinary upload failed: ${error.message}`));
    });
    stream.end(buffer);
  });
}

async function uploadDiskFileToCloudinary(filePath, originalname) {
  const buffer = await fs.readFile(filePath);
  return uploadBufferToCloudinary(buffer, originalname);
}

/**
 * Turn multer files into persisted media URLs (Cloudinary or local /uploads).
 */
async function resolveUploadedFileUrls(files) {
  if (!files?.length) {
    return [];
  }

  if (isConfigured) {
    return Promise.all(
      files.map(async (file) => {
        if (file.buffer) {
          return uploadBufferToCloudinary(file.buffer, file.originalname);
        }
        if (file.path) {
          const url = await uploadDiskFileToCloudinary(file.path, file.originalname);
          await fs.unlink(file.path).catch(() => {});
          return url;
        }
        throw new Error("Uploaded file is missing buffer and path.");
      }),
    );
  }

  return files.map((file) => `/uploads/products/${file.filename}`);
}

function resolveMediaUrl(url) {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const base = env.appUrl.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

module.exports = {
  resolveUploadedFileUrls,
  resolveMediaUrl,
  isCloudinaryConfigured: isConfigured,
};
