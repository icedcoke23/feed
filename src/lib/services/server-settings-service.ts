import "server-only";
import { db } from "@/storage/database/drizzle-client";
import { courseStages, tags, teachingThemes, aiSettings, users } from "@/storage/database/shared/schema";
import { desc, asc } from "drizzle-orm";

export async function fetchSettingsPageData() {
  const [courseStagesData, tagsData, themesData, aiSettingsData, usersData] = await Promise.all([
    db.select().from(courseStages).orderBy(desc(courseStages.createdAt)),
    db.select().from(tags).orderBy(asc(tags.sortOrder)),
    db.select().from(teachingThemes).orderBy(asc(teachingThemes.sortOrder)),
    db.select().from(aiSettings).limit(1),
    db.select().from(users),
  ]);

  const aiSettingsRow = aiSettingsData[0];
  const aiSettingsPayload = aiSettingsRow
    ? {
        api_key: aiSettingsRow.apiKey || "",
        base_url: aiSettingsRow.baseUrl || "",
        model_id: aiSettingsRow.modelId || "",
        max_concurrent: String(aiSettingsRow.maxConcurrent ?? 5),
        system_prompt: aiSettingsRow.systemPrompt || "",
        use_custom_ai: String(aiSettingsRow.useCustomAi ?? false),
      }
    : null;

  return {
    courseStages: courseStagesData,
    tags: tagsData,
    themes: themesData,
    aiSettings: aiSettingsPayload,
    users: usersData,
  };
}
