export interface CoursePrompt {
  id: string;
  stage_code: string;
  system_prompt: string;
  report_structure: string;
  word_limit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoursePromptInput {
  stage_code: string;
  system_prompt: string;
  report_structure: string;
  word_limit: string;
  is_active?: boolean;
}
