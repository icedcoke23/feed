import { describe, expect, test, beforeEach, vi } from "vitest";
import * as authService from "@/lib/services/auth-service";
import { clearStatsCache, getStats, type StatsResult } from "@/lib/services/stats-service";
import type { AuthUserResult } from "@/lib/route-auth";

// Mock authService 的 getAccessibleStudentIds
vi.spyOn(authService, "getAccessibleStudentIds").mockResolvedValue([]);

// Mock db 为空查询结果，避免触达真实数据库
vi.mock("@/storage/database/drizzle-client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
  },
}));

describe("stats-service", () => {
  beforeEach(() => {
    clearStatsCache();
    vi.clearAllMocks();
  });

  test("无权访问任何学生时返回空统计", async () => {
    const user: AuthUserResult = {
      userId: "u-empty",
      userRole: "teacher",
    };

    const result = await getStats(user);

    expect(result).not.toBeInstanceOf(Response);
    const stats = result as StatsResult;
    expect(stats.studentCount).toBe(0);
    expect(stats.feedbackCount).toBe(0);
    expect(stats.thisMonthStudents).toBe(0);
    expect(stats.thisMonthFeedbacks).toBe(0);
    expect(stats.feedbackTrend).toEqual([]);
    expect(stats.gradeDistribution).toEqual([]);
    expect(stats.tagUsage).toEqual([]);
    expect(stats.recentFeedbacks).toEqual([]);
  });

  test("无 user 返回 403", async () => {
    const result = await getStats(null as unknown as AuthUserResult);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("clearStatsCache 清除所有缓存", async () => {
    const user: AuthUserResult = {
      userId: "u-cache",
      userRole: "teacher",
    };

    // 第一次调用（空学生列表，会短路返回，不写缓存）
    await getStats(user);
    // 清除缓存
    clearStatsCache();
    // 再次调用应重新执行（getAccessibleStudentIds 被调用 2 次）
    await getStats(user);

    expect(authService.getAccessibleStudentIds).toHaveBeenCalledTimes(2);
  });

  test("clearStatsCache(userId) 仅清除指定用户缓存", async () => {
    const user: AuthUserResult = {
      userId: "u-target",
      userRole: "teacher",
    };

    await getStats(user);
    clearStatsCache("u-target");
    await getStats(user);

    expect(authService.getAccessibleStudentIds).toHaveBeenCalledTimes(2);
  });
});
