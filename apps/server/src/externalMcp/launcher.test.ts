import { afterEach, describe, expect, it } from "vitest";

import { externalMcpLauncher, externalMcpShellCommand } from "./launcher.ts";

const originalServerEntry = process.env.RAMSPACE_SERVER_ENTRY;
const originalElectronNodeMode = process.env.ELECTRON_RUN_AS_NODE;

afterEach(() => {
  if (originalServerEntry === undefined) delete process.env.RAMSPACE_SERVER_ENTRY;
  else process.env.RAMSPACE_SERVER_ENTRY = originalServerEntry;
  if (originalElectronNodeMode === undefined) delete process.env.ELECTRON_RUN_AS_NODE;
  else process.env.ELECTRON_RUN_AS_NODE = originalElectronNodeMode;
});

describe("external MCP launcher", () => {
  it("uses the packaged backend entry instead of assuming a global ramspace command", () => {
    process.env.RAMSPACE_SERVER_ENTRY =
      "/Applications/Ramspace.app/Contents/Resources/server/index.js";
    process.env.ELECTRON_RUN_AS_NODE = "1";
    const launcher = externalMcpLauncher(["mcp", "serve", "--integration", "integration-1"]);

    expect(launcher).toEqual({
      command: process.execPath,
      args: [
        "/Applications/Ramspace.app/Contents/Resources/server/index.js",
        "mcp",
        "serve",
        "--integration",
        "integration-1",
      ],
      env: { ELECTRON_RUN_AS_NODE: "1" },
    });
    expect(externalMcpShellCommand(launcher)).toContain("ELECTRON_RUN_AS_NODE='1'");
    expect(externalMcpShellCommand(launcher)).not.toContain("ramspace mcp serve");
  });

  it("renders a valid PowerShell command on Windows", () => {
    expect(
      externalMcpShellCommand(
        {
          command: "C:\\Program Files\\Ramspace\\Ramspace.exe",
          args: ["mcp", "serve", "--home-dir", "C:\\Ramspace home"],
          env: { ELECTRON_RUN_AS_NODE: "1" },
        },
        "win32",
      ),
    ).toBe(
      "$env:ELECTRON_RUN_AS_NODE = '1'; & 'C:\\Program Files\\Ramspace\\Ramspace.exe' 'mcp' 'serve' '--home-dir' 'C:\\Ramspace home'",
    );
  });
});
