"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

// 需要登录才能访问的路由
const PROTECTED_ROUTES = ["/", "/feedback", "/student", "/dashboard", "/settings", "/history"];

// 仅管理员可访问的路由
const ADMIN_ROUTES: string[] = ["/admin"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // 防止 useEffect 在同一渲染周期内重复触发 push
  const lastRedirectRef = useRef<string | null>(null);
  // 正在执行导航时锁定，避免重复触发
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (navigatingRef.current) return;

    const isProtected = PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    const isAdminOnly = ADMIN_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    // 计算目标跳转路径
    let target: string | null = null;

    // 未登录且访问受保护路由，跳转到登录页
    if (!user && isProtected) {
      target = "/login";
    }
    // 已登录但访问登录页，跳转到首页
    else if (user && pathname === "/login") {
      target = "/";
    }
    // 教师访问管理员路由，跳转到首页
    else if (user?.role === "teacher" && isAdminOnly) {
      target = "/";
    }

    // 仅当目标路径与上次不同（或首次）时才执行跳转，避免重复 push 导致 ERR_ABORTED
    if (target && target !== pathname) {
      const key = `${pathname}->${target}`;
      if (lastRedirectRef.current === key) {
        return;
      }
      lastRedirectRef.current = key;
      navigatingRef.current = true;
      router.push(target);
      // 短延迟后释放锁，允许后续条件变化时再次跳转
      setTimeout(() => {
        navigatingRef.current = false;
      }, 300);
    } else if (!target) {
      // 清除记录，允许后续条件满足时重新跳转
      lastRedirectRef.current = null;
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 登录页不需要登录即可访问
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 受保护路由需要登录
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 管理员路由需要管理员权限
  const isAdminOnly = ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAdminOnly && user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">访问受限</h1>
          <p className="text-gray-500">您没有权限访问此页面</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
