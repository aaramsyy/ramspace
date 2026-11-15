// FILE: betaFeatureGate.test.ts
// Purpose: Verify the server host's shared Beta-only feature policy.
import { afterEach, expect, it, vi } from "vitest";
import {
  RAMSPACE_BETA_BUNDLE_ID,
  RAMSPACE_DESKTOP_BUNDLE_ID_ENV,
  RAMSPACE_PRODUCTION_BUNDLE_ID,
} from "@ramspace/shared/desktopIdentity";
import { ACCOUNT_INBOX_BETA_FEATURE } from "@ramspace/shared/betaFeatures";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([
  [RAMSPACE_PRODUCTION_BUNDLE_ID, true],
  [RAMSPACE_BETA_BUNDLE_ID, true],
] as const)("allows saved Inbox recaps on the host bundle (%s)", async (bundleId, enabled) => {
  vi.stubEnv(RAMSPACE_DESKTOP_BUNDLE_ID_ENV, bundleId);
  vi.resetModules();
  const { isServerBetaFeatureEnabled } = await import("./betaFeatureGate");
  expect(isServerBetaFeatureEnabled(ACCOUNT_INBOX_BETA_FEATURE)).toBe(enabled);
});
