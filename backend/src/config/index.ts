import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resolveUploadDir = (): string => {
  if (process.env.LOCAL_UPLOAD_DIR) {
    return path.resolve(process.env.LOCAL_UPLOAD_DIR);
  }
  const rootBackendUploads = path.resolve(process.cwd(), 'backend', 'uploads');
  if (fs.existsSync(rootBackendUploads)) {
    return rootBackendUploads;
  }
  const cwdUploads = path.resolve(process.cwd(), 'uploads');
  if (fs.existsSync(cwdUploads)) {
    return cwdUploads;
  }
  return path.resolve(__dirname, '../../uploads');
};

function resolveDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    let connectionString = process.env.DATABASE_URL;
    
    // Tự động chuyển đổi Direct Supabase host (IPv6-only: db.<project-ref>.supabase.co)
    // sang Supabase Connection Pooler (IPv4: aws-0-ap-southeast-1.pooler.supabase.com)
    // nhằm tránh lỗi ENETUNREACH trên các hosting không hỗ trợ IPv6 như Render.
    if (connectionString.includes('.supabase.co')) {
      const match = connectionString.match(/@db\.([a-zA-Z0-9_-]+)\.supabase\.co/);
      if (match) {
        const ref = match[1];
        connectionString = connectionString.replace(/@db\.[a-zA-Z0-9_-]+\.supabase\.co/g, '@aws-0-ap-southeast-1.pooler.supabase.com');
        connectionString = connectionString.replace(/\/\/postgres:/, `//postgres.${ref}:`);
        console.warn(`[DATABASE CONFIG] ⚠️ Phát hiện Supabase Direct IPv6 URL. Tự động chuyển đổi sang IPv4 Pooler để tương thích Render.`);
      }
    }

    return {
      connectionString,
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
      ssl: (process.env.DB_SSL === 'false' || connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? undefined
        : { rejectUnauthorized: false },
    };
  }

  let host = process.env.DB_HOST || 'localhost';
  let user = process.env.DB_USER || 'metro2_user';

  if (host.includes('.supabase.co')) {
    const match = host.match(/^db\.([a-zA-Z0-9_-]+)\.supabase\.co$/);
    if (match) {
      const ref = match[1];
      host = 'aws-0-ap-southeast-1.pooler.supabase.com';
      if (user === 'postgres') {
        user = `postgres.${ref}`;
      }
      console.warn(`[DATABASE CONFIG] ⚠️ Phát hiện DB_HOST là Supabase Direct IPv6. Tự động đổi sang IPv4 Pooler: ${host}`);
    }
  }

  return {
    host,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user,
    password: process.env.DB_PASSWORD || 'metro2_secure_password',
    database: process.env.DB_NAME || 'metro2_gis_db',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    ssl: (process.env.DB_SSL === 'true' || host.includes('supabase')) ? { rejectUnauthorized: false } : undefined,
  };
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  db: resolveDatabaseConfig(),

  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_metro2_jwt_key_2026_maur_kfw_secure',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_metro2_refresh_jwt_key_2026',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  storage: {
    type: (process.env.STORAGE_TYPE || 'local') as 'local' | 'r2' | 's3',
    localUploadDir: resolveUploadDir(),
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
