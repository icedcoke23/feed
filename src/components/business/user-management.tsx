"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Save,
  Loader2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import type { UserItem } from "@/types/settings";

interface UserManagementProps {
  users: UserItem[];
  loading: boolean;
  saving: boolean;
  currentUserId?: string;
  onSave: (editingUser: Partial<UserItem>, isAdding: boolean) => Promise<boolean>;
  onDelete: (id: string) => void;
}

export function UserManagement({
  users,
  loading,
  saving,
  currentUserId,
  onSave,
  onDelete,
}: UserManagementProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserItem>>({});
  const [isAdding, setIsAdding] = useState(false);

  // 重置密码相关状态
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const openEditDialog = (userItem?: UserItem) => {
    if (userItem) {
      setEditingUser(userItem);
      setIsAdding(false);
    } else {
      setEditingUser({
        role: "teacher",
        teacherRole: "teacher",
        is_active: true,
      });
      setIsAdding(true);
    }
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    const success = await onSave(editingUser, isAdding);
    if (success) {
      setIsEditDialogOpen(false);
    }
  };

  const openResetPasswordDialog = (userItem: UserItem) => {
    setResetPasswordUser(userItem);
    setResetPasswordValue("");
    setIsResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (!resetPasswordValue) {
      toast.error("请输入新密码");
      return;
    }
    if (resetPasswordValue.length < 6) {
      toast.error("新密码至少6个字符");
      return;
    }

    setResetPasswordLoading(true);
    try {
      const response = await fetch(`/api/users/${resetPasswordUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "密码重置成功");
        setIsResetPasswordOpen(false);
        setResetPasswordValue("");
      } else {
        toast.error(data.error || "密码重置失败");
      }
    } catch {
      toast.error("密码重置失败");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button onClick={() => openEditDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          添加用户
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无用户</p>
            <p className="text-sm text-gray-400 mt-2">点击“添加用户”创建新用户</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              用户列表
              <Badge variant="secondary">{users.length}个</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((userItem) => (
                <div
                  key={userItem.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{userItem.name}</span>
                      <Badge variant={userItem.role === "admin" ? "default" : "secondary"}>
                        {userItem.role === "admin" ? "管理员" : userItem.teacherRole === "admin" ? "教务老师" : "授课老师"}
                      </Badge>
                      {userItem.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">当前用户</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>用户名：{userItem.username}</span>
                      {userItem.phone && (
                        <span className="ml-4">电话：{userItem.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(userItem)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openResetPasswordDialog(userItem)}
                      title="重置密码"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onDelete(userItem.id)}
                      disabled={userItem.id === currentUserId}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAdding ? "添加用户" : "编辑用户"}</DialogTitle>
            <DialogDescription>
              {isAdding ? "创建新用户账号" : "修改用户信息"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>用户名 *</Label>
              <Input
                value={editingUser.username || ""}
                onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                placeholder="如：zhangsan"
                disabled={!isAdding}
              />
              {!isAdding && (
                <p className="text-xs text-gray-500">用户名不可修改</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input
                value={editingUser.name || ""}
                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                placeholder="如：张三"
              />
            </div>

            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={editingUser.role || "teacher"}
                onValueChange={(v) => setEditingUser({ ...editingUser, role: v as "admin" | "teacher", teacherRole: v === "teacher" ? (editingUser.teacherRole || "teacher") : undefined })}
              >
                <SelectContent>
                  <SelectItem value="teacher">教师</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
              {editingUser.role === "teacher" && (
                <Select
                  value={editingUser.teacherRole || "teacher"}
                  onValueChange={(v) => setEditingUser({ ...editingUser, teacherRole: v as "admin" | "teacher" })}
                >
                  <SelectContent>
                    <SelectItem value="teacher">授课老师</SelectItem>
                    <SelectItem value="admin">教务老师</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>电话</Label>
              <Input
                value={editingUser.phone || ""}
                onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                placeholder="如：13800138000"
              />
            </div>

            <div className="space-y-2">
              <Label>{isAdding ? "初始密码 *" : "新密码（留空则不修改）"}</Label>
              <Input
                type="password"
                value={editingUser.password || ""}
                onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                placeholder={isAdding ? "请设置初始密码" : "不修改请留空"}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={isResetPasswordOpen} onOpenChange={(open) => {
        setIsResetPasswordOpen(open);
        if (!open) setResetPasswordValue("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户「{resetPasswordUser?.name}」设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="至少6个字符"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={resetPasswordLoading}>
              {resetPasswordLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              确认重置
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
