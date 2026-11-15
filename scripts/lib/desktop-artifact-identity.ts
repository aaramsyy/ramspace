// FILE: desktop-artifact-identity.ts
// Purpose: Keeps packaged metadata, native identity and artifact names aligned.
import {
  ramspaceDesktopIdentity,
  type RamspacePackagedDesktopFlavor,
} from "@ramspace/shared/desktopIdentity";

export function createDesktopArtifactIdentity(input: {
  readonly platform: "mac" | "linux" | "win";
  readonly flavor: RamspacePackagedDesktopFlavor;
}) {
  // Stable's NSIS GUID deliberately survives public bundle ID changes. An
  // experimental installer must not register itself as that same product;
  // Beta and Remote have their own installer GUIDs.
  if (input.platform === "win" && !["production", "beta", "remote"].includes(input.flavor)) {
    throw new Error("Isolated desktop flavors are currently supported on macOS and Linux only.");
  }
  const identity = ramspaceDesktopIdentity(input.flavor);
  const suffix = input.flavor === "production" ? "" : `-${input.flavor}`;
  return {
    identity,
    packageMetadata: {
      name: `ramspace-desktop${suffix}`,
      productName: identity.displayName,
      ramspaceDesktopFlavor: input.flavor,
    },
    buildConfig: {
      appId: identity.bundleId,
      productName: identity.displayName,
      artifactName: `${identity.displayName.replaceAll(" ", "-")}-\${version}-\${arch}.\${ext}`,
      ...(input.flavor !== "production"
        ? { protocols: [{ name: identity.displayName, schemes: [identity.scheme] }] }
        : {}),
    },
    releaseDirectoryName: `release${suffix}`,
  };
}
