import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  RAMSPACE_DESKTOP_SMOKE_USER_DATA_ENV,
  RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
} from "@ramspace/shared/desktopIdentity";
import { spawnSourceDesktop } from "./source-desktop-launch.mjs";

function captureSourceDesktopSpawn(environment, overrides = {}) {
  const child = { on: vi.fn() };
  const spawnProcess = vi.fn(() => child);

  const result = spawnSourceDesktop({
    desktopDirectory: "/workspace/apps/desktop",
    electronPath: "/runtime/electron",
    environment,
    homeDirectory: "/Users/tester",
    platform: "darwin",
    readBuiltMain: () => RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
    spawnProcess,
    ...overrides,
  });

  return { child, result, spawnProcess };
}

describe("source desktop launch", () => {
  it("launches normal macOS starts through LaunchServices without secrets in argv", () => {
    const { spawnProcess } = captureSourceDesktopSpawn(
      {
        RAMSPACE_HOME: "/tmp/isolated",
        RAMSPACE_AUTH_TOKEN: "synthetic-secret",
        ELECTRON_RUN_AS_NODE: "1",
      },
      { electronPath: "/runtime/Ramspace (Dev).app/Contents/MacOS/Electron", launchViaMacOS: true },
    );
    expect(spawnProcess).toHaveBeenCalledWith(
      "/usr/bin/open",
      [
        "-W",
        "-n",
        "-a",
        "/runtime/Ramspace (Dev).app",
        "--args",
        "/workspace/apps/desktop/dist-electron/main.js",
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          RAMSPACE_HOME: "/tmp/isolated",
          RAMSPACE_AUTH_TOKEN: "synthetic-secret",
        }),
      }),
    );
    expect(spawnProcess.mock.calls[0][2].env).not.toHaveProperty("ELECTRON_RUN_AS_NODE");
    expect(JSON.stringify(spawnProcess.mock.calls[0][1])).not.toContain("synthetic-secret");
  });

  it.each([
    { platform: "linux", electronPath: "/runtime/Ramspace.app/Contents/MacOS/Electron" },
    { platform: "darwin", electronPath: "/runtime/electron" },
  ])("rejects an invalid LaunchServices target before spawning", (overrides) => {
    expect(() => captureSourceDesktopSpawn({}, { ...overrides, launchViaMacOS: true })).toThrow(
      "macOS application bundle",
    );
  });

  it("spawns current source builds with an isolated development environment", () => {
    const environment = {
      ELECTRON_RUN_AS_NODE: "1",
      PATH: "/usr/bin",
    };

    const { child, result, spawnProcess } = captureSourceDesktopSpawn(environment);

    expect(result).toBe(child);
    expect(spawnProcess).toHaveBeenCalledWith("/runtime/electron", ["dist-electron/main.js"], {
      cwd: "/workspace/apps/desktop",
      env: {
        PATH: "/usr/bin",
        RAMSPACE_DESKTOP_FLAVOR: "development",
        RAMSPACE_HOME: join("/Users/tester", ".ramspace-dev"),
        RAMSPACE_SOURCE_DESKTOP_BUILD_MARKER,
      },
      stdio: "inherit",
    });
    expect(environment).toEqual({
      ELECTRON_RUN_AS_NODE: "1",
      PATH: "/usr/bin",
    });
  });

  it("preserves an explicit Ramspace home", () => {
    const readWindowsEnvironment = vi.fn(() => ({
      RAMSPACE_HOME: "C:\\Users\\tester\\persisted-ramspace-home",
    }));
    const { spawnProcess } = captureSourceDesktopSpawn(
      { RAMSPACE_HOME: "/tmp/custom-ramspace-home" },
      { platform: "win32", readWindowsEnvironment },
    );

    expect(spawnProcess.mock.calls[0][2].env).toMatchObject({
      RAMSPACE_DESKTOP_FLAVOR: "development",
      RAMSPACE_HOME: "/tmp/custom-ramspace-home",
    });
    expect(readWindowsEnvironment).not.toHaveBeenCalled();
  });

  it("preserves a persisted Windows Ramspace home", () => {
    const { spawnProcess } = captureSourceDesktopSpawn(
      {},
      {
        platform: "win32",
        readWindowsEnvironment: () => ({
          Ramspace_Home: "C:\\Users\\tester\\persisted-ramspace-home",
        }),
      },
    );

    expect(spawnProcess.mock.calls[0][2].env.RAMSPACE_HOME).toBe(
      "C:\\Users\\tester\\persisted-ramspace-home",
    );
  });

  it("preserves Canary flavor and storage defaults", () => {
    const { spawnProcess } = captureSourceDesktopSpawn({
      RAMSPACE_DESKTOP_FLAVOR: "canary",
    });

    expect(spawnProcess.mock.calls[0][2].env).toMatchObject({
      RAMSPACE_DESKTOP_FLAVOR: "canary",
      RAMSPACE_HOME: join("/Users/tester", ".ramspace-canary"),
    });
  });

  it.each([undefined, "/tmp/custom-remote"])(
    "isolates Remote from inherited Stable and Beta homes (%s)",
    (remoteHome) => {
      const { spawnProcess } = captureSourceDesktopSpawn({
        RAMSPACE_DESKTOP_FLAVOR: "remote",
        RAMSPACE_HOME: "/tmp/stable-data",
        RAMSPACE_BETA_HOME: "/tmp/beta-data",
        ...(remoteHome ? { RAMSPACE_REMOTE_HOME: remoteHome } : {}),
      });
      const expectedHome = remoteHome ?? join("/Users/tester", ".ramspace-remote");
      expect(spawnProcess.mock.calls[0][2].env).toMatchObject({
        RAMSPACE_DESKTOP_FLAVOR: "remote",
        RAMSPACE_HOME: expectedHome,
        RAMSPACE_REMOTE_HOME: expectedHome,
      });
    },
  );

  it("guards and spawns the smoke desktop with its isolated environment", () => {
    const smokeHome = "/tmp/ramspace-desktop-smoke";
    const smokeUserData = join(smokeHome, "electron-user-data");
    const stdio = ["pipe", "pipe", "pipe"];
    const { spawnProcess } = captureSourceDesktopSpawn(
      {
        RAMSPACE_HOME: smokeHome,
        [RAMSPACE_DESKTOP_SMOKE_USER_DATA_ENV]: smokeUserData,
      },
      { stdio },
    );

    expect(spawnProcess.mock.calls[0][2].env).toMatchObject({
      RAMSPACE_HOME: smokeHome,
      [RAMSPACE_DESKTOP_SMOKE_USER_DATA_ENV]: smokeUserData,
    });
    expect(spawnProcess.mock.calls[0][2].stdio).toBe(stdio);
  });

  it("rejects stale built desktop output before spawning Electron", () => {
    const spawnProcess = vi.fn();

    expect(() =>
      spawnSourceDesktop({
        desktopDirectory: "/workspace/apps/desktop",
        electronPath: "/runtime/electron",
        environment: {},
        homeDirectory: "/Users/tester",
        platform: "darwin",
        readBuiltMain: () => "stale desktop output",
        spawnProcess,
      }),
    ).toThrow(/desktop build is stale/i);
    expect(spawnProcess).not.toHaveBeenCalled();
  });
});
