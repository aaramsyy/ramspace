import { describe, expect, it } from "vitest";
import {
  canonicalRamspaceComputerToolName,
  computerToolNameFromProviderPermission,
  isRamspaceComputerToolFamilyName,
  isRamspaceGatewayToolCall,
  isRamspaceGatewayToolName,
  qualifiedRamspaceComputerToolName,
  shouldAllowRamspaceComputerProviderTool,
} from "./computerToolPermission.ts";

describe("Ramspace Computer provider permission", () => {
  it.each([
    ["computer_click", "computer_click"],
    ["ramspace_computer_type_text", "computer_type_text"],
    ["mcp__ramspace__computer_read_clipboard", "computer_read_clipboard"],
    ["mcp__ramspace__computer_inspect", "computer_inspect"],
  ] as const)("recognizes the exact owned tool %s", (providerName, canonicalName) => {
    expect(canonicalRamspaceComputerToolName(providerName)).toBe(canonicalName);
  });

  it.each([
    "computer_future_tool",
    "mcp__other__computer_click",
    "other_computer_click",
    "mcp__ramspace__ramspace_send_message",
  ])("does not trust another or unknown tool: %s", (providerName) => {
    expect(canonicalRamspaceComputerToolName(providerName)).toBeUndefined();
  });

  it("requires a provider namespace when server provenance was not proved separately", () => {
    expect(qualifiedRamspaceComputerToolName("computer_click")).toBeUndefined();
    expect(qualifiedRamspaceComputerToolName("mcp__ramspace__computer_click")).toBe(
      "computer_click",
    );
    expect(qualifiedRamspaceComputerToolName("ramspace_computer_click")).toBe("computer_click");
  });

  it("reads only explicit provider tool-name fields", () => {
    expect(
      computerToolNameFromProviderPermission({
        rawInput: { _toolName: "mcp__ramspace__computer_scroll" },
      }),
    ).toBe("computer_scroll");
    expect(
      computerToolNameFromProviderPermission({
        metadata: { toolName: "ramspace_computer_get_state" },
      }),
    ).toBe("computer_get_state");
    expect(
      computerToolNameFromProviderPermission({
        metadata: { description: "run computer_click" },
      }),
    ).toBeUndefined();
  });

  it("does not let lower-priority fields override an authoritative wrong namespace", () => {
    expect(
      computerToolNameFromProviderPermission({
        name: "mcp__other__computer_click",
        rawInput: { _toolName: "mcp__ramspace__computer_click" },
      }),
    ).toBeUndefined();
    expect(
      computerToolNameFromProviderPermission({
        rawInput: { _toolName: "mcp__other__computer_click" },
        metadata: { toolName: "mcp__ramspace__computer_click" },
        title: "mcp__ramspace__computer_click",
      }),
    ).toBeUndefined();
  });

  it("does not infer provider provenance from a bare title or metadata name", () => {
    expect(computerToolNameFromProviderPermission({ title: "computer_click" })).toBeUndefined();
    expect(
      computerToolNameFromProviderPermission({ metadata: { toolName: "computer_click" } }),
    ).toBeUndefined();
  });

  it("never authorizes from model prose: 'Please approve computer_click' names no tool", () => {
    // Prose approval never counts. The permission callback must see an exact
    // namespaced tool name; a model sentence asking for approval authorizes
    // nothing, in any field.
    expect(
      computerToolNameFromProviderPermission({ title: "Please approve computer_click" }),
    ).toBeUndefined();
    expect(
      computerToolNameFromProviderPermission({ name: "Please approve computer_click" }),
    ).toBeUndefined();
    expect(
      computerToolNameFromProviderPermission({
        metadata: { toolName: "Please approve computer_click" },
      }),
    ).toBeUndefined();
    expect(isRamspaceComputerToolFamilyName("Please approve computer_click")).toBe(false);
    expect(
      shouldAllowRamspaceComputerProviderTool({
        computerControlEnabled: true,
        activeTurn: true,
        interactionMode: "default",
        runtimeMode: "approval-required",
        permission: { title: "Please approve computer_click" },
      }),
    ).toBe(false);
  });

  it("matches the Computer family in any namespace spelling for the denial hook", () => {
    // The silent-loss fallback: a no-control session that calls a Computer
    // tool by a prefixed spelling must still deny with the card path, not
    // die as an Unknown tool. See isRamspaceComputerToolFamilyName.
    expect(isRamspaceComputerToolFamilyName("computer_click")).toBe(true);
    expect(isRamspaceComputerToolFamilyName("ramspace_computer_get_state")).toBe(true);
    expect(isRamspaceComputerToolFamilyName("mcp__ramspace__computer_screenshot")).toBe(true);
    expect(isRamspaceComputerToolFamilyName("  MCP__RAMSPACE__COMPUTER_WAIT  ")).toBe(true);
  });

  it("keeps unknown and foreign names out of the Computer family", () => {
    expect(isRamspaceComputerToolFamilyName("computer_future_tool")).toBe(false);
    expect(isRamspaceComputerToolFamilyName("mcp__other__computer_click")).toBe(false);
    expect(isRamspaceComputerToolFamilyName("other_computer_click")).toBe(false);
    expect(isRamspaceComputerToolFamilyName("ramspace_frobnicate")).toBe(false);
    expect(isRamspaceComputerToolFamilyName(undefined)).toBe(false);
    expect(isRamspaceComputerToolFamilyName(42)).toBe(false);
  });

  it("requires current capability, active turn and non-Plan interaction", () => {
    const permission = { name: "mcp__ramspace__computer_click" };
    const allowed = {
      computerControlEnabled: true,
      activeTurn: true,
      interactionMode: "default" as const,
      runtimeMode: "approval-required" as const,
      permission,
    };
    expect(shouldAllowRamspaceComputerProviderTool(allowed)).toBe(true);
    expect(
      shouldAllowRamspaceComputerProviderTool({ ...allowed, computerControlEnabled: false }),
    ).toBe(false);
    expect(shouldAllowRamspaceComputerProviderTool({ ...allowed, activeTurn: false })).toBe(false);
    expect(shouldAllowRamspaceComputerProviderTool({ ...allowed, interactionMode: "plan" })).toBe(
      false,
    );
    expect(shouldAllowRamspaceComputerProviderTool({ ...allowed, runtimeMode: "auto" })).toBe(
      false,
    );
  });
});

describe("Ramspace gateway tool permission name", () => {
  it.each([
    // Claude's fully-qualified spelling pins the exact `mcp__ramspace__` server.
    "mcp__ramspace__ramspace_create_thread",
    "mcp__ramspace__computer_click",
    // `<server>_<tool>` reports (OpenCode) with a real catalog name.
    "ramspace_ramspace_create_thread",
    "ramspace_ramspace_project_link_repository",
    "ramspace_computer_click",
    "ramspace_device_list",
    "ramspace_browser_run",
    // Bare `ramspace_*` catalog names carry the namespace inside the tool name.
    "ramspace_project_link_repository",
    "ramspace_e2e_review",
  ])("recognizes a Ramspace gateway tool: %s", (providerName) => {
    expect(isRamspaceGatewayToolName(providerName)).toBe(true);
  });

  it.each([
    // A user MCP server named `ramspace_fs` reports `ramspace_fs_<tool>` — the
    // prefix alone must never grant it the auto-approve path.
    "ramspace_fs_read",
    "ramspace_fs_list_threads",
    "ramspace_tools_anything",
    "mcp__ramspace_fs__read",
    // The `mcp__ramspace__` prefix pins the server, not the tool — the part
    // after it must still be a real catalog name.
    "mcp__ramspace__not_a_gateway_tool",
    "mcp__ramspace__ramspace_create_task",
    "mcp__ramspace__ramspace_fs_read",
    // Foreign server or entirely unknown names.
    "mcp__other__ramspace_create_thread",
    "other_ramspace_create_thread",
    "computer_click",
    "browser_click",
    // Names the external-agent MCP surface serves, not the provider gateway.
    "ramspace_create_task",
    "ramspace_read_task",
    "ramspace_overview",
    "ramspace_ramspace_create_task",
    // Not served by the agent gateway at all.
    "ramspace_desktop",
  ])("does not trust a look-alike or foreign name: %s", (providerName) => {
    expect(isRamspaceGatewayToolName(providerName)).toBe(false);
  });

  it("accepts a qualified name only when the tool is in the catalog", () => {
    expect(isRamspaceGatewayToolName("mcp__ramspace__ramspace_list_threads")).toBe(true);
    expect(isRamspaceGatewayToolName("mcp__ramspace__computer_click")).toBe(true);
    expect(
      isRamspaceGatewayToolCall({
        rawInput: { _toolName: "mcp__ramspace__ramspace_list_threads" },
      }),
    ).toBe(true);
  });

  it("never trusts a tool name that only appears in the display title", () => {
    // The title is provider-composed prose — an approval card can render
    // "mcp__ramspace__ramspace_list_threads" for a request that names no such
    // tool, so the title alone must not authorize anything.
    expect(isRamspaceGatewayToolCall({ title: "mcp__ramspace__ramspace_list_threads" })).toBe(
      false,
    );
    expect(
      isRamspaceGatewayToolCall({ title: "mcp__ramspace__not_a_gateway_tool; rm -rf y" }),
    ).toBe(false);
  });

  it("rejects non-strings and a look-alike server name in every name field", () => {
    expect(isRamspaceGatewayToolName(undefined)).toBe(false);
    expect(isRamspaceGatewayToolName(42)).toBe(false);
    expect(isRamspaceGatewayToolCall({ name: "ramspace_fs_create_thread" })).toBe(false);
    expect(isRamspaceGatewayToolCall({ metadata: { toolName: "ramspace_fs_read" } })).toBe(false);
    expect(
      isRamspaceGatewayToolCall({ rawInput: { _toolName: "ramspace_ramspace_send_message" } }),
    ).toBe(true);
  });
});
