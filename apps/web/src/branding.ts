// Renderer branding follows the packaged protocol defined by desktopIdentity.
import { RAMSPACE_REMOTE_DESKTOP_SCHEME } from "@ramspace/shared/desktopIdentity";

export const APP_BASE_NAME = "Ramspace";
const isCanaryDesktop =
  typeof window !== "undefined" && window.location?.protocol === "ramspace-canary:";
const isBetaDesktop =
  typeof window !== "undefined" && window.location?.protocol === "ramspace-beta:";
const isRemoteDesktop =
  typeof window !== "undefined" &&
  window.location?.protocol === `${RAMSPACE_REMOTE_DESKTOP_SCHEME}:`;
/** Ramspace Remote shares usage and diagnostics by default. */
export const IS_REMOTE_DESKTOP = isRemoteDesktop;
export const APP_DISPLAY_NAME = isRemoteDesktop
  ? "Ramspace Remote"
  : isCanaryDesktop
    ? "Ramspace Canary"
    : isBetaDesktop
      ? "Ramspace Beta"
      : import.meta.env.DEV
        ? `${APP_BASE_NAME} (Dev)`
        : APP_BASE_NAME;
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
