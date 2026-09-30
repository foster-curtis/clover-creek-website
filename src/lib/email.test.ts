import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canEmail, PLACEHOLDER_GUEST_EMAIL, sendEmail } from "./email";

// Resend is replaced wholesale, so nothing here can reach the network.
const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

describe("sendEmail", () => {
  const message = { html: "<p>Hello</p>", text: "Hello" };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    send.mockReset();
  });

  it("reports skipped, and never calls Resend, when no key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendEmail("guest@example.com", "Hi", message)).resolves.toEqual({
      status: "skipped",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports sent when Resend accepts it", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    send.mockResolvedValue({ data: { id: "email_1" }, error: null });
    await expect(sendEmail("guest@example.com", "Hi", message)).resolves.toEqual({
      status: "sent",
    });
  });

  // The webhook records this on the event row; before, it was only logged.
  it("reports Resend's refusal as failed, with its reason", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to` field", statusCode: 422 },
    });
    await expect(sendEmail("guest@example.com", "Hi", message)).resolves.toEqual({
      status: "failed",
      error: "validation_error: Invalid `to` field",
    });
  });

  it("reports a send that throws as failed, rather than throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    send.mockRejectedValue(new Error("fetch failed"));
    await expect(sendEmail("guest@example.com", "Hi", message)).resolves.toEqual({
      status: "failed",
      error: "fetch failed",
    });
  });
});

describe("canEmail", () => {
  it("accepts an ordinary address", () => {
    expect(canEmail("guest@example.com")).toBe(true);
    expect(canEmail(" Guest@Example.co.uk ")).toBe(true);
  });

  it("rejects the manual-booking placeholder", () => {
    expect(canEmail(PLACEHOLDER_GUEST_EMAIL)).toBe(false);
    expect(canEmail("  MANUAL@BOOKING.LOCAL ")).toBe(false);
  });

  it("rejects nothing at all", () => {
    expect(canEmail("")).toBe(false);
    expect(canEmail(null)).toBe(false);
    expect(canEmail(undefined)).toBe(false);
  });

  it("rejects what isn't an address", () => {
    expect(canEmail("no-at-sign")).toBe(false);
    expect(canEmail("guest@localhost")).toBe(false);
    expect(canEmail("two parts@example.com")).toBe(false);
  });
});
