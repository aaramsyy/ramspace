import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RAMSPACE_BETA_BUNDLE_ID,
  RAMSPACE_PRODUCTION_BUNDLE_ID,
  RAMSPACE_REMOTE_BUNDLE_ID,
} from "@ramspace/shared/desktopIdentity";
import {
  accountLiveActivityEnabled,
  accountProfileSyncUnavailableReason,
  remoteConnectionsUnavailableReason,
  requireAccountProfileSync,
} from "./remoteFeaturePolicy";

afterEach(() => vi.unstubAllEnvs());

describe("Stable remote activation", () => {
  it("requires an explicit opt-in even with a configured account origin", () => {
    vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", RAMSPACE_PRODUCTION_BUNDLE_ID);
    vi.stubEnv("RAMSPACE_REMOTE_CONNECTIONS", undefined);
    vi.stubEnv("RAMSPACE_ACCOUNT_URL", "https://account.example.test");
    expect(remoteConnectionsUnavailableReason()).toBe(
      "Remote connections are unavailable in Stable.",
    );
    expect(accountLiveActivityEnabled()).toBe(false);
  });

  it.each([
    undefined,
    "not-a-url",
    "http://account.example.test",
    "https://user:pass@account.example.test",
    "https://account.example.test/api/v1",
    "https://account.example.test/?org=one",
    "https://account.example.test/#account",
    "https://account.example.test?",
    "https://account.example.test#",
  ])("rejects a missing or invalid account origin: %s", (accountUrl) => {
    vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", RAMSPACE_PRODUCTION_BUNDLE_ID);
    vi.stubEnv("RAMSPACE_REMOTE_CONNECTIONS", "1");
    vi.stubEnv("RAMSPACE_ACCOUNT_URL", accountUrl);
    expect(remoteConnectionsUnavailableReason()).toBe(
      "Remote connections are unavailable in Stable.",
    );
    expect(accountLiveActivityEnabled()).toBe(false);
  });

  it("allows the configured Stable host only on the supported runtime", () => {
    vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", RAMSPACE_PRODUCTION_BUNDLE_ID);
    vi.stubEnv("RAMSPACE_REMOTE_CONNECTIONS", "1");
    vi.stubEnv("RAMSPACE_ACCOUNT_URL", "https://account.example.test");
    const supportedRuntime = !process.versions.bun && process.versions.node.startsWith("24.");
    expect(remoteConnectionsUnavailableReason()).toBe(
      supportedRuntime ? undefined : "Remote connections require the Node 24 server runtime.",
    );
    expect(accountLiveActivityEnabled()).toBe(supportedRuntime);
  });
});

describe("account profile activation", () => {
  it.each([RAMSPACE_PRODUCTION_BUNDLE_ID, RAMSPACE_REMOTE_BUNDLE_ID])(
    "enables account profiles without operator setup in %s but honors an explicit opt-out",
    (bundleId) => {
      vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", bundleId);
      vi.stubEnv("RAMSPACE_ACCOUNT_PROFILE_SYNC", undefined);
      expect(requireAccountProfileSync).not.toThrow();
      vi.stubEnv("RAMSPACE_ACCOUNT_PROFILE_SYNC", "0");
      expect(requireAccountProfileSync).toThrow("profile sync is unavailable");
    },
  );
  it("requires an explicit opt-in, including on Beta", () => {
    vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", RAMSPACE_BETA_BUNDLE_ID);
    vi.stubEnv("RAMSPACE_ACCOUNT_PROFILE_SYNC", undefined);
    expect(accountProfileSyncUnavailableReason()).toContain("RAMSPACE_ACCOUNT_PROFILE_SYNC=1");
    expect(requireAccountProfileSync).toThrow("profile sync is unavailable");
    vi.stubEnv("RAMSPACE_ACCOUNT_PROFILE_SYNC", "1");
    expect(accountProfileSyncUnavailableReason()).toBeUndefined();
    expect(requireAccountProfileSync).not.toThrow();
  });

  it("allows an explicit Stable opt-in", () => {
    vi.stubEnv("RAMSPACE_DESKTOP_BUNDLE_ID", RAMSPACE_PRODUCTION_BUNDLE_ID);
    vi.stubEnv("RAMSPACE_ACCOUNT_PROFILE_SYNC", "1");
    expect(requireAccountProfileSync).not.toThrow();
  });
});
