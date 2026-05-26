const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("./env");
const { isConfigured: cloudinaryConfigured } = require("./cloudinary");

if (!cloudinaryConfigured) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, env.uploadDir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension).replace(/\s+/g, "-").toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${basename}${extension}`);
  },
});

const storage = cloudinaryConfigured ? multer.memoryStorage() : diskStorage;

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/x-png",
  "video/mp4",
  "model/gltf-binary",
  "model/gltf+json",
  "application/octet-stream"
];

module.exports = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 12,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      // Also allow common extensions just in case the mimetype from the browser is generic
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.glb', '.gltf', '.obj', '.fbx', '.stl', '.ply', '.usdz'];
      if (!allowedExts.includes(ext)) {
        callback(new Error("File type not supported. Use JPG, PNG, WEBP, MP4, or 3D model formats."));
        return;
      }
    }

    callback(null, true);
  },
});
