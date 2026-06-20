"use client";

import { AISettingsPanel } from "@/components/business/ai-settings-panel";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { useAISettings } from "@/hooks/use-settings-data";

export function AISettingsTab() {
  const {
    aiSettings,
    setAiSettings,
    aiSettingsLoading,
    saving,
    testingConnection,
    confirmDialog,
    setConfirmDialog,
    saveAISettings,
    testConnection,
    resetPrompt,
  } = useAISettings();

  return (
    <>
      <AISettingsPanel
        aiSettings={aiSettings}
        onSettingsChange={setAiSettings}
        loading={aiSettingsLoading}
        saving={saving}
        testingConnection={testingConnection}
        onSave={saveAISettings}
        onTestConnection={testConnection}
        onResetPrompt={resetPrompt}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </>
  );
}
