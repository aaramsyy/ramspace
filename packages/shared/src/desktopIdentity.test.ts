// Protects packaged app identity, immutable flavor routing and separate storage contracts.
import { describe, expect, it } from "vitest";

import {
  desktopUpdateChannel,
  resolveRamspaceDesktopFlavor,
  resolveRamspaceDesktopRuntimeFlavor,
  canOverrideDesktopSmokeUserData,
  RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
  RAMSPACE_BETA_BUNDLE_ID,
  RAMSPACE_BETA_DESKTOP_ENTRY_URL,
  RAMSPACE_BETA_DESKTOP_ORIGIN,
  RAMSPACE_CANARY_BUNDLE_ID,
  RAMSPACE_CANARY_DESKTOP_ENTRY_URL,
  RAMSPACE_CANARY_DESKTOP_ORIGIN,
  RAMSPACE_CUA_BUNDLE_ID,
  RAMSPACE_CUA_DESKTOP_ENTRY_URL,
  RAMSPACE_CUA_DESKTOP_ORIGIN,
  RAMSPACE_DESKTOP_ENTRY_URL,
  RAMSPACE_DESKTOP_ORIGIN,
  RAMSPACE_DESKTOP_UPDATE_CHANNEL,
  RAMSPACE_DEVELOPMENT_BUNDLE_ID,
  RAMSPACE_PRODUCTION_BUNDLE_ID,
  RAMSPACE_REMOTE_BUNDLE_ID,
  ramspaceDesktopIdentity,
  ramspaceSourceDesktopIdentity,
} from "./desktopIdentity";

describe("desktopIdentity", () => {
  it("uses the exact canonical production and development bundle IDs", () => {
    expect(RAMSPACE_PRODUCTION_BUNDLE_ID).toBe("com.aaramsyy.ramspace");
    expect(RAMSPACE_DEVELOPMENT_BUNDLE_ID).toBe("com.aaramsyy.ramspace.dev");
    expect(ramspaceDesktopIdentity("production").bundleId).toBe(RAMSPACE_PRODUCTION_BUNDLE_ID);
    expect(ramspaceDesktopIdentity("development").bundleId).toBe(RAMSPACE_DEVELOPMENT_BUNDLE_ID);
  });

  it("keeps source Beta and Remote launches off the installed apps' privacy identity", () => {
    const remote = ramspaceSourceDesktopIdentity(ramspaceDesktopIdentity("remote"));
    expect(remote).toEqual({
      ...ramspaceDesktopIdentity("remote"),
      displayName: "Ramspace Remote (Source)",
      bundleId: `${RAMSPACE_REMOTE_BUNDLE_ID}.source`,
    });
    expect(ramspaceSourceDesktopIdentity(ramspaceDesktopIdentity("beta")).bundleId).toBe(
      `${RAMSPACE_BETA_BUNDLE_ID}.source`,
    );
    for (const flavor of ["development", "canary", "cua"] as const) {
      expect(ramspaceSourceDesktopIdentity(ramspaceDesktopIdentity(flavor))).toEqual(
        ramspaceDesktopIdentity(flavor),
      );
    }
  });

  it("uses the exact packaged renderer origin and entry URL", () => {
    expect(RAMSPACE_DESKTOP_ORIGIN).toBe("ramspace://app");
    expect(RAMSPACE_DESKTOP_ENTRY_URL).toBe("ramspace://app/index.html");
  });

  it("uses the isolated Ramspace desktop update channel", () => {
    expect(RAMSPACE_DESKTOP_UPDATE_CHANNEL).toBe("ramspace");
  });

  it("matches the beta update channel to prerelease tags and keeps ramspace otherwise", () => {
    expect(desktopUpdateChannel("beta")).toBe("beta");
    expect(desktopUpdateChannel("remote")).toBe("remote");
    expect(desktopUpdateChannel("production")).toBe(RAMSPACE_DESKTOP_UPDATE_CHANNEL);
    expect(desktopUpdateChannel("canary")).toBe(RAMSPACE_DESKTOP_UPDATE_CHANNEL);
    expect(desktopUpdateChannel("development")).toBe(RAMSPACE_DESKTOP_UPDATE_CHANNEL);
  });

  it("gives Canary a fully separate desktop identity and storage profile", () => {
    expect(RAMSPACE_CANARY_BUNDLE_ID).toBe("com.aaramsyy.ramspace.canary");
    expect(RAMSPACE_CANARY_DESKTOP_ORIGIN).toBe("ramspace-canary://app");
    expect(RAMSPACE_CANARY_DESKTOP_ENTRY_URL).toBe("ramspace-canary://app/index.html");
    expect(ramspaceDesktopIdentity("canary")).toEqual({
      flavor: "canary",
      displayName: "Ramspace Canary",
      bundleId: RAMSPACE_CANARY_BUNDLE_ID,
      scheme: "ramspace-canary",
      origin: RAMSPACE_CANARY_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_CANARY_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-canary",
      defaultHomeDirectoryName: ".ramspace-canary",
      usesScriptedUpdates: true,
    });
  });

  it("gives Cua a fully separate desktop identity and storage profile", () => {
    expect(RAMSPACE_CUA_BUNDLE_ID).toBe("com.aaramsyy.ramspace.cua");
    expect(RAMSPACE_CUA_DESKTOP_ORIGIN).toBe("ramspace-cua://app");
    expect(RAMSPACE_CUA_DESKTOP_ENTRY_URL).toBe("ramspace-cua://app/index.html");
    expect(ramspaceDesktopIdentity("cua")).toEqual({
      flavor: "cua",
      displayName: "Ramspace Cua",
      bundleId: RAMSPACE_CUA_BUNDLE_ID,
      scheme: "ramspace-cua",
      origin: RAMSPACE_CUA_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_CUA_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-cua",
      defaultHomeDirectoryName: ".ramspace-cua",
      usesScriptedUpdates: true,
    });
  });

  it("gives Beta a fully separate desktop identity and storage profile", () => {
    expect(RAMSPACE_BETA_BUNDLE_ID).toBe("com.aaramsyy.ramspace.beta");
    expect(RAMSPACE_BETA_DESKTOP_ORIGIN).toBe("ramspace-beta://app");
    expect(RAMSPACE_BETA_DESKTOP_ENTRY_URL).toBe("ramspace-beta://app/index.html");
    expect(ramspaceDesktopIdentity("beta")).toEqual({
      flavor: "beta",
      displayName: "Ramspace Beta",
      bundleId: RAMSPACE_BETA_BUNDLE_ID,
      scheme: "ramspace-beta",
      origin: RAMSPACE_BETA_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_BETA_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-beta",
      defaultHomeDirectoryName: ".ramspace-beta",
      usesScriptedUpdates: false,
    });
  });

  it("gives Remote its own app, account service, protocol, storage and updater identity", () => {
    expect(ramspaceDesktopIdentity("remote")).toEqual({
      flavor: "remote",
      displayName: "Ramspace Remote",
      bundleId: "com.aaramsyy.ramspace.remote",
      scheme: "ramspace-remote",
      origin: "ramspace-remote://app",
      entryUrl: "ramspace-remote://app/index.html",
      userDataDirectoryName: "ramspace-remote",
      defaultHomeDirectoryName: ".ramspace-remote",
      defaultAccountUrl: "https://ramspace-account-api-trial.ramspace-orgs.workers.dev",
      usesScriptedUpdates: false,
    });
    expect(RAMSPACE_REMOTE_BUNDLE_ID).toBe("com.aaramsyy.ramspace.remote");
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: "remote" })).toBe(
      "remote",
    );
  });

  it("selects explicit source flavors without changing packaged Stable", () => {
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: false })).toBe("production");
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: true })).toBe("development");
    expect(
      resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: "development" }),
    ).toBe("production");
    expect(
      resolveRamspaceDesktopFlavor({
        isDevelopment: false,
        requestedFlavor: "development",
        allowDevelopmentOverride: true,
      }),
    ).toBe("development");
    expect(
      resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: " canary " }),
    ).toBe("canary");
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: true, requestedFlavor: "canary" })).toBe(
      "canary",
    );
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: "cua" })).toBe(
      "cua",
    );
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: true, requestedFlavor: "CUA" })).toBe(
      "cua",
    );
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: "beta" })).toBe(
      "beta",
    );
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: false, requestedFlavor: " beta " })).toBe(
      "beta",
    );
    expect(resolveRamspaceDesktopFlavor({ isDevelopment: true, requestedFlavor: "beta" })).toBe(
      "beta",
    );
  });

  it("isolates development and Canary homes from packaged Stable", () => {
    expect(ramspaceDesktopIdentity("development").defaultHomeDirectoryName).toBe(".ramspace-dev");
    expect(ramspaceDesktopIdentity("canary").defaultHomeDirectoryName).toBe(".ramspace-canary");
    expect(ramspaceDesktopIdentity("cua").defaultHomeDirectoryName).toBe(".ramspace-cua");
    expect(ramspaceDesktopIdentity("beta").defaultHomeDirectoryName).toBe(".ramspace-beta");
    expect(ramspaceDesktopIdentity("production").defaultHomeDirectoryName).toBe(".ramspace");
  });

  it.each(["production", "canary", "cua", "beta", "remote"] as const)(
    "uses the immutable %s package flavor despite inherited source settings",
    (packagedFlavor) => {
      expect(
        resolveRamspaceDesktopRuntimeFlavor({
          isPackaged: true,
          isDevelopment: true,
          packagedFlavor,
          requestedFlavor: "development",
          allowDevelopmentOverride: true,
        }),
      ).toBe(packagedFlavor);
    },
  );

  it("keeps legacy packaged Stable independent from a source shell's flavor", () => {
    expect(
      resolveRamspaceDesktopRuntimeFlavor({
        isPackaged: true,
        isDevelopment: false,
        requestedFlavor: "cua",
      }),
    ).toBe("production");
  });

  it("preserves source launcher routing, including its bundled macOS bootstrap", () => {
    expect(
      resolveRamspaceDesktopRuntimeFlavor({
        isPackaged: true,
        isDevelopment: false,
        requestedFlavor: "development",
        allowDevelopmentOverride: true,
      }),
    ).toBe("development");
    expect(
      resolveRamspaceDesktopRuntimeFlavor({
        isPackaged: false,
        isDevelopment: true,
        requestedFlavor: "canary",
      }),
    ).toBe("canary");
  });

  it.each(["development", "CUA", null])(
    "rejects malformed packaged identity %j before opening any profile",
    (packagedFlavor) => {
      expect(() =>
        resolveRamspaceDesktopRuntimeFlavor({
          isPackaged: true,
          isDevelopment: false,
          packagedFlavor,
        }),
      ).toThrow("packaged Ramspace desktop flavor is invalid");
    },
  );

  it("isolates smoke profiles only for source launches or isolated packages", () => {
    expect(canOverrideDesktopSmokeUserData({ packagedFlavor: "cua" })).toBe(true);
    expect(canOverrideDesktopSmokeUserData({ packagedFlavor: "beta" })).toBe(true);
    expect(canOverrideDesktopSmokeUserData({ packagedFlavor: "remote" })).toBe(true);
    expect(
      canOverrideDesktopSmokeUserData({
        sourceBuildMarker: RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
      }),
    ).toBe(true);
    for (const packagedFlavor of ["production", "canary", "development", null]) {
      expect(
        canOverrideDesktopSmokeUserData({
          packagedFlavor,
          sourceBuildMarker: RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
        }),
      ).toBe(false);
    }
    expect(canOverrideDesktopSmokeUserData({})).toBe(false);
  });
});
