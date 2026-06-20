import "server-only";
import { getHomeData } from "@/lib/services/home-service";
import type { AuthUserResult } from "@/lib/route-auth";

export async function fetchHomeData(user: AuthUserResult, page = 1, limit = 50) {
  return getHomeData(user, { page, limit });
}
