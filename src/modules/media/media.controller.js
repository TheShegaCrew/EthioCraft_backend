const asyncHandler = require('../../utils/asyncHandler');
const mediaService = require('./media.service');

const uploadMultiple = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

  // ownerType and ownerId can be provided in body for linking
  const { ownerType, ownerId } = req.body;
  const created = await mediaService.saveUploadedFiles({ files, ownerType, ownerId, userId: req.user.id });

  res.status(201).json({ message: 'Uploaded', data: created });
});

module.exports = { uploadMultiple };
