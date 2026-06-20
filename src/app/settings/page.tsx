"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AISettingsPanel } from "@/components/business/ai-settings-panel";
import { ThemeManagement } from "@/components/business/theme-management";
import { CourseStageManagement } from "@/components/business/course-stage-management";
import { TagManagement } from "@/components/business/tag-management";
import { UserManagement } from "@/components/business/user-management";
import { DataManager } from "@/components/business/data-management";
import { ConfirmDialog } from "@/components/business/confirm-dialog";

import {
  useCourseStages,
  useTags,
  useThemes,
  useAISettings,
  useUsers,
} from "@/hooks/use-settings-data";

type SettingsTab = "ai" | "themes" | "stages" | "tags" | "users" | "data";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    user?.role === "admin" ? "ai" : "stages"
  );

  const courseStagesHook = useCourseStages();
  const tagsHook = useTags();
  const themesHook = useThemes();
  const aiSettingsHook = useAISettings();
  const usersHook = useUsers();

  // 缓存标记：记录哪些 Tab 的数据已加载过
  const loadedTabs = useRef<Set<SettingsTab>>(new Set());

  // 按需加载当前 Tab 的数据，已加载过的 Tab 不重复请求
  const loadTabData = useCallback((tab: SettingsTab) => {
    if (loadedTabs.current.has(tab)) return;
    loadedTabs.current.add(tab);

    switch (tab) {
      case "ai":
        aiSettingsHook.fetchAISettings();
        break;
      case "themes":
        themesHook.fetchThemes();
        break;
      case "stages":
        courseStagesHook.fetchCourseStages();
        break;
      case "tags":
        tagsHook.fetchTags();
        break;
      case "users":
        usersHook.fetchUsers();
        break;
      case "data":
        // 数据管理 Tab 不需要预加载数据
        break;
    }
  }, [aiSettingsHook.fetchAISettings, themesHook.fetchThemes, courseStagesHook.fetchCourseStages, tagsHook.fetchTags, usersHook.fetchUsers]);

  // 首次加载默认 Tab 数据
  useEffect(() => {
    loadTabData(activeTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换 Tab 时按需加载
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // 修改密码相关状态
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const handleDataChanged = () => {
    // 清除缓存并重新加载当前 Tab 数据
    loadedTabs.current.delete(activeTab);
    loadTabData(activeTab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
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
        {/* 标签切换 */}
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

        {activeTab === "ai" && user?.role === "admin" && (
          <AISettingsPanel
            aiSettings={aiSettingsHook.aiSettings}
            onSettingsChange={aiSettingsHook.setAiSettings}
            loading={aiSettingsHook.aiSettingsLoading}
            saving={aiSettingsHook.saving}
            testingConnection={aiSettingsHook.testingConnection}
            onSave={aiSettingsHook.saveAISettings}
            onTestConnection={aiSettingsHook.testConnection}
            onResetPrompt={aiSettingsHook.resetPrompt}
          />
        )}

        {activeTab === "themes" && (
          <ThemeManagement
            themes={themesHook.themes}
            loading={themesHook.themesLoading}
            saving={themesHook.saving}
            onSave={themesHook.saveTheme}
            onDelete={themesHook.deleteTheme}
          />
        )}

        {activeTab === "stages" && (
          <CourseStageManagement
            courseStages={courseStagesHook.courseStages}
            loading={courseStagesHook.loading}
            saving={courseStagesHook.saving}
            onSave={courseStagesHook.saveCourseStage}
            onDelete={courseStagesHook.deleteCourseStage}
            onAddDefaultPresets={courseStagesHook.addDefaultPresets}
            onResetToPresets={courseStagesHook.resetToPresets}
          />
        )}

        {activeTab === "tags" && (
          <TagManagement
            tags={tagsHook.tags}
            loading={tagsHook.tagsLoading}
            saving={tagsHook.saving}
            onSave={tagsHook.saveTag}
            onDelete={tagsHook.deleteTag}
          />
        )}

        {activeTab === "users" && user?.role === "admin" && (
          <UserManagement
            users={usersHook.users}
            loading={usersHook.usersLoading}
            saving={usersHook.saving}
            currentUserId={user?.id}
            onSave={usersHook.saveUser}
            onDelete={usersHook.deleteUser}
          />
        )}

        {activeTab === "data" && user?.role === "admin" && (
          <DataManager
            onDataChanged={handleDataChanged}
            userRole={user?.role}
          />
        )}
      </div>

      {/* 确认对话框 */}
      {courseStagesHook.confirmDialog.open && (
        <ConfirmDialog
          open={courseStagesHook.confirmDialog.open}
          onOpenChange={(open) => courseStagesHook.setConfirmDialog(prev => ({ ...prev, open }))}
          title={courseStagesHook.confirmDialog.title}
          description={courseStagesHook.confirmDialog.description}
          confirmText={courseStagesHook.confirmDialog.confirmText}
          variant={courseStagesHook.confirmDialog.variant}
          onConfirm={courseStagesHook.confirmDialog.onConfirm}
        />
      )}
      {tagsHook.confirmDialog.open && (
        <ConfirmDialog
          open={tagsHook.confirmDialog.open}
          onOpenChange={(open) => tagsHook.setConfirmDialog(prev => ({ ...prev, open }))}
          title={tagsHook.confirmDialog.title}
          description={tagsHook.confirmDialog.description}
          confirmText={tagsHook.confirmDialog.confirmText}
          variant={tagsHook.confirmDialog.variant}
          onConfirm={tagsHook.confirmDialog.onConfirm}
        />
      )}
      {themesHook.confirmDialog.open && (
        <ConfirmDialog
          open={themesHook.confirmDialog.open}
          onOpenChange={(open) => themesHook.setConfirmDialog(prev => ({ ...prev, open }))}
          title={themesHook.confirmDialog.title}
          description={themesHook.confirmDialog.description}
          confirmText={themesHook.confirmDialog.confirmText}
          variant={themesHook.confirmDialog.variant}
          onConfirm={themesHook.confirmDialog.onConfirm}
        />
      )}
      {aiSettingsHook.confirmDialog.open && (
        <ConfirmDialog
          open={aiSettingsHook.confirmDialog.open}
          onOpenChange={(open) => aiSettingsHook.setConfirmDialog(prev => ({ ...prev, open }))}
          title={aiSettingsHook.confirmDialog.title}
          description={aiSettingsHook.confirmDialog.description}
          confirmText={aiSettingsHook.confirmDialog.confirmText}
          variant={aiSettingsHook.confirmDialog.variant}
          onConfirm={aiSettingsHook.confirmDialog.onConfirm}
        />
      )}
      {usersHook.confirmDialog.open && (
        <ConfirmDialog
          open={usersHook.confirmDialog.open}
          onOpenChange={(open) => usersHook.setConfirmDialog(prev => ({ ...prev, open }))}
          title={usersHook.confirmDialog.title}
          description={usersHook.confirmDialog.description}
          confirmText={usersHook.confirmDialog.confirmText}
          variant={usersHook.confirmDialog.variant}
          onConfirm={usersHook.confirmDialog.onConfirm}
        />
      )}

      {/* 修改密码对话框 */}
      <Dialog open={changePasswordOpen} onOpenChange={(open) => {
        setChangePasswordOpen(open);
        if (!open) {
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      }}>
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
