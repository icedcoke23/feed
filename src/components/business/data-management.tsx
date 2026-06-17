"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import type { ConfirmDialogState } from "@/components/business/confirm-dialog";
import { INITIAL_CONFIRM_STATE, createConfirmState } from "@/components/business/confirm-dialog";

interface DataManagerProps {
  onDataChanged: () => void;
  userRole?: string;
}

export function DataManager({ onDataChanged, userRole }: DataManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"overwrite" | "incremental">("incremental");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_CONFIRM_STATE);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/data/export");
      if (!response.ok) {
        toast.error("导出失败，请重试");
        return;
      }
      const data = await response.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teaching-feedback-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("数据导出成功");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!importFile) {
      toast.error("请选择要导入的文件");
      return;
    }

    const confirmMessage = importMode === "overwrite"
      ? "⚠️ 覆盖模式：将清空现有数据后导入新数据，此操作不可恢复！"
      : "增量模式：将合并导入数据，相同ID的数据将被覆盖。";

    setConfirmDialog(createConfirmState({
      title: "确认导入数据",
      description: confirmMessage,
      confirmText: "确认导入",
      variant: importMode === "overwrite" ? "destructive" : "default",
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsImporting(true);
        try {
          const fileContent = await importFile.text();
          const data = JSON.parse(fileContent);

          const response = await fetch("/api/data/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, mode: importMode }),
          });

          if (!response.ok) {
            toast.error("导入失败，请重试");
            return;
          }

          const result = await response.json();

          if (response.ok) {
            toast.success(`导入成功：${result.message}`);
            onDataChanged();
          } else {
            toast.error(result.error || "导入失败");
          }
        } catch (error) {
          console.error("Import error:", error);
          toast.error("导入失败，请检查文件格式");
        } finally {
          setIsImporting(false);
          setImportFile(null);
        }
      },
    }));
  };

  const handleClearData = async () => {
    setConfirmDialog(createConfirmState({
      title: "确认清空数据",
      description: "⚠️ 警告：此操作将清空所有学员、班级、反馈记录、转班记录等数据，且不可恢复！",
      confirmText: "继续",
      variant: "destructive",
      onConfirm: () => {
        // 第一次确认后，弹出第二次确认
        setConfirmDialog(createConfirmState({
          title: "再次确认",
          description: "真的要清空所有数据吗？用户账号数据和AI设置将保留。此操作不可撤销！",
          confirmText: "确认清空",
          variant: "destructive",
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, open: false }));
            setIsClearing(true);
            try {
              const response = await fetch("/api/data/clear", {
                method: "POST",
              });

              if (!response.ok) {
                toast.error("清空失败，请重试");
                return;
              }

              const result = await response.json();

              if (response.ok) {
                toast.success(`清空成功：${result.message}`);
                onDataChanged();
              } else {
                toast.error(result.error || "清空失败");
              }
            } catch (error) {
              console.error("Clear error:", error);
              toast.error("清空失败，请重试");
            } finally {
              setIsClearing(false);
            }
          },
        }));
      },
    }));
  };

  const handleResetDatabase = async () => {
    setConfirmDialog(createConfirmState({
      title: "极度危险操作",
      description: "此操作将：1. 清空所有业务数据（学员、班级、反馈、转班记录）2. 清空所有配置数据（主题、标签、课程阶段）3. 删除所有教师账号 4. 创建新的管理员账户。此操作不可恢复！",
      confirmText: "继续",
      variant: "destructive",
      onConfirm: () => {
        setConfirmDialog(createConfirmState({
          title: "最后确认",
          description: "真的要重置整个数据库吗？所有数据将永久丢失！请确保您已经导出了需要保留的数据。",
          confirmText: "确认重置",
          variant: "destructive",
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, open: false }));
            setIsResetting(true);
            try {
              const response = await fetch("/api/data/reset-admin", {
                method: "POST",
              });

              if (!response.ok) {
                toast.error("重置失败，请重试");
                return;
              }

              const result = await response.json();

              if (response.ok) {
                toast.success("数据库已重置，管理员密码已重置为环境变量配置的默认密码，请查看服务器日志获取详情");
                onDataChanged();
              } else {
                toast.error(result.error || "重置失败");
              }
            } catch (error) {
              console.error("Reset error:", error);
              toast.error("重置失败，请重试");
            } finally {
              setIsResetting(false);
            }
          },
        }));
      },
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据管理
          </CardTitle>
          <CardDescription>
            导出、导入或清空系统数据（学员、班级、反馈记录等）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 导出数据 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-500" />
                  导出数据
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  将所有学员、班级、反馈记录、转班记录、主题、标签、课程阶段等数据导出为JSON文件
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  注意：不包含用户账号数据和AI设置
                </p>
              </div>
              <Button
                onClick={handleExportData}
                disabled={isExporting}
                className="ml-4"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    导出数据
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 导入数据 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4 text-green-500" />
                  导入数据
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  从JSON文件导入学员、班级、反馈记录等数据
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  支持"增量模式"（合并数据）和"覆盖模式"（清空后导入）
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 ml-4">
                <div className="flex items-center gap-2">
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as "overwrite" | "incremental")}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="导入模式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="incremental">增量模式</SelectItem>
                      <SelectItem value="overwrite">覆盖模式</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-48"
                  />
                  <Button
                    onClick={handleImportData}
                    disabled={isImporting || !importFile}
                    variant={importMode === "overwrite" ? "destructive" : "outline"}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        导入数据
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  {importMode === "incremental"
                    ? "增量模式：相同ID的数据将被覆盖，新数据将被添加"
                    : "覆盖模式：将先清空所有数据再导入"}
                </p>
              </div>
            </div>
          </div>

          {/* 清空数据 */}
          <div className="border rounded-lg p-4 border-red-200 bg-red-50/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  清空数据
                </h3>
                <p className="text-sm text-red-600 mt-1">
                  清空所有学员、班级、反馈记录、转班记录、主题、标签和课程阶段数据
                </p>
                <p className="text-xs text-red-500 mt-2">
                  ⚠️ 警告：此操作不可恢复！用户账号数据和AI设置将保留
                </p>
              </div>
              <Button
                onClick={handleClearData}
                disabled={isClearing}
                variant="destructive"
                className="ml-4"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    清空中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    清空数据
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 重置数据库 */}
          <div className="border rounded-lg p-4 border-red-300 bg-red-100/50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  重置数据库
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  清空所有数据并重置管理员账户
                </p>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️⚠️⚠️ 极度危险：此操作将删除所有数据（包括教师账号），只保留新的管理员账户！
                </p>
              </div>
              <Button
                onClick={handleResetDatabase}
                disabled={isResetting}
                variant="destructive"
                className="ml-4 bg-red-700 hover:bg-red-800"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    重置中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重置数据库
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}
