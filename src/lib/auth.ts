import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// JWT 配置
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    console.warn('WARNING: JWT_SECRET not set, using dev default. Do NOT use in production!');
    return 'dev-only-jwt-secret-change-in-production';
  }
  return secret;
}
const TOKEN_EXPIRES_IN = "24h";
export const COOKIE_NAME = "auth_token";

// 将密钥字符串转为 Uint8Array
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

// JWT Payload 类型
export interface JwtPayload {
  userId: string;
  role: "admin" | "teacher";
}

// 签发 JWT Token
export async function signToken(payload: JwtPayload): Promise<string> {
  const token = await new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRES_IN)
    .sign(getSecretKey());
  return token;
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      userId: payload.userId as string,
      role: payload.role as "admin" | "teacher",
    };
  } catch {
    return null;
  }
}

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 密码比对
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 判断密码是否为 bcrypt 哈希（以 $2a$ 或 $2b$ 开头）
export function isBcryptHash(str: string): boolean {
  return /^\$2[ab]\$/.test(str);
}
