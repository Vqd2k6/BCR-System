const { generateUploadPresignedUrl } = require('../config/r2');

/**
 * POST /api/media/presigned-url
 * Cấp Presigned URL để Mobile tải ảnh gốc 4-5MB trực tiếp lên Cloudflare R2
 */
async function getPresignedUrl(req, res, next) {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tên file ảnh (fileName).',
      });
    }

    const { uploadUrl, publicUrl, key } = await generateUploadPresignedUrl(
      fileName,
      contentType || 'image/jpeg'
    );

    return res.json({
      success: true,
      message: 'Đã tạo Presigned Upload URL thành công',
      data: {
        uploadUrl,
        publicUrl,
        key,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPresignedUrl,
};
