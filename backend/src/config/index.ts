import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  db: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
        ssl: (process.env.DB_SSL === 'false' || process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))
          ? undefined
          : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'metro2_user',
        password: process.env.DB_PASSWORD || 'metro2_secure_password',
        database: process.env.DB_NAME || 'metro2_gis_db',
        max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      },

  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_metro2_jwt_key_2026_maur_kfw_secure',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_metro2_refresh_jwt_key_2026',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  storage: {
    type: (process.env.STORAGE_TYPE || 'local') as 'local' | 'r2' | 's3',
    localUploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'auto',
      bucket: process.env.S3_BUCKET || 'metro2-survey-photos',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      publicUrl: process.env.R2_PUBLIC_URL || process.env.S3_PUBLIC_URL || '',
    },
  },

  ai: {
    workerUrl: process.env.AI_WORKER_URL || 'http://localhost:5000/api/ai/rectify',
    apiKey: process.env.AI_API_KEY || 'mock_ai_key_2026',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};
