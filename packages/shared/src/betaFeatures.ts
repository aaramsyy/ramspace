// FILE: betaFeatures.ts
// Purpose: The single list of features that ship in Beta but not in Stable.
// Layer: Shared contracts (consumed by desktop main, server, and web UI)

import {
  RAMSPACE_BETA_BUNDLE_ID,
  RAMSPACE_CANARY_BUNDLE_ID,
  RAMSPACE_CUA_BUNDLE_ID,
  RAMSPACE_DEVELOPMENT_BUNDLE_ID,
  RAMSPACE_PRODUCTION_BUNDLE_ID,
  RAMSPACE_REMOTE_BUNDLE_ID,
  type RamspaceDesktopFlavor,
} from "@ramspace/shared/desktopIdentity";

/**
 * Features that ship only in non-Stable builds. Keep a feature out of Stable
 * by adding its key here; promote it by deleting the entry. A provider's key
 * is its ProviderKind. "groups" is Groups (below).
 */
export type BetaOnlyFeature = string;

/** Hubs (Stable and Beta): the coordinator, its threads, the Hub panel and Library. */
export const GROUPS_BETA_FEATURE = "groups";

/** Inbox (Stable and Beta): the Inbox page and its `stats.getRecap` RPC. */
export const INBOX_BETA_FEATURE = "inbox";

/**
 * Account-saved Inbox history (Stable and Beta): automatic private recap upload
 * to the account and the saved-recap RPCs.
 */
export const ACCOUNT_INBOX_BETA_FEATURE = "accountInbox";

/**
 * Audio trail (Stable and Beta): the chat message trail moves with the Mac's
 * audio output and/or the microphone, read by the AppSnap helper's `--audio-level` mode.
 */
export const AUDIO_TRAIL_BETA_FEATURE = "audio-trail";

/** Auto-fix CI (Stable and Beta): the PR menu checkbox, RPCs, and check watcher. */
export const PULL_REQUEST_AUTO_FIX_BETA_FEATURE = "pull-request-auto-fix";

/**
 * Inline visuals (Stable and Beta): the `ramspace_show_visual` agent tool,
 * component-spec and sandboxed HTML transcript rows, and the document read.
 */
export const INLINE_VISUALS_BETA_FEATURE = "inline-visuals";

/**
 * Connectors (Stable and Beta): remote MCP servers the user signs in to from
 * Settings, proxied to supported provider sessions through the agent gateway.
 */
export const MCP_CONNECTORS_BETA_FEATURE = "mcp-connectors";

/**
 * Native editor (Stable and Beta): the Code OSS engine behind file, diff and
 * preview editing, its TypeScript language service and JavaScript debugger.
 */
export const NATIVE_EDITOR_BETA_FEATURE = "native-editor";

export const BETA_ONLY_FEATURES: readonly BetaOnlyFeature[] = [];

/**
 * Whether a Beta-only feature is on for this host. Only the Stable
 * (production) desktop build turns them off: Beta, Remote, Cua, Canary, development
 * and non-desktop hosts (flavor "unknown") keep them.
 */
export function isBetaFeatureEnabled(
  feature: BetaOnlyFeature,
  flavor: RamspaceDesktopFlavor | "unknown",
): boolean {
  return !BETA_ONLY_FEATURES.includes(feature) || flavor !== "production";
}

/** Maps a desktop bundle id to its flavor; blank or unrecognized -> "unknown". */
export function desktopFlavorFromBundleId(
  bundleId: string | undefined,
): RamspaceDesktopFlavor | "unknown" {
  switch (bundleId?.trim()) {
    case RAMSPACE_PRODUCTION_BUNDLE_ID:
      return "production";
    case RAMSPACE_DEVELOPMENT_BUNDLE_ID:
      return "development";
    case RAMSPACE_CANARY_BUNDLE_ID:
      return "canary";
    case RAMSPACE_CUA_BUNDLE_ID:
      return "cua";
    case RAMSPACE_REMOTE_BUNDLE_ID:
      return "remote";
    case RAMSPACE_BETA_BUNDLE_ID:
      return "beta";
    default:
      return "unknown";
  }
}

/**
 * Maps the web app's own URL scheme to the hosting desktop's flavor. A Stable
 * build serves `ramspace:` pages; a development build serves the same scheme, so
 * the caller passes whether this is a dev build. Anything else (http, missing
 * window) is "unknown".
 */
export function desktopFlavorFromProtocol(
  protocol: string | undefined,
  isDevBuild: boolean,
): RamspaceDesktopFlavor | "unknown" {
  switch (protocol) {
    case "ramspace-remote:":
      return "remote";
    case "ramspace-beta:":
      return "beta";
    case "ramspace-canary:":
      return "canary";
    case "ramspace-cua:":
      return "cua";
    case "ramspace:":
      return isDevBuild ? "development" : "production";
    default:
      return "unknown";
  }
}

/** Deferred features retain their data but have no active consumers. */
export const HOST_SECRETS_SYNC_ENABLED = false;
