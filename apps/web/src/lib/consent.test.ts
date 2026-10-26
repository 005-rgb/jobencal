// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getConsent,
  loadAdScripts,
  onChange,
  setConsent,
} from "./consent.js";

describe("browser consent controls", () => {
  beforeEach(() => {
    document.cookie = "jb_consent=; Max-Age=0; Path=/";
    document.head
      .querySelectorAll("script[data-jobenapp-ad-script]")
      .forEach((script) => script.remove());
  });

  it("stores only the purpose choices and keeps necessary consent enabled", () => {
    const saved = setConsent({ analytics: false, ads: true });
    expect(saved).toEqual({ necessary: true, analytics: false, ads: true });
    expect(getConsent()).toEqual(saved);
    expect(decodeURIComponent(document.cookie)).not.toContain("email");
  });

  it("notifies listeners and allows unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = onChange(listener);
    const saved = setConsent({ analytics: true, ads: false });
    unsubscribe();
    setConsent({ analytics: false, ads: false });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(saved);
  });

  it.each([
    {
      enabled: false,
      consent: { necessary: true, analytics: true, ads: true } as const,
    },
    { enabled: true, consent: null },
    {
      enabled: true,
      consent: { necessary: true, analytics: true, ads: false } as const,
    },
  ])(
    "does not append ad scripts without both backend and user consent",
    ({ enabled, consent }) => {
      const append = vi.fn();
      const loaded = loadAdScripts(
        enabled,
        consent,
        [{ id: "provider", src: "https://ads.example.invalid/script.js" }],
        append,
      );
      expect(loaded).toEqual([]);
      expect(append).not.toHaveBeenCalled();
    },
  );

  it("loads only valid explicit HTTPS scripts after both gates pass", () => {
    const append = vi.fn();
    const loaded = loadAdScripts(
      true,
      { necessary: true, analytics: false, ads: true },
      [
        { id: "provider", src: "https://ads.example.invalid/script.js" },
        { id: "provider", src: "https://ads.example.invalid/duplicate.js" },
      ],
      append,
    );
    expect(loaded).toEqual(["provider"]);
    expect(append).toHaveBeenCalledOnce();
  });
});
