import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, COOKIE_NAME } from "@/lib/auth";
import { decodeJwt } from "jose";

// 不需要认证的路径
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/logout', '/api/health'];

// 仅管理员可访问的 API 路径前缀
const ADMIN_ONLY_API_PREFIXES = [
  '/api/data/clear',
  '/api/data/reset-admin',
  '/api/data/full-import',
  '/api/data/import',
  '/api/data/export',
  '/api/batch-import',
  '/api/users',
  '/api/init-data',
  '/api/ai-settings',
  '/api/course-stages/reset',
  '/api/course-stages/fix-active',
];

// 仅管理员可访问的页面路径
const ADMIN_ONLY_PAGES = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过公开路径
  if (PUBLIC_PATHS.some(path => pathname === path)) {
    return NextResponse.next();
  }

  // 从 Cookie 读取 Token
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // 检测 RSC 客户端导航请求（带 RSC header）
  // 对于 RSC 请求，让客户端 RouteGuard 处理重定向，避免 ERR_ABORTED
  const isRscNavigation = request.headers.get('RSC') === '1';

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    // RSC 客户端导航放行，由 RouteGuard 统一处理重定向
    if (isRscNavigation) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 验证 Token（verifyToken 内部使用 auth.ts 的 getJwtSecret，生产环境无 secret 会抛错）
  const payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: "登录已过期，请重新登录" }, { status: 401 });
    }
    // RSC 客户端导航放行，由 RouteGuard 统一处理重定向
    if (isRscNavigation) {
      return NextResponse.next();
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const userId = payload.userId;
  const role = payload.role;

  // 检查管理员权限
  const isAdminOnlyApi = ADMIN_ONLY_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
  const isAdminOnlyPage = ADMIN_ONLY_PAGES.some(page => pathname === page || pathname.startsWith(page + '/'));

  if ((isAdminOnlyApi || isAdminOnlyPage) && role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }
    // RSC 客户端导航放行，由 RouteGuard 统一处理重定向
    if (isRscNavigation) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  const response = NextResponse.next();

  // Token 续签：检查剩余有效期，不足 50% 则签发新 Token
  // 注意：此处用 decodeJwt 仅读取 exp/iat（无需再次验签，前面 verifyToken 已验证签名）
  try {
    const decoded = decodeJwt(token);
    const exp = decoded.exp;
    const iat = decoded.iat;
    if (exp && iat) {
      const now = Math.floor(Date.now() / 1000);
      const totalLifetime = exp - iat;
      const remaining = exp - now;
      // 剩余有效期不足 50%，签发新 Token
      if (remaining < totalLifetime * 0.5) {
        const newToken = await signToken({ userId, role });
        // 设置 X-New-Token 响应头，前端可据此更新
        response.headers.set("X-New-Token", newToken);
        // 同时更新 Cookie
        response.cookies.set(COOKIE_NAME, newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24,
          path: "/",
        });
      }
    }
  } catch {
    // Token 续签失败不影响正常请求
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/feedback/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/student/:path*',
    '/dashboard/:path*',
    '/',
  ],
};
