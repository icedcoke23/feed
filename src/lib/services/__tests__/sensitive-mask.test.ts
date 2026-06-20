import { describe, expect, test } from "vitest";
import {
  maskApiKey,
  maskEmail,
  maskPhone,
  maskUrl,
} from "@/lib/sensitive-mask";

describe("sensitive-mask", () => {
  test("maskPhone masks the middle digits of a phone number", () => {
    expect(maskPhone("13800138000")).toBe("138****8000");
  });

  test("maskEmail masks the middle characters of the local part", () => {
    expect(maskEmail("admin@example.com")).toBe("a***n@example.com");
  });

  test("maskApiKey masks the middle of an API key", () => {
    expect(maskApiKey("sk-1234567890abcdef")).toBe("sk-1************def");
  });

  test("maskUrl hides path and query parameters", () => {
    expect(maskUrl("https://api.example.com/v1/secret?token=abc")).toBe(
      "https://api.example.com/...",
    );
  });
});
