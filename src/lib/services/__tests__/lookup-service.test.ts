import { describe, expect, test } from "vitest";
import * as lookupService from "@/lib/services/lookup-service";

describe("lookup-service", () => {
  test("listGrades returns an empty array", async () => {
    const grades = await lookupService.listGrades();
    expect(grades).toEqual([]);
  });
});
