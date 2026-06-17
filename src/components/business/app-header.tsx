"use client";

import { Button } from "@/components/ui/button";
import {
  Users,
  BarChart3,
  Settings,
  GraduationCap,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import type { User } from "@/contexts/auth-context";

interface AppHeaderProps {
  user: User | null;
  onLogout: () => void;
  activeRoute?: string;
}

const NAV_ITEMS = [
  { href: "/", icon: Users, label: "学员管理" },
  { href: "/dashboard", icon: BarChart3, label: "数据统计" },
  { href: "/settings", icon: Settings, label: "系统设置" },
];

export function AppHeader({ user, onLogout, activeRoute = "/" }: AppHeaderProps) {
  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl hidden sm:inline">教学反馈系统</span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}>
                <Button variant={activeRoute === href ? "secondary" : "ghost"} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
            <div className="flex items-center gap-3 border-l pl-3 ml-2 border-slate-200">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-medium text-slate-900">{user?.username || '用户'}</p>
                <p className="text-xs text-slate-500">{user?.role === 'admin' ? '管理员' : '教师'}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
