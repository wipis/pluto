import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthError,
  ForbiddenError,
  ExternalServiceError,
  getUserMessage,
  isRetryable,
} from "./errors";

describe("Error classes", () => {
  it("AppError has correct properties", () => {
    const err = new AppError("test", "TEST_CODE", 500, { key: "value" });
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(500);
    expect(err.details).toEqual({ key: "value" });
    expect(err.name).toBe("AppError");
  });

  it("NotFoundError has 404 status", () => {
    const err = new NotFoundError("User", "abc");
    expect(err.message).toBe("User not found: abc");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
  });

  it("NotFoundError without ID", () => {
    const err = new NotFoundError("User");
    expect(err.message).toBe("User not found");
  });

  it("ValidationError has 400 status", () => {
    const err = new ValidationError("Invalid email");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("AuthError has 401 status", () => {
    const err = new AuthError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });

  it("ForbiddenError has 403 status", () => {
    const err = new ForbiddenError("Admin access required");
    expect(err.message).toBe("Admin access required");
    expect(err.statusCode).toBe(403);
  });

  it("ExternalServiceError has 502 status and retryable flag", () => {
    const err = new ExternalServiceError("Exa", "API error");
    expect(err.message).toBe("Exa: API error");
    expect(err.statusCode).toBe(502);
    expect(err.retryable).toBe(true);
  });

  it("ExternalServiceError can be non-retryable", () => {
    const err = new ExternalServiceError("Gmail", "Auth failed", {
      retryable: false,
    });
    expect(err.retryable).toBe(false);
  });
});

describe("isRetryable", () => {
  it("returns false for AuthError", () => {
    expect(isRetryable(new AuthError())).toBe(false);
  });

  it("returns false for ForbiddenError", () => {
    expect(isRetryable(new ForbiddenError())).toBe(false);
  });

  it("returns false for ValidationError", () => {
    expect(isRetryable(new ValidationError("bad input"))).toBe(false);
  });

  it("returns false for NotFoundError", () => {
    expect(isRetryable(new NotFoundError("Thing"))).toBe(false);
  });

  it("returns true for retryable ExternalServiceError", () => {
    expect(isRetryable(new ExternalServiceError("Exa", "500"))).toBe(true);
  });

  it("returns false for non-retryable ExternalServiceError", () => {
    expect(
      isRetryable(
        new ExternalServiceError("Exa", "401", { retryable: false })
      )
    ).toBe(false);
  });

  it("returns true for unknown errors", () => {
    expect(isRetryable(new Error("unknown"))).toBe(true);
    expect(isRetryable("string error")).toBe(true);
  });
});

describe("getUserMessage", () => {
  it("extracts message from AppError", () => {
    expect(getUserMessage(new NotFoundError("User"))).toBe("User not found");
  });

  it("extracts message from regular Error", () => {
    expect(getUserMessage(new Error("something broke"))).toBe(
      "something broke"
    );
  });

  it("returns fallback for non-errors", () => {
    expect(getUserMessage("string")).toBe("An unexpected error occurred");
    expect(getUserMessage(null)).toBe("An unexpected error occurred");
  });
});
