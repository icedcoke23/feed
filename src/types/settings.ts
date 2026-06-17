export interface CourseStage {
  id: string;
  stage_code: string;
  stage_name: string;
  theme: string;
  level: string;
  description: string;
  content: string;
  goal: string;
  sort_order: number;
  is_active: boolean;
}

export { type CourseStagePreset } from "@/lib/constants/course-stages";
export { DEFAULT_COURSE_STAGES as DEFAULT_PRESETS } from "@/lib/constants/course-stages";

export interface Tag {
  id: string;
  category: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface UserItem {
  id: string;
  username: string;
  name: string;
  role: "admin" | "teacher";
  teacherRole?: "admin" | "teacher"; // teachers 表中的角色：admin=教务, teacher=授课
  phone?: string;
  password?: string;
  is_active: boolean;
  created_at: string;
}

export interface Theme {
  id: string;
  name: string;
  category: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface AISettings {
  api_key: string;
  base_url: string;
  model_id: string;
  max_concurrent: string;
  system_prompt: string;
  use_custom_ai: string;
}

export const THEME_OPTIONS = [
  { value: "Scratch", label: "Scratch" },
  { value: "Python", label: "Python" },
  { value: "C++", label: "C++" },
  { value: "大颗粒", label: "大颗粒" },
  { value: "小颗粒", label: "小颗粒" },
  { value: "BricQ", label: "BricQ" },
  { value: "WEDO2.0", label: "WEDO2.0" },
  { value: "SPIKE", label: "SPIKE" },
  { value: "other", label: "其他..." },
];

export const LEVEL_OPTIONS = [
  { value: "beginner", label: "初阶" },
  { value: "intermediate", label: "中阶" },
  { value: "advanced", label: "高阶" },
  { value: "foundation", label: "一年" },
  { value: "other", label: "其他..." },
];

export const TAG_CATEGORY_OPTIONS = [
  { value: "strength", label: "学员优点", color: "green" },
  { value: "improvement", label: "能力提升", color: "blue" },
  { value: "weakness", label: "需要提升", color: "red" },
];
