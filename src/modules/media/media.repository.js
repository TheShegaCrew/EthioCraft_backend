const prisma = require('../../config/prisma');

function resolveMediaKind(mimeType) {
  if (!mimeType) return 'DOCUMENT';
  if (mimeType.startsWith('image')) return 'IMAGE';
  if (mimeType.startsWith('video')) return 'VIDEO';
  // 3D model mime types or generic octet-stream (common for .glb, .gltf, .obj, etc.)
  if (mimeType.startsWith('model') || mimeType === 'application/octet-stream') return 'MODEL_3D';
  return 'DOCUMENT';
}

function createMedia({ ownerType, userId, url, mimeType, size }) {
  return prisma.media.create({
    data: {
      ownerType,
      kind: resolveMediaKind(mimeType),
      userId,
      url,
      mimeType,
      size,
    },
  });
}

module.exports = { createMedia };
