const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOAD_DIR, ensureUploadDir } = require('../services/attendanceRequestService');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadAbsenceAttachment = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || '';
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(name)) {
      const err = new Error('Only PDF or image files are allowed');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = { uploadAbsenceAttachment };
