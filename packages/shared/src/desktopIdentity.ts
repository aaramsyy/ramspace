// FILE: desktopIdentity.ts
// Purpose: Defines the canonical desktop application identity across packaging and runtime.

export const RAMSPACE_DESKTOP_SCHEME = "ramspace";
export const RAMSPACE_DESKTOP_ORIGIN = `${RAMSPACE_DESKTOP_SCHEME}://app`;
export const RAMSPACE_DESKTOP_ENTRY_URL = `${RAMSPACE_DESKTOP_ORIGIN}/index.html`;
export const RAMSPACE_DESKTOP_UPDATE_CHANNEL = "ramspace";
export const RAMSPACE_PRODUCTION_BUNDLE_ID = "com.aaramsyy.ramspace";
export const RAMSPACE_DEVELOPMENT_BUNDLE_ID = `${RAMSPACE_PRODUCTION_BUNDLE_ID}.dev`;
export const RAMSPACE_CANARY_BUNDLE_ID = `${RAMSPACE_PRODUCTION_BUNDLE_ID}.canary`;
/** Display/setup identity of the GUI host; this value does not confer native authority. */
export const RAMSPACE_DESKTOP_BUNDLE_ID_ENV = "RAMSPACE_DESKTOP_BUNDLE_ID";
export const RAMSPACE_CANARY_DESKTOP_SCHEME = "ramspace-canary";
export const RAMSPACE_CANARY_DESKTOP_ORIGIN = `${RAMSPACE_CANARY_DESKTOP_SCHEME}://app`;
export const RAMSPACE_CANARY_DESKTOP_ENTRY_URL = `${RAMSPACE_CANARY_DESKTOP_ORIGIN}/index.html`;
export const RAMSPACE_CUA_BUNDLE_ID = `${RAMSPACE_PRODUCTION_BUNDLE_ID}.cua`;
export const RAMSPACE_CUA_DESKTOP_SCHEME = "ramspace-cua";
export const RAMSPACE_CUA_DESKTOP_ORIGIN = `${RAMSPACE_CUA_DESKTOP_SCHEME}://app`;
export const RAMSPACE_CUA_DESKTOP_ENTRY_URL = `${RAMSPACE_CUA_DESKTOP_ORIGIN}/index.html`;
export const RAMSPACE_BETA_BUNDLE_ID = `${RAMSPACE_PRODUCTION_BUNDLE_ID}.beta`;
export const RAMSPACE_BETA_DESKTOP_SCHEME = "ramspace-beta";
export const RAMSPACE_BETA_DESKTOP_ORIGIN = `${RAMSPACE_BETA_DESKTOP_SCHEME}://app`;
export const RAMSPACE_BETA_DESKTOP_ENTRY_URL = `${RAMSPACE_BETA_DESKTOP_ORIGIN}/index.html`;
export const RAMSPACE_REMOTE_BUNDLE_ID = `${RAMSPACE_PRODUCTION_BUNDLE_ID}.remote`;
export const RAMSPACE_REMOTE_DESKTOP_SCHEME = "ramspace-remote";
export const RAMSPACE_REMOTE_DESKTOP_ORIGIN = `${RAMSPACE_REMOTE_DESKTOP_SCHEME}://app`;
export const RAMSPACE_REMOTE_DESKTOP_ENTRY_URL = `${RAMSPACE_REMOTE_DESKTOP_ORIGIN}/index.html`;
export const RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER = "ramspace-source-desktop-build-v2";
export const RAMSPACE_DESKTOP_SMOKE_USER_DATA_ENV = "RAMSPACE_DESKTOP_SMOKE_USER_DATA";

export type RamspaceDesktopFlavor =
  | "production"
  | "development"
  | "canary"
  | "cua"
  | "beta"
  | "remote";
export const RAMSPACE_PACKAGED_DESKTOP_FLAVORS = [
  "production",
  "canary",
  "cua",
  "beta",
  "remote",
] as const;
export type RamspacePackagedDesktopFlavor = (typeof RAMSPACE_PACKAGED_DESKTOP_FLAVORS)[number];

/**
 * electron-updater matches the update channel against the release tag's
 * prerelease identifier. Beta and Remote each follow their own lane;
 * neither may fall through to the Stable payload.
 *
 * The channel stays architecture-independent: electron-updater derives
 * `<channel>-linux[-arch]` (`ramspace-linux.yml` for x64, `ramspace-linux-arm64.yml`
 * for arm64), and the release pipeline publishes those names beside
 * electron-builder's `latest-linux[-arm64].yml`.
 */
export function desktopUpdateChannel(flavor: RamspaceDesktopFlavor): string {
  return flavor === "beta" || flavor === "remote" ? flavor : RAMSPACE_DESKTOP_UPDATE_CHANNEL;
}

export interface RamspaceDesktopIdentity {
  readonly flavor: RamspaceDesktopFlavor;
  readonly displayName: string;
  readonly bundleId: string;
  readonly scheme: string;
  readonly origin: string;
  readonly entryUrl: string;
  readonly userDataDirectoryName: string;
  readonly defaultHomeDirectoryName: string;
  /** Hosted account service for this flavor, unless the operator explicitly overrides it. */
  readonly defaultAccountUrl?: string;
  readonly usesScriptedUpdates: boolean;
}

export function resolveRamspaceDesktopFlavor(input: {
  readonly isDevelopment: boolean;
  readonly requestedFlavor?: string | undefined;
  readonly allowDevelopmentOverride?: boolean | undefined;
}): RamspaceDesktopFlavor {
  const requestedFlavor = input.requestedFlavor?.trim().toLowerCase();
  if (requestedFlavor === "cua") {
    return "cua";
  }
  if (requestedFlavor === "canary") {
    return "canary";
  }
  if (requestedFlavor === "beta" || requestedFlavor === "remote") {
    return requestedFlavor;
  }
  if (
    requestedFlavor === "development" &&
    (input.isDevelopment || input.allowDevelopmentOverride === true)
  ) {
    return "development";
  }
  return input.isDevelopment ? "development" : "production";
}

/** Packaged identity is fixed when the artifact is staged, before it is signed. */
export function resolveRamspaceDesktopRuntimeFlavor(input: {
  readonly isPackaged: boolean;
  readonly isDevelopment: boolean;
  readonly packagedFlavor?: unknown;
  readonly requestedFlavor?: string | undefined;
  readonly allowDevelopmentOverride?: boolean | undefined;
}): RamspaceDesktopFlavor {
  if (input.isPackaged && input.packagedFlavor !== undefined) {
    const flavor = input.packagedFlavor;
    if (
      flavor === "production" ||
      flavor === "canary" ||
      flavor === "cua" ||
      flavor === "beta" ||
      flavor === "remote"
    ) {
      return flavor;
    }
    throw new Error("The packaged Ramspace desktop flavor is invalid. Rebuild the application.");
  }
  // Source launchers also use an app bundle on macOS. Their build marker keeps
  // the existing environment-based routing, while legacy packaged apps remain
  // Stable even when a developer shell happens to export a different flavor.
  if (input.isPackaged && input.allowDevelopmentOverride !== true) {
    return "production";
  }
  return resolveRamspaceDesktopFlavor(input);
}

export function canOverrideDesktopSmokeUserData(input: {
  readonly packagedFlavor?: unknown;
  readonly sourceBuildMarker?: string | undefined;
}): boolean {
  return (
    input.packagedFlavor === "cua" ||
    input.packagedFlavor === "beta" ||
    input.packagedFlavor === "remote" ||
    (input.packagedFlavor === undefined &&
      input.sourceBuildMarker === RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER)
  );
}

export function ramspaceDesktopIdentity(flavor: RamspaceDesktopFlavor): RamspaceDesktopIdentity {
  if (flavor === "cua") {
    return {
      flavor,
      displayName: "Ramspace Cua",
      bundleId: RAMSPACE_CUA_BUNDLE_ID,
      scheme: RAMSPACE_CUA_DESKTOP_SCHEME,
      origin: RAMSPACE_CUA_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_CUA_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-cua",
      defaultHomeDirectoryName: ".ramspace-cua",
      usesScriptedUpdates: true,
    };
  }
  if (flavor === "canary") {
    return {
      flavor,
      displayName: "Ramspace Canary",
      bundleId: RAMSPACE_CANARY_BUNDLE_ID,
      scheme: RAMSPACE_CANARY_DESKTOP_SCHEME,
      origin: RAMSPACE_CANARY_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_CANARY_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-canary",
      defaultHomeDirectoryName: ".ramspace-canary",
      usesScriptedUpdates: true,
    };
  }
  if (flavor === "beta") {
    return {
      flavor,
      displayName: "Ramspace Beta",
      bundleId: RAMSPACE_BETA_BUNDLE_ID,
      scheme: RAMSPACE_BETA_DESKTOP_SCHEME,
      origin: RAMSPACE_BETA_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_BETA_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-beta",
      defaultHomeDirectoryName: ".ramspace-beta",
      usesScriptedUpdates: false,
    };
  }
  if (flavor === "remote") {
    return {
      flavor,
      displayName: "Ramspace Remote",
      bundleId: RAMSPACE_REMOTE_BUNDLE_ID,
      scheme: RAMSPACE_REMOTE_DESKTOP_SCHEME,
      origin: RAMSPACE_REMOTE_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_REMOTE_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-remote",
      defaultHomeDirectoryName: ".ramspace-remote",
      defaultAccountUrl: "https://ramspace-account-api-trial.ramspace-orgs.workers.dev",
      usesScriptedUpdates: false,
    };
  }
  if (flavor === "development") {
    return {
      flavor,
      displayName: "Ramspace (Dev)",
      bundleId: RAMSPACE_DEVELOPMENT_BUNDLE_ID,
      scheme: RAMSPACE_DESKTOP_SCHEME,
      origin: RAMSPACE_DESKTOP_ORIGIN,
      entryUrl: RAMSPACE_DESKTOP_ENTRY_URL,
      userDataDirectoryName: "ramspace-dev",
      defaultHomeDirectoryName: ".ramspace-dev",
      usesScriptedUpdates: false,
    };
  }
  return {
    flavor,
    displayName: "Ramspace",
    bundleId: RAMSPACE_PRODUCTION_BUNDLE_ID,
    scheme: RAMSPACE_DESKTOP_SCHEME,
    origin: RAMSPACE_DESKTOP_ORIGIN,
    entryUrl: RAMSPACE_DESKTOP_ENTRY_URL,
    userDataDirectoryName: "ramspace",
    defaultHomeDirectoryName: ".ramspace",
    usesScriptedUpdates: false,
  };
}

/**
 * Source launches run an ad-hoc signed Electron copy. Sharing an installed
 * release's identifier makes macOS check that release's privacy grants against
 * the wrong signature, and the launcher's re-sign reset clears them, so source
 * copies of the separately installed Beta and Remote apps get their own.
 */
export function ramspaceSourceDesktopIdentity(
  identity: RamspaceDesktopIdentity,
): RamspaceDesktopIdentity {
  if (identity.flavor !== "beta" && identity.flavor !== "remote") return identity;
  return {
    ...identity,
    displayName: `${identity.displayName} (Source)`,
    bundleId: `${identity.bundleId}.source`,
  };
}
