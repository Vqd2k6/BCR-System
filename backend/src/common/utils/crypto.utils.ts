import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class CryptoUtils {
  /**
   * Mã hóa mật khẩu bằng BCrypt salt rounds = 12
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * So sánh mật khẩu gốc với hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Tính mã băm Checksum SHA-256 của chuỗi hoặc buffer
   */
  static sha256(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Tạo token ngẫu nhiên an toàn
   */
  static generateRandomToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }
}
