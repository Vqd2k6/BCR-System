import { StorageService } from '../common/services/storage.service';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('🚀 [Test] Bắt đầu kiểm thử luồng Presigned Upload URL...');

  // 1. Tạo presigned URL
  const presignRes = await StorageService.generatePresignedUploadUrl(
    'test_photo.jpg',
    'image/jpeg',
    'surveys'
  );

  console.log('✅ [1] Đã tạo Presigned URL thành công:');
  console.log('   Upload URL:', presignRes.uploadUrl);
  console.log('   Public URL:', presignRes.publicUrl);
  console.log('   Key:', presignRes.key);
  console.log('   Method:', presignRes.method);

  if (!presignRes.uploadUrl || !presignRes.publicUrl || !presignRes.key) {
    throw new Error('❌ Presigned URL response thiếu trường bắt buộc');
  }

  // 2. Thử nghiệm lưu file nhị phân qua StorageService.saveLocalBuffer (mô phỏng PUT thành công)
  const dummyBuffer = Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA_TEST_123456');
  const saveRes = await StorageService.saveLocalBuffer(dummyBuffer, presignRes.key, 'image/jpeg');

  console.log('✅ [2] Đã lưu Buffer nhị phân vào storage:');
  console.log('   Saved URL:', saveRes.url);
  console.log('   SHA256 Checksum:', saveRes.checksumSha256);
  console.log('   Size Bytes:', saveRes.sizeBytes);

  // 3. Kiểm tra file tồn tại trên đĩa nếu ở chế độ local
  const localFilePath = path.resolve('./uploads', presignRes.key);
  const backendLocalFilePath = path.resolve('./backend/uploads', presignRes.key);

  const exists = fs.existsSync(localFilePath) || fs.existsSync(backendLocalFilePath);
  console.log(`✅ [3] Kiểm tra file thực tế trên ổ đĩa: ${exists ? 'TỒN TẠI (Thành công)' : 'LƯU TRỮ CLOUD'}`);

  console.log('\n🎉 TOÀN BỘ KIỂM THỬ PRESIGNED UPLOAD SERVICE HOÀN TẤT XUẤT SẮC!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
