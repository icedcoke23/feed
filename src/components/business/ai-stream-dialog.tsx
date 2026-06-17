"use client";

import { Sparkles, RefreshCw, StopCircle, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DOMPurify from "dompurify";
import type { ConnectionStatus } from "@/hooks/use-sse-stream";

function renderMarkdown(text: string): string {
  return text
    .replace(/【([^】]+)】/g, '<h3 class="text-lg font-bold mt-4 mb-2 text-slate-800">$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br/>');
}

interface AIStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "generating" | "reviewing";
  content: string;
  isStreaming?: boolean;
  connectionStatus?: ConnectionStatus;
  onAbortStream?: () => void;
}

export function AIStreamDialog({ open, onOpenChange, type, content, isStreaming, connectionStatus = "idle", onAbortStream }: AIStreamDialogProps) {
  const isGenerating = type === "generating";
  const isConnecting = connectionStatus === "connecting";
  const isConnectionError = connectionStatus === "error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isGenerating ? (
              <Sparkles className="h-5 w-5 animate-pulse" />
            ) : (
              <RefreshCw className="h-5 w-5 animate-spin" />
            )}
            {isGenerating ? "AI正在生成反馈报告..." : "AI正在复检优化报告..."}
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? "请稍候，AI正在根据学员信息和评价数据生成个性化反馈"
              : "AI正在检查报告内容并进行优化，请稍候"}
          </DialogDescription>
        </DialogHeader>

        {/* 连接状态指示 */}
        {isConnecting && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在连接 AI 服务...</span>
          </div>
        )}
        {isConnectionError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>连接失败，请重试</span>
          </div>
        )}

        <div className="mt-4 p-4 bg-gray-50 rounded-lg min-h-[200px] max-h-[400px] overflow-y-auto">
          <div
            className="prose prose-sm max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(content)) }}
          />
        </div>
        {isStreaming && onAbortStream && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={onAbortStream}
              disabled={isConnecting}
              className="mt-2 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              取消生成
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
