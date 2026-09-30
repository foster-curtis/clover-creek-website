import { describe, expect, it } from "vitest";
import { blocked, done, moneyMoved } from "./actionResult";

describe("ActionResult", () => {
  it("marks a blocked failure as retryable, keeping the message verbatim", () => {
    expect(blocked("Booking not found")).toEqual({
      ok: false,
      message: "Booking not found",
      severity: "blocked",
    });
  });

  it("keeps money-moved distinct from blocked", () => {
    const result = moneyMoved("The refund WENT THROUGH");
    expect(result).toMatchObject({ ok: false, severity: "money-moved" });
    expect(result).not.toEqual(blocked("The refund WENT THROUGH"));
  });

  it("reports success with or without a message", () => {
    expect(done("Refunded $10.00")).toMatchObject({ ok: true, message: "Refunded $10.00" });
    expect(done().ok).toBe(true);
  });
});
