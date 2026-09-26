import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

// Khởi tạo PostgreSQL connection pool
export const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('[DATABASE ERROR] Unexpected error on idle client:', err);
});

export class Database {
  /**
   * Thực thi câu lệnh SQL đơn lẻ thông qua connection pool
   */
  static async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (config.env === 'development' && duration > 100) {
        console.warn(`[SLOW QUERY] ${duration}ms: ${text.slice(0, 100)}...`);
      }
      return res;
    } catch (error: unknown) {
      console.error('[DATABASE QUERY ERROR]', { text, params, error });
      throw error;
    }
  }

  /**
   * Thực thi chuỗi thao tác bên trong một Database Transaction an toàn
   * Tự động BEGIN, COMMIT và ROLLBACK khi có ngoại lệ
   */
  static async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TRANSACTION ROLLBACK ERROR]', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Kiểm tra kết nối CSDL và PostGIS extension
   */
  static async healthCheck(): Promise<{ status: string; postgisVersion?: string }> {
    try {
      const res = await this.query('SELECT PostGIS_Version() AS postgis_version, NOW() AS now;');
      return {
        status: 'UP',
        postgisVersion: res.rows[0]?.postgis_version,
      };
    } catch (error: unknown) {
      return {
        status: 'DOWN',
      };
    }
  }
}
