"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Key,
  Save,
  Loader2,
  CheckCircle2,
  Settings,
  RefreshCw,
} from "lucide-react";
import type { AISettings } from "@/types/settings";

interface AISettingsPanelProps {
  aiSettings: AISettings;
  onSettingsChange: (settings: AISettings) => void;
  loading: boolean;
  saving: boolean;
  testingConnection: boolean;
  onSave: () => void;
  onTestConnection: () => void;
  onResetPrompt: () => void;
}

export function AISettingsPanel({
  aiSettings,
  onSettingsChange,
  loading,
  saving,
  testingConnection,
  onSave,
  onTestConnection,
  onResetPrompt,
}: AISettingsPanelProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AI设置
          </CardTitle>
          <CardDescription>
            配置AI模型参数和API连接信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* AI服务类型选择 */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">AI服务类型</Label>
                  <p className="text-sm text-gray-500 mt-1">选择使用扣子AI（默认）或第三方AI服务</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  variant={aiSettings.use_custom_ai === "false" ? "default" : "outline"}
                  onClick={() => onSettingsChange({ ...aiSettings, use_custom_ai: "false" })}
                  className="flex-1"
                >
                  扣子AI（推荐）
                </Button>
                <Button
                  variant={aiSettings.use_custom_ai === "true" ? "default" : "outline"}
                  onClick={() => onSettingsChange({ ...aiSettings, use_custom_ai: "true" })}
                  className="flex-1"
                >
                  第三方AI
                </Button>
              </div>
            </div>

            {/* 第三方AI配置 */}
            {aiSettings.use_custom_ai === "true" && (
              <div className="space-y-4 max-w-xl border-l-4 border-blue-500 pl-4">
                <h3 className="font-medium text-blue-700">第三方AI配置</h3>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-700 font-medium">
                    ⚠️ 沙箱环境提示
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    当前运行在coze沙箱环境中，外部API请求可能受限。第三方AI测试可能失败，建议部署到生产环境后再配置。
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>API密钥 <span className="text-red-500">*</span></Label>
                  <Input
                    type="password"
                    value={aiSettings.api_key}
                    onChange={(e) => onSettingsChange({ ...aiSettings, api_key: e.target.value })}
                    placeholder="请输入AI API密钥"
                  />
                  <p className="text-xs text-gray-500">第三方AI服务的API密钥</p>
                </div>
                <div className="space-y-2">
                  <Label>API接入地址 <span className="text-red-500">*</span></Label>
                  <Input
                    value={aiSettings.base_url}
                    onChange={(e) => onSettingsChange({ ...aiSettings, base_url: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                  />
                  <p className="text-xs text-gray-500">第三方AI服务的API基础URL地址（如：https://api.openai.com/v1）</p>
                </div>
                <div className="space-y-2">
                  <Label>模型ID <span className="text-red-500">*</span></Label>
                  <Input
                    value={aiSettings.model_id}
                    onChange={(e) => onSettingsChange({ ...aiSettings, model_id: e.target.value })}
                    placeholder="如：gpt-3.5-turbo, gpt-4"
                  />
                  <p className="text-xs text-gray-500">使用的AI模型标识符</p>
                </div>
              </div>
            )}

            {/* 扣子AI配置提示 */}
            {aiSettings.use_custom_ai === "false" && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  ✓ 使用扣子AI（豆包大模型），无需额外配置，开箱即用。
                </p>
                <p className="text-xs text-green-600 mt-1">
                  模型：doubao-seed-2-0-lite-260215
                </p>
              </div>
            )}

            {/* 通用设置 */}
            <div className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label>最大并发数</Label>
                <Input
                  type="number"
                  value={aiSettings.max_concurrent}
                  onChange={(e) => onSettingsChange({ ...aiSettings, max_concurrent: e.target.value })}
                  placeholder="5"
                />
                <p className="text-xs text-gray-500">同时处理的最大请求数量</p>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4">
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                保存设置
              </Button>
              <Button
                variant="outline"
                onClick={onTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                测试连接
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提示词设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI提示词设置
          </CardTitle>
          <CardDescription>
            自定义AI生成报告时使用的系统提示词
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                提示词决定了AI生成报告的风格、结构和内容。请谨慎修改。
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onResetPrompt}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                重置为默认
              </Button>
            </div>
            <div className="space-y-2">
              <Label>系统提示词</Label>
              <Textarea
                value={aiSettings.system_prompt}
                onChange={(e) => onSettingsChange({ ...aiSettings, system_prompt: e.target.value })}
                placeholder="输入系统提示词..."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                提示词字数：{aiSettings.system_prompt.length} 字
              </p>
            </div>
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              保存提示词
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
