const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("./env");

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, env.uploadDir);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension).replace(/\s+/g, "-").toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${basename}${extension}`);
  },
});

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

module.exports = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error("Only JPEG, PNG, and WEBP images are supported."));
      return;
    }

    callback(null, true);
  },
});
