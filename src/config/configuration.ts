import { registerAs } from '@nestjs/config';

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly apiPrefix: string;
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly logLevel: string;
  readonly corsOrigins: readonly string[];
  readonly mfaEnabled: boolean;
  readonly passwordMinLength: number;
  readonly passwordMaxLength: number;
  readonly passwordHistorySize: number;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly maxActiveSessions: number;
  readonly sessionIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly sessionAbsoluteTimeoutSeconds: number;
  readonly privilegedAbsoluteTimeoutSeconds: number;
  readonly verificationTokenTtlSeconds: number;
  readonly passwordResetTokenTtlSeconds: number;
  readonly mfaRequiredRoles: readonly string[];
  readonly mfaFactors: readonly string[];
  readonly accessTokenSecret: string;
  readonly accessTokenIssuer: string;
  readonly accessTokenAudience: string;
  readonly accessTokenKeyId: string;
  readonly loginFailureLimit: number;
  readonly loginFailureWindowSeconds: number;
  readonly mfaEncryptionKey: string;
  readonly mfaChallengeTtlSeconds: number;
  readonly passwordBlocklistRedisKey: string;
  readonly resendApiKey: string;
  readonly emailFrom: string;
  readonly frontendUrl: string;
  readonly swaggerEnabled: boolean;
}

export const configuration = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    port: parsePort(process.env.PORT),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
    mfaEnabled: parseBoolean(process.env.MFA_ENABLED, true),
    passwordMinLength: parsePositiveInteger(process.env.PASSWORD_MIN_LENGTH, 15),
    passwordMaxLength: parsePositiveInteger(process.env.PASSWORD_MAX_LENGTH, 128),
    passwordHistorySize: parsePositiveInteger(process.env.PASSWORD_HISTORY_SIZE, 5),
    accessTokenTtlSeconds: parsePositiveInteger(process.env.ACCESS_TOKEN_TTL_SECONDS, 600),
    refreshTokenTtlSeconds: parsePositiveInteger(process.env.REFRESH_TOKEN_TTL_SECONDS, 2592000),
    maxActiveSessions: parsePositiveInteger(process.env.MAX_ACTIVE_SESSIONS, 5),
    sessionIdleTimeoutSeconds: parsePositiveInteger(process.env.SESSION_IDLE_TIMEOUT_SECONDS, 1800),
    privilegedIdleTimeoutSeconds: parsePositiveInteger(process.env.PRIVILEGED_IDLE_TIMEOUT_SECONDS, 900),
    sessionAbsoluteTimeoutSeconds: parsePositiveInteger(process.env.SESSION_ABSOLUTE_TIMEOUT_SECONDS, 43200),
    privilegedAbsoluteTimeoutSeconds: parsePositiveInteger(process.env.PRIVILEGED_ABSOLUTE_TIMEOUT_SECONDS, 28800),
    verificationTokenTtlSeconds: parsePositiveInteger(process.env.VERIFICATION_TOKEN_TTL_SECONDS, 900),
    passwordResetTokenTtlSeconds: parsePositiveInteger(process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS, 900),
    mfaRequiredRoles: parseList(process.env.MFA_REQUIRED_ROLES),
    mfaFactors: parseList(process.env.MFA_FACTORS),
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? '',
    accessTokenIssuer: process.env.ACCESS_TOKEN_ISSUER ?? 'credible-api',
    accessTokenAudience: process.env.ACCESS_TOKEN_AUDIENCE ?? 'credible-client',
    accessTokenKeyId: process.env.ACCESS_TOKEN_KEY_ID ?? 'access-key-v1',
    loginFailureLimit: parsePositiveInteger(process.env.LOGIN_FAILURE_LIMIT, 5),
    loginFailureWindowSeconds: parsePositiveInteger(process.env.LOGIN_FAILURE_WINDOW_SECONDS, 900),
    mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY ?? '',
    mfaChallengeTtlSeconds: parsePositiveInteger(process.env.MFA_CHALLENGE_TTL_SECONDS, 300),
    passwordBlocklistRedisKey: process.env.PASSWORD_BLOCKLIST_REDIS_KEY ?? 'credible:security:password-blocklist',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    emailFrom: process.env.EMAIL_FROM ?? '',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    swaggerEnabled: parseBoolean(process.env.SWAGGER_ENABLED, process.env.NODE_ENV !== 'production'),
  }),
);

export function validateEnvironment(env: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const port = parsePort(env.PORT);

  if (nodeEnv !== 'test' && typeof env.DATABASE_URL !== 'string') {
    throw new Error('DATABASE_URL is required outside test mode');
  }
  if (nodeEnv !== 'test' && typeof env.REDIS_URL !== 'string') {
    throw new Error('REDIS_URL is required outside test mode');
  }
  if (nodeEnv !== 'test' && (!isString(env.ACCESS_TOKEN_SECRET) || env.ACCESS_TOKEN_SECRET.length < 32)) {
    throw new Error('ACCESS_TOKEN_SECRET must contain at least 32 characters outside test mode');
  }
  if (nodeEnv !== 'test' && (!isString(env.MFA_ENCRYPTION_KEY) || env.MFA_ENCRYPTION_KEY.length !== 32)) {
    throw new Error('MFA_ENCRYPTION_KEY must contain exactly 32 characters outside test mode');
  }
  if (nodeEnv === 'production' && (!isString(env.RESEND_API_KEY) || env.RESEND_API_KEY.length === 0)) {
    throw new Error('RESEND_API_KEY is required in production');
  }
  if (nodeEnv === 'production' && (!isString(env.EMAIL_FROM) || env.EMAIL_FROM.length === 0)) {
    throw new Error('EMAIL_FROM is required in production');
  }

  return { ...env, NODE_ENV: nodeEnv, PORT: port };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function parseNodeEnv(value: unknown): AppConfig['nodeEnv'] {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

function parsePort(value: unknown): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseOrigins(value: unknown): readonly string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('Boolean configuration values must be true or false');
}

function parsePositiveInteger(value: unknown, defaultValue: number): number {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Security numeric configuration values must be positive integers');
  }
  return parsed;
}

function parseList(value: unknown): readonly string[] {
  if (typeof value !== 'string' || value.trim() === '') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}
