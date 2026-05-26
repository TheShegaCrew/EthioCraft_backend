const { resolveUploadedFileUrls } = require('../../utils/media-upload');
const mediaRepository = require('./media.repository');

async function saveUploadedFiles({ files, ownerType, ownerId, userId }) {
  const urls = await resolveUploadedFileUrls(files);

  const created = [];
  for (let i = 0; i < urls.length; i++) {
    const file = files[i];
    const url = urls[i];
    const media = await mediaRepository.createMedia({
      ownerType: ownerType || 'PRODUCT_DRAFT',
      userId: userId || null,
      url,
      mimeType: file.mimetype,
      size: file.size,
    });
    created.push(media);
  }
  return created;
}

module.exports = { saveUploadedFiles };
