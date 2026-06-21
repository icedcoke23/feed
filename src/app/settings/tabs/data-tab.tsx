"use client";

import { DataManager } from "@/components/business/data-management";
import { mutate as globalMutate } from "swr";
import {
  COURSE_STAGES_KEY,
  TAGS_KEY,
  THEMES_KEY,
  AI_SETTINGS_KEY,
  USERS_KEY,
} from "@/lib/swr";

export function DataTab() {
  const handleDataChanged = () => {
    globalMutate(COURSE_STAGES_KEY);
    globalMutate(TAGS_KEY);
    globalMutate(THEMES_KEY);
    globalMutate(AI_SETTINGS_KEY);
    globalMutate(USERS_KEY);
  };

  return <DataManager onDataChanged={handleDataChanged} />;
}
