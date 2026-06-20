import * as lookupRepo from "@/lib/repositories/lookup-repository";
import * as cache from "@/lib/cache/cache";

const TTL = 1000 * 60 * 5;

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) return cached;
  const data = await fetcher();
  cache.set(key, data, TTL);
  return data;
}

export async function listTags() {
  return cached("lookup:tags", lookupRepo.listTags);
}

export async function listThemes() {
  return cached("lookup:themes", lookupRepo.listThemes);
}

export async function listCourseStages() {
  return cached("lookup:course-stages", lookupRepo.listCourseStages);
}

export async function listActiveTeachers() {
  return cached("lookup:teachers", lookupRepo.listActiveTeachers);
}

export function invalidateTags() {
  cache.invalidate("lookup:tags");
}

export function invalidateThemes() {
  cache.invalidate("lookup:themes");
}

export function invalidateCourseStages() {
  cache.invalidate("lookup:course-stages");
}

export function invalidateTeachers() {
  cache.invalidate("lookup:teachers");
}

export function invalidateAllLookups() {
  invalidateTags();
  invalidateThemes();
  invalidateCourseStages();
  invalidateTeachers();
}
