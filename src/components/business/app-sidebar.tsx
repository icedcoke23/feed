"use client";

import { Button } from "@/components/ui/button";
import {
  Users,
  BarChart3,
  Settings,
  User,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import type { User as UserType } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  user: UserType | null;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
  activeRoute?: string;
}

const NAV_ITEMS = [
  { href: "/", icon: Users, label: "学员管理" },
  { href: "/dashboard", icon: BarChart3, label: "数据统计" },
  { href: "/settings", icon: Settings, label: "系统设置" },
];

export function AppSidebar({ user, isOpen, onToggle, onLogout, activeRoute = "/" }: AppSidebarProps) {
  return (
    <>
      {/* 移动端菜单按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-3 left-4 z-50"
        onClick={onToggle}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* 侧边栏 */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0 pt-16 lg:pt-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 space-y-4">
          {/* 侧边栏用户信息 */}
          <div className="lg:hidden pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{user?.username || '用户'}</p>
                <p className="text-xs text-slate-500">{user?.role === 'admin' ? '管理员' : '教师'}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} onClick={() => isOpen && onToggle()}>
                <Button variant={activeRoute === href ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
