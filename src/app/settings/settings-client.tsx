"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  GraduationCap,
  Key,
  Tag,
  Users,
  LogOut,
  User,
  Palette,
  Database,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { AISettingsTab } from "./tabs/ai-settings-tab";
import { ThemesTab } from "./tabs/themes-tab";
import { CourseStagesTab } from "./tabs/course-stages-tab";
import { TagsTab } from "./tabs/tags-tab";
import { UsersTab } from "./tabs/users-tab";
import { DataTab } from "./tabs/data-tab";

type SettingsTab = "ai" | "themes" | "stages" | "tags" | "users" | "data";

export default function SettingsClient() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    user?.role === "admin" ? "ai" : "stages"
  );

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error("请输入旧密码");
      return;
    }
    if (!newPassword) {
      toast.error("请输入新密码");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少6个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setChangePasswordLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "密码修改成功");
        setChangePasswordOpen(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "密码修改失败");
      }
    } catch {
      toast.error("密码修改失败");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "ai":
        return user?.role === "admin" ? <AISettingsTab /> : null;
      case "themes":
        return <ThemesTab />;
      case "stages":
        return <CourseStagesTab />;
      case "tags":
        return <TagsTab />;
      case "users":
        return user?.role === "admin" ? <UsersTab currentUserId={user?.id} /> : null;
      case "data":
        return user?.role === "admin" ? <DataTab userRole={user?.role} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <h1 className="text-xl font-bold">系统设置</h1>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm text-gray-500">
                  <User className="h-4 w-4 inline mr-1" />
                  {user.name}
                  <Badge variant={user.role === "admin" ? "default" : "secondary"} className="ml-2 text-xs">
                    {user.role === "admin" ? "管理员" : "教师"}
                  </Badge>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setChangePasswordOpen(true)}>
                  <Lock className="h-4 w-4 mr-1" />
                  修改密码
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1" />
                  退出
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-4 mb-6">
          {user?.role === "admin" && (
            <Button
              variant={activeTab === "ai" ? "default" : "outline"}
              onClick={() => setActiveTab("ai")}
            >
              <Key className="h-4 w-4 mr-2" />
              AI设置
            </Button>
          )}
          <Button
            variant={activeTab === "themes" ? "default" : "outline"}
            onClick={() => setActiveTab("themes")}
          >
            <Palette className="h-4 w-4 mr-2" />
            教学主题
          </Button>
          <Button
            variant={activeTab === "stages" ? "default" : "outline"}
            onClick={() => setActiveTab("stages")}
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            课程阶段预设
          </Button>
          <Button
            variant={activeTab === "tags" ? "default" : "outline"}
            onClick={() => setActiveTab("tags")}
          >
            <Tag className="h-4 w-4 mr-2" />
            教学标签管理
          </Button>
          {user?.role === "admin" && (
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              onClick={() => setActiveTab("users")}
            >
              <Users className="h-4 w-4 mr-2" />
              用户管理
            </Button>
          )}
          {user?.role === "admin" && (
            <Link href="/admin/students">
              <Button variant="outline">
                <GraduationCap className="h-4 w-4 mr-2" />
                学生管理
              </Button>
            </Link>
          )}
          {user?.role === "admin" && (
            <Button
              variant={activeTab === "data" ? "default" : "outline"}
              onClick={() => setActiveTab("data")}
            >
              <Database className="h-4 w-4 mr-2" />
              数据管理
            </Button>
          )}
        </div>

        {renderTab()}
      </div>

      <Dialog
        open={changePasswordOpen}
        onOpenChange={(open) => {
          setChangePasswordOpen(open);
          if (!open) {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>请输入旧密码和新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>旧密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入旧密码"
              />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6个字符"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword} disabled={changePasswordLoading}>
              {changePasswordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              确认修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
