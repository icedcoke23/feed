// 类型来源：Drizzle schema (src/storage/database/shared/schema.ts) - feedbacks 表及相关表
// 字段命名使用 snake_case，与 Supabase 客户端返回的数据库列名一致
// Drizzle schema 中的 camelCase 属性名映射：studentId→student_id, teacherId→teacher_id, teachingPlan→teaching_plan, aiReport→ai_report, workInfo→work_info, abilityScores→ability_scores, parentFeedbackId→parent_feedback_id, createdAt→created_at, updatedAt→updated_at, periodStart→period_start, periodEnd→period_end

export interface FeedbackStudent {
  id: string;
  name: string;
  grade: string;
  class_name: string;
  school?: string;
  current_teacher_id?: string;
  admin_teacher?: {
    id: string;
    name: string;
    phone?: string;
  };
  class?: {
    id: string;
    name: string;
    grade: string;
    teacher_id?: string;
  };
}

export interface TagItem {
  id: string;
  category: string;
  name: string;
  description: string;
}

export interface FeedbackTheme {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface FeedbackTeacher {
  id: string;
  name: string;
  phone?: string;
  role?: "admin" | "teacher"; // admin=教务, teacher=授课
}

export interface FeedbackHistory {
  id: string;
  feedback_date: string;
  teaching_theme: string;
  overall_rating: number;
  strengths: string[];
  areas_for_improvement: string[];
}

export interface TagRating {
  rating: number;
  note: string;
  isCustom?: boolean;
  category?: string;
}

export interface GeneratedReport {
  strengths: string;
  improvements: string;
  weaknesses: string;
  recommendations: string;
  summary: string;
  parseWarning?: boolean;
}

export interface CoursePlan {
  id: string;
  stage: string;
  theme: string;
  content: string;
  goal: string;
  status?: "completed" | "current" | "upcoming";
}

export interface CourseStagePreset {
  id: string;
  stage_code: string;
  stage_name: string;
  theme: string;
  level: string;
  description: string;
  content: string;
  goal: string;
}

export interface StudentPhoto {
  id: string;
  url: string;
  file?: File;
}

// PDF 报告数据（用于 PDF 预览页面和 sessionStorage 传递）
export interface ReportData {
  studentId: string;
  teacherId: string;
  adminTeacherId?: string;
  studentName?: string;
  grade?: string;
  className?: string;
  school?: string;
  theme?: string;
  feedbackDate: string;
  teacherName?: string;
  teacherPhone?: string;
  adminTeacherName?: string;
  adminTeacherPhone?: string;
  campus: string;
  strengths: string;
  improvements: string;
  weaknesses: string;
  recommendations: string;
  summary: string;
  tagRatings: Array<{ name: string; rating: number; note: string }>;
  hasCoursePlan: boolean;
  coursePlans: CoursePlan[];
  currentStageId: string | null;
  studentPhotos: StudentPhoto[];
}

export interface CategorizedTags {
  strength: TagItem[];
  improvement: TagItem[];
  weakness: TagItem[];
}

export interface StepConfig {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

// 作品信息
export interface WorkInfo {
  name: string;           // 作品名称
  completion: number;     // 完成度 0-100
  creativity: number;     // 创意性评分 1-5
  functionality: string;  // 功能实现情况描述
}

// 能力评分
export interface AbilityScore {
  dimension: string;  // 能力维度名称（如"空间建构能力"）
  score: number;      // 评分 1-5
}

// 反馈表单数据（包含作品信息和能力评分）
export interface FeedbackFormData {
  workInfo?: WorkInfo;
  abilityScores?: AbilityScore[];
}

// 反馈详情（完整字段，用于反馈详情页）
export interface FeedbackDetail {
  id: string;
  student_id: string;
  strengths: Array<{ tag: string; description: string }>;
  improvements: Array<{ tag: string; description: string }>;
  weaknesses: Array<{ tag: string; description: string }>;
  teaching_plan: Array<{
    stage: string;
    theme: string;
    experimentType: string;
    subject: string;
    knowledgePoints: string;
    notes: string;
  }>;
  suggestions: string;
  ai_report: string;
  metadata: Record<string, unknown> | null;
  work_info?: Record<string, unknown>;
  ability_scores?: Array<Record<string, unknown>>;
  version: number;
  parent_feedback_id?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  period_start: string;
  period_end: string;
}
