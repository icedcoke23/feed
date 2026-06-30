import type { ReportData } from "@/types/feedback";

const PDF_REPORT_KEY = "pdfReportData";
const TEMP_REPORT_KEY = "tempReportData";

/** 保存 PDF 报告数据到 localStorage（PDF 页面使用） */
export function savePdfReportData(data: ReportData): void {
  try {
    localStorage.setItem(PDF_REPORT_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("保存 PDF 报告数据失败:", e);
  }
}

/** 加载 PDF 报告数据（PDF 页面使用） */
export function loadPdfReportData(): ReportData | null {
  try {
    const stored = localStorage.getItem(PDF_REPORT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ReportData;
  } catch (e) {
    console.error("加载 PDF 报告数据失败:", e);
    return null;
  }
}

/** 清除 PDF 报告数据 */
export function clearPdfReportData(): void {
  localStorage.removeItem(PDF_REPORT_KEY);
}

/**
 * 将 PDF 报告数据复制到 tempReportData（返回反馈表单页时使用）。
 * PDF 页面编辑后的数据通过此函数传递给反馈表单页恢复。
 */
export function transferToTempReport(): void {
  const stored = localStorage.getItem(PDF_REPORT_KEY);
  if (stored) {
    localStorage.setItem(TEMP_REPORT_KEY, stored);
  }
}

/**
 * 加载临时报告数据（反馈表单页从 PDF 返回时恢复使用）。
 * 数据由 transferToTempReport 写入 localStorage，此处读取。
 */
export function loadTempReport(): ReportData | null {
  try {
    const stored = localStorage.getItem(TEMP_REPORT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ReportData;
  } catch (e) {
    console.error("加载临时报告数据失败:", e);
    return null;
  }
}

/** 清除临时报告数据 */
export function clearTempReport(): void {
  localStorage.removeItem(TEMP_REPORT_KEY);
}
