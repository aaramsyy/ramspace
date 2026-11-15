// FILE: toolCallLabel.ts
// Purpose: Normalizes generic tool-call titles and humanizes command executions for timeline rows.
// Layer: UI utility
// Exports: deriveReadableToolTitle, deriveReadableCommandDisplay, deriveFriendlyCommandTarget, command icon classifiers, deriveInlineCommandCall, deriveLiteralCommand, deriveCommandReadTargets, normalizeCompactToolLabel, isGenericToolTitle, extractWebFetchUrl
// Depends on: @ramspace/contracts tool lifecycle item types

import type { ToolLifecycleItemType } from "@ramspace/contracts";
import { t } from "~/i18n";
import { BROWSER_TOOL_TITLES } from "@ramspace/shared/browserAutomationPresentation";
import {
  COMPUTER_TOOL_TITLE_KEYS,
  computerToolName,
  type ComputerToolName,
} from "./computerToolPresentation";
import { basenameOfPath } from "../file-icons";
import { extractToolArgumentField } from "./toolArgumentSummary";

export function normalizeCompactToolLabel(value: string): string {
  return value
    .trimEnd()
    .replace(/\s(?:complete|completed|done|finished|success|succeeded|started|running)$/i, "")
    .trim();
}

// Canonical form for comparing tool display strings (heading vs preview vs
// label): ignores case, whitespace runs, and trailing status words so dedup
// decisions behave identically in the work-log builder and the timeline rows.
export function normalizeToolTextForComparison(value: string | undefined): string {
  return normalizeCompactToolLabel(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Web-fetch tool calls (e.g. Claude's `WebFetch`) arrive as generic dynamic tool
// calls whose detail is the raw `ToolName: {json}` argument summary. Recognizing
// them lets the timeline surface the target site (favicon + URL) instead of the
// raw JSON arguments.
const WEB_FETCH_TOOL_NAMES = new Set(["webfetch", "fetch", "urlfetch", "fetchurl", "httpfetch"]);

function isWebFetchToolName(toolName: string | null | undefined): boolean {
  if (!toolName) {
    return false;
  }
  const normalized = toolName.toLowerCase().replace(/[^a-z]/g, "");
  if (WEB_FETCH_TOOL_NAMES.has(normalized)) {
    return true;
  }
  return (
    normalized.includes("fetch") &&
    (normalized.includes("web") || normalized.includes("url") || normalized.includes("http"))
  );
}

// Pulls the first http(s) URL out of a web-fetch tool call's argument summary.
// Prefers the JSON `url`/`uri` field (the actual shape) and falls back to a bare
// URL token so a slightly different summary still resolves. Returns null for
// non-fetch tools or when no usable URL is present, so callers fall back to the
// generic tool-call rendering.
export function extractWebFetchUrl(input: {
  readonly toolName?: string | null | undefined;
  readonly detail?: string | null | undefined;
}): string | null {
  if (!isWebFetchToolName(input.toolName)) {
    return null;
  }
  const detail = input.detail;
  if (!detail) {
    return null;
  }
  const candidate =
    extractToolArgumentField(detail, ["url", "uri"]) ??
    /https?:\/\/[^\s"'<>)\]}]+/i.exec(detail)?.[0]?.replace(/[.,;:!?]+$/, "");
  if (candidate && /^https?:\/\//i.test(candidate)) {
    return candidate;
  }
  return null;
}

// Turns internal MCP identifiers into readable inline labels for timeline rows.
function humanizeMcpToolIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("mcp__")) {
    return null;
  }

  const [, server, tool, ...rest] = trimmed.split("__");
  const normalizedServer = humanizeMcpToken(server);
  const normalizedTool = [tool, ...rest]
    .map((part) => humanizeMcpToken(part))
    .filter((part) => part.length > 0)
    .join(" ");

  if (!normalizedServer || !normalizedTool) {
    return null;
  }
  return `${normalizedServer}: ${normalizedTool}`;
}

function humanizeMcpServerTool(server: string, tool: string): string | null {
  const normalizedServer = humanizeMcpToken(server);
  const normalizedTool = humanizeMcpToken(tool);
  if (!normalizedServer || !normalizedTool) {
    return null;
  }
  return `${normalizedServer}: ${normalizedTool}`;
}

export interface ReadableToolTitleInput {
  readonly title?: string | null;
  readonly fallbackLabel: string;
  readonly itemType?: ToolLifecycleItemType | undefined;
  readonly requestKind?:
    | "command"
    | "file-read"
    | "file-change"
    | "permissions"
    | "tool"
    | undefined;
  readonly command?: string | null;
  readonly payload?: Record<string, unknown> | null;
  readonly isRunning?: boolean;
}

interface RamspaceMcpToolSourcePresentation {
  readonly running: string;
  readonly completed: string;
  readonly failed: string;
}

type RamspaceMcpToolPresentation = Readonly<Record<RamspaceMcpToolStatus, string>>;

// Historical messages still contain retired tools; presentation does not expose them to agents.
const BROWSER_HISTORY_TITLES = {
  ...BROWSER_TOOL_TITLES,
  browser_snapshot: "Snapshot browser page",
  browser_webmcp_tools: "Discover page WebMCP tools",
  browser_webmcp_call: "Call page WebMCP tool",
  browser_click: "Click browser target",
  browser_hover: "Hover browser target",
  browser_drag: "Drag between browser targets",
  browser_type: "Type into browser target",
  browser_select: "Select browser options",
  browser_press: "Press browser keys",
  browser_scroll: "Scroll browser page",
  browser_wait: "Wait for browser condition",
  browser_evaluate: "Evaluate browser expression",
} as const;
type BrowserHistoryToolName = keyof typeof BROWSER_HISTORY_TITLES;
type RamspaceBrowserToolName = `ramspace_${BrowserHistoryToolName}`;
const BROWSER_HISTORY_TOOL_NAMES = Object.keys(BROWSER_HISTORY_TITLES) as BrowserHistoryToolName[];
const BROWSER_TOOL_NAME_SET = new Set<string>(BROWSER_HISTORY_TOOL_NAMES);

const RAMSPACE_BROWSER_TOOL_PRESENTATIONS = Object.fromEntries(
  BROWSER_HISTORY_TOOL_NAMES.map((toolName) => {
    const title = BROWSER_HISTORY_TITLES[toolName];
    return [`ramspace_${toolName}`, { running: title, completed: title, failed: title }];
  }),
) as Record<RamspaceBrowserToolName, RamspaceMcpToolSourcePresentation>;

/**
 * The desktop tools, spoken. Every browser tool had a curated presentation and
 * every computer tool had none, so the most consequential rows in the
 * transcript — an agent moving a pointer on the user's own machine — fell
 * through to the invented "Ramspace is handling computer click" fallback.
 *
 * The wording deliberately keeps the machine in the sentence ("this computer's
 * desktop") rather than saying "the desktop", because on the backends that
 * matter it is the user's own.
 */
const RAMSPACE_COMPUTER_TOOL_PRESENTATIONS = {
  ramspace_computer_screenshot: presentComputerTool("taking a screenshot", "took a screenshot"),
  ramspace_computer_get_state: presentComputerTool("reading the screen", "read the screen"),
  ramspace_computer_get_screen_size: presentComputerTool(
    "measuring the screen",
    "measured the screen",
  ),
  ramspace_computer_list_windows: presentComputerTool("listing windows", "listed the windows"),
  ramspace_computer_list_apps: presentComputerTool("listing apps", "listed the apps"),
  ramspace_computer_verify_state: presentComputerTool(
    "checking desktop state",
    "checked desktop state",
  ),
  ramspace_computer_zoom: presentComputerTool("zooming into a window", "zoomed into a window"),
  ramspace_computer_get_accessibility_tree: presentComputerTool(
    "listing apps and windows",
    "listed apps and windows",
  ),
  ramspace_computer_get_cursor_position: presentComputerTool(
    "reading the cursor position",
    "read the cursor position",
  ),
  ramspace_computer_help: presentComputerTool(
    "reading the Computer playbook",
    "read the Computer playbook",
  ),
  ramspace_computer_click: presentComputerTool("clicking the desktop", "clicked the desktop"),
  ramspace_computer_move_cursor: presentComputerTool("moving the cursor", "moved the cursor"),
  ramspace_computer_drag: presentComputerTool("dragging on the desktop", "dragged on the desktop"),
  ramspace_computer_scroll: presentComputerTool("scrolling the desktop", "scrolled the desktop"),
  ramspace_computer_type_text: presentComputerTool("typing on the desktop", "typed on the desktop"),
  ramspace_computer_press_key: presentComputerTool("pressing a key", "pressed a key"),
  ramspace_computer_set_value: presentComputerTool("setting a field", "set a field"),
  ramspace_computer_select_text: presentComputerTool("selecting text", "selected text"),
  ramspace_computer_perform_action: presentComputerTool(
    "activating a control",
    "activated a control",
  ),
  ramspace_computer_launch_app: presentComputerTool("opening an app", "opened an app"),
  ramspace_computer_activate_window: presentComputerTool(
    "activating a window",
    "activated a window",
  ),
  ramspace_computer_set_window_frame: presentComputerTool(
    "moving or resizing a window",
    "moved or resized a window",
  ),
  ramspace_computer_invoke_menu: presentComputerTool("invoking a menu item", "invoked a menu item"),
  ramspace_computer_kill_app: presentComputerTool("force-quitting an app", "force-quit an app"),
  ramspace_computer_set_window_minimized: presentComputerTool(
    "changing a window's visibility",
    "changed a window's visibility",
  ),
  ramspace_computer_set_app_visibility: presentComputerTool(
    "changing an app's visibility",
    "changed an app's visibility",
  ),
  ramspace_computer_wait: presentComputerTool("waiting for the desktop", "waited for the desktop"),
  ramspace_computer_read_clipboard: presentComputerTool(
    "reading the clipboard",
    "read the clipboard",
  ),
  ramspace_computer_write_clipboard: presentComputerTool(
    "writing to the clipboard",
    "wrote to the clipboard",
  ),
  ramspace_computer_paste: presentComputerTool("pasting text", "pasted text"),
  ramspace_computer_run: presentComputerTool(
    "running a desktop sequence",
    "ran a desktop sequence",
  ),
  ramspace_computer_inspect: presentComputerTool(
    "inspecting the computer",
    "inspected the computer",
  ),
  ramspace_computer_spaces: presentComputerTool(
    "inspecting desktop Spaces",
    "inspected desktop Spaces",
  ),
  ramspace_computer_browser_state: presentComputerTool(
    "reading the browser page",
    "read the browser page",
  ),
  ramspace_computer_browser_prepare: presentComputerTool(
    "preparing a browser",
    "prepared a browser",
  ),
  ramspace_computer_browser_navigate: presentComputerTool(
    "opening a browser page",
    "opened a browser page",
  ),
  ramspace_computer_browser_click: presentComputerTool(
    "clicking in the browser",
    "clicked in the browser",
  ),
  ramspace_computer_browser_type: presentComputerTool(
    "typing in a browser field",
    "typed in a browser field",
  ),
  ramspace_computer_browser_dialog: presentComputerTool(
    "handling a browser dialog",
    "handled a browser dialog",
  ),
  ramspace_computer_browser_upload: presentComputerTool(
    "attaching files in the browser",
    "attached files in the browser",
  ),
  ramspace_computer_browser_download: presentComputerTool(
    "downloading a file",
    "downloaded a file",
  ),
  ramspace_computer_browser_pointer: presentComputerTool(
    "using the pointer in the browser",
    "used the pointer in the browser",
  ),
  ramspace_computer_browser_press: presentComputerTool(
    "pressing Enter in the browser",
    "pressed Enter in the browser",
  ),
} as const satisfies Record<`ramspace_${ComputerToolName}`, RamspaceMcpToolSourcePresentation>;

function presentComputerTool(present: string, past: string): RamspaceMcpToolSourcePresentation {
  return {
    running: `Ramspace is ${present}`,
    completed: `Ramspace ${past}`,
    failed: `Ramspace couldn't finish ${present}`,
  };
}

const RAMSPACE_MCP_TOOL_PRESENTATIONS = {
  ramspace_context: {
    running: "Ramspace is checking its context",
    completed: "Ramspace checked its context",
    failed: "Ramspace couldn't check its context",
  },
  ramspace_capabilities: {
    running: "Ramspace is checking available agents",
    completed: "Ramspace checked available agents",
    failed: "Ramspace couldn't check available agents",
  },
  ramspace_overview: {
    running: "Ramspace is gathering an overview",
    completed: "Ramspace gathered an overview",
    failed: "Ramspace couldn't gather an overview",
  },
  ramspace_list_allowed_projects: {
    running: "Ramspace is listing allowed projects",
    completed: "Ramspace listed allowed projects",
    failed: "Ramspace couldn't list allowed projects",
  },
  ramspace_create_task: {
    running: "Ramspace is creating a task",
    completed: "Ramspace created a task",
    failed: "Ramspace couldn't create a task",
  },
  ramspace_wait_for_task: {
    running: "Ramspace is waiting for a task",
    completed: "Ramspace finished waiting for a task",
    failed: "Ramspace couldn't wait for a task",
  },
  ramspace_read_task: {
    running: "Ramspace is reading a task",
    completed: "Ramspace read a task",
    failed: "Ramspace couldn't read a task",
  },
  ramspace_list_projects: {
    running: "Ramspace is listing projects",
    completed: "Ramspace listed projects",
    failed: "Ramspace couldn't list projects",
  },
  ramspace_list_threads: {
    running: "Ramspace is listing threads",
    completed: "Ramspace listed threads",
    failed: "Ramspace couldn't list threads",
  },
  ramspace_read_thread: {
    running: "Ramspace is reading a thread",
    completed: "Ramspace read a thread",
    failed: "Ramspace couldn't read a thread",
  },
  ramspace_read_thread_activity: {
    running: "Ramspace is reading thread activity",
    completed: "Ramspace read thread activity",
    failed: "Ramspace couldn't read thread activity",
  },
  ramspace_read_thread_events: {
    running: "Ramspace is reading thread events",
    completed: "Ramspace read thread events",
    failed: "Ramspace couldn't read thread events",
  },
  ramspace_read_thread_runtime_events: {
    running: "Ramspace is reading thread runtime events",
    completed: "Ramspace read thread runtime events",
    failed: "Ramspace couldn't read thread runtime events",
  },
  ramspace_diagnose_thread: {
    running: "Ramspace is diagnosing a thread",
    completed: "Ramspace diagnosed a thread",
    failed: "Ramspace couldn't diagnose a thread",
  },
  ramspace_create_thread: {
    running: "Ramspace is creating a thread",
    completed: "Ramspace created a thread",
    failed: "Ramspace couldn't create a thread",
  },
  ramspace_create_threads: {
    running: "Ramspace is creating threads",
    completed: "Ramspace created threads",
    failed: "Ramspace couldn't create threads",
  },
  ramspace_wait_for_threads: {
    running: "Ramspace is waiting for threads",
    completed: "Ramspace finished waiting for threads",
    failed: "Ramspace couldn't wait for threads",
  },
  ramspace_send_message: {
    running: "Ramspace is sending a message",
    completed: "Ramspace sent a message",
    failed: "Ramspace couldn't send a message",
  },
  ramspace_read_kanban_board: {
    running: "Ramspace is reading the board",
    completed: "Ramspace read the board",
    failed: "Ramspace couldn't read the board",
  },
  ramspace_read_kanban_card: {
    running: "Ramspace is reading a board card",
    completed: "Ramspace read a board card",
    failed: "Ramspace couldn't read a board card",
  },
  ramspace_create_kanban_task: {
    running: "Ramspace is creating a board task",
    completed: "Ramspace created a board task",
    failed: "Ramspace couldn't create a board task",
  },
  ramspace_move_kanban_card: {
    running: "Ramspace is moving a board card",
    completed: "Ramspace moved a board card",
    failed: "Ramspace couldn't move a board card",
  },
  ramspace_show_visual: {
    running: "Ramspace is showing a visual",
    completed: "Ramspace showed a visual",
    failed: "Ramspace couldn't show a visual",
  },
  ramspace_create_todo: {
    running: "Ramspace is adding a to-do",
    completed: "Ramspace added a to-do",
    failed: "Ramspace couldn't add a to-do",
  },
  ramspace_list_todos: {
    running: "Ramspace is reading your to-dos",
    completed: "Ramspace read your to-dos",
    failed: "Ramspace couldn't read your to-dos",
  },
  ramspace_update_todo: {
    running: "Ramspace is updating a to-do",
    completed: "Ramspace updated a to-do",
    failed: "Ramspace couldn't update a to-do",
  },
  ramspace_interrupt_thread: {
    running: "Ramspace is interrupting a thread",
    completed: "Ramspace interrupted a thread",
    failed: "Ramspace couldn't interrupt a thread",
  },
  ramspace_set_thread_title: {
    running: "Ramspace is renaming a thread",
    completed: "Ramspace renamed a thread",
    failed: "Ramspace couldn't rename a thread",
  },
  ramspace_set_thread_archived: {
    running: "Ramspace is updating a thread",
    completed: "Ramspace updated a thread",
    failed: "Ramspace couldn't update a thread",
  },
  ramspace_create_automation: {
    running: "Ramspace is creating an automation",
    completed: "Ramspace created an automation",
    failed: "Ramspace couldn't create an automation",
  },
  ramspace_list_automations: {
    running: "Ramspace is listing automations",
    completed: "Ramspace listed automations",
    failed: "Ramspace couldn't list automations",
  },
  ramspace_view_automation: {
    running: "Ramspace is viewing an automation",
    completed: "Ramspace viewed an automation",
    failed: "Ramspace couldn't view an automation",
  },
  ramspace_update_automation: {
    running: "Ramspace is updating an automation",
    completed: "Ramspace updated an automation",
    failed: "Ramspace couldn't update an automation",
  },
  ramspace_update_automation_memory: {
    running: "Ramspace is updating automation memory",
    completed: "Ramspace updated automation memory",
    failed: "Ramspace couldn't update automation memory",
  },
  ramspace_report_automation_result: {
    running: "Ramspace is reporting an automation result",
    completed: "Ramspace reported an automation result",
    failed: "Ramspace couldn't report an automation result",
  },
  ramspace_cancel_automation: {
    running: "Ramspace is stopping an automation",
    completed: "Ramspace stopped an automation",
    failed: "Ramspace couldn't stop an automation",
  },
  ...RAMSPACE_BROWSER_TOOL_PRESENTATIONS,
  ...RAMSPACE_COMPUTER_TOOL_PRESENTATIONS,
} as const satisfies Record<string, RamspaceMcpToolSourcePresentation>;

// Semantic presentation IDs are separate from the source titles used to classify historical events.
const RAMSPACE_MCP_TOOL_PRESENTATION_KEYS = {
  ramspace_computer_screenshot: {
    running: "common:ramspaceIsTakingAScreenshot",
    completed: "common:ramspaceTookAScreenshot",
    failed: "common:ramspaceCouldnTFinishTakingAScreenshot",
    cancelled: "common:ramspaceStoppedTakingAScreenshot",
  },
  ramspace_computer_get_state: {
    running: "common:ramspaceIsReadingTheScreen",
    completed: "common:ramspaceReadTheScreen",
    failed: "common:ramspaceCouldnTFinishReadingTheScreen",
    cancelled: "common:ramspaceStoppedReadingTheScreen",
  },
  ramspace_computer_get_screen_size: {
    running: "common:ramspaceIsMeasuringTheScreen",
    completed: "common:ramspaceMeasuredTheScreen",
    failed: "common:ramspaceCouldnTFinishMeasuringTheScreen",
    cancelled: "common:ramspaceStoppedMeasuringTheScreen",
  },
  ramspace_computer_list_windows: {
    running: "common:ramspaceIsListingWindows",
    completed: "common:ramspaceListedTheWindows",
    failed: "common:ramspaceCouldnTFinishListingWindows",
    cancelled: "common:ramspaceStoppedListingWindows",
  },
  ramspace_computer_list_apps: {
    running: "common:ramspaceIsListingApps",
    completed: "common:ramspaceListedTheApps",
    failed: "common:ramspaceCouldnTFinishListingApps",
    cancelled: "common:ramspaceStoppedListingApps",
  },
  ramspace_computer_verify_state: {
    running: "common:ramspaceIsCheckingDesktopState",
    completed: "common:ramspaceCheckedDesktopState",
    failed: "common:ramspaceCouldnTFinishCheckingDesktopState",
    cancelled: "common:ramspaceStoppedCheckingDesktopState",
  },
  ramspace_computer_zoom: {
    running: "common:ramspaceIsZoomingIntoAWindow",
    completed: "common:ramspaceZoomedIntoAWindow",
    failed: "common:ramspaceCouldnTFinishZoomingIntoAWindow",
    cancelled: "common:ramspaceStoppedZoomingIntoAWindow",
  },
  ramspace_computer_get_accessibility_tree: {
    running: "common:ramspaceIsListingAppsAndWindows",
    completed: "common:ramspaceListedAppsAndWindows",
    failed: "common:ramspaceCouldnTFinishListingAppsAndWindows",
    cancelled: "common:ramspaceStoppedListingAppsAndWindows",
  },
  ramspace_computer_get_cursor_position: {
    running: "common:ramspaceIsReadingTheCursorPosition",
    completed: "common:ramspaceReadTheCursorPosition",
    failed: "common:ramspaceCouldnTFinishReadingTheCursorPosition",
    cancelled: "common:ramspaceStoppedReadingTheCursorPosition",
  },
  ramspace_computer_help: {
    running: "common:ramspaceIsReadingTheComputerPlaybook",
    completed: "common:ramspaceReadTheComputerPlaybook",
    failed: "common:ramspaceCouldnTFinishReadingTheComputerPlaybook",
    cancelled: "common:ramspaceStoppedReadingTheComputerPlaybook",
  },
  ramspace_computer_click: {
    running: "common:ramspaceIsClickingTheDesktop",
    completed: "common:ramspaceClickedTheDesktop",
    failed: "common:ramspaceCouldnTFinishClickingTheDesktop",
    cancelled: "common:ramspaceStoppedClickingTheDesktop",
  },
  ramspace_computer_move_cursor: {
    running: "common:ramspaceIsMovingTheCursor",
    completed: "common:ramspaceMovedTheCursor",
    failed: "common:ramspaceCouldnTFinishMovingTheCursor",
    cancelled: "common:ramspaceStoppedMovingTheCursor",
  },
  ramspace_computer_drag: {
    running: "common:ramspaceIsDraggingOnTheDesktop",
    completed: "common:ramspaceDraggedOnTheDesktop",
    failed: "common:ramspaceCouldnTFinishDraggingOnTheDesktop",
    cancelled: "common:ramspaceStoppedDraggingOnTheDesktop",
  },
  ramspace_computer_scroll: {
    running: "common:ramspaceIsScrollingTheDesktop",
    completed: "common:ramspaceScrolledTheDesktop",
    failed: "common:ramspaceCouldnTFinishScrollingTheDesktop",
    cancelled: "common:ramspaceStoppedScrollingTheDesktop",
  },
  ramspace_computer_type_text: {
    running: "common:ramspaceIsTypingOnTheDesktop",
    completed: "common:ramspaceTypedOnTheDesktop",
    failed: "common:ramspaceCouldnTFinishTypingOnTheDesktop",
    cancelled: "common:ramspaceStoppedTypingOnTheDesktop",
  },
  ramspace_computer_press_key: {
    running: "common:ramspaceIsPressingAKey",
    completed: "common:ramspacePressedAKey",
    failed: "common:ramspaceCouldnTFinishPressingAKey",
    cancelled: "common:ramspaceStoppedPressingAKey",
  },
  ramspace_computer_set_value: {
    running: "common:ramspaceIsSettingAField",
    completed: "common:ramspaceSetAField",
    failed: "common:ramspaceCouldnTFinishSettingAField",
    cancelled: "common:ramspaceStoppedSettingAField",
  },
  ramspace_computer_select_text: {
    running: "common:ramspaceIsSelectingText",
    completed: "common:ramspaceSelectedText",
    failed: "common:ramspaceCouldnTFinishSelectingText",
    cancelled: "common:ramspaceStoppedSelectingText",
  },
  ramspace_computer_perform_action: {
    running: "common:ramspaceIsActivatingAControl",
    completed: "common:ramspaceActivatedAControl",
    failed: "common:ramspaceCouldnTFinishActivatingAControl",
    cancelled: "common:ramspaceStoppedActivatingAControl",
  },
  ramspace_computer_launch_app: {
    running: "common:ramspaceIsOpeningAnApp",
    completed: "common:ramspaceOpenedAnApp",
    failed: "common:ramspaceCouldnTFinishOpeningAnApp",
    cancelled: "common:ramspaceStoppedOpeningAnApp",
  },
  ramspace_computer_activate_window: {
    running: "common:ramspaceIsActivatingAWindow",
    completed: "common:ramspaceActivatedAWindow",
    failed: "common:ramspaceCouldnTFinishActivatingAWindow",
    cancelled: "common:ramspaceStoppedActivatingAWindow",
  },
  ramspace_computer_set_window_frame: {
    running: "common:ramspaceIsMovingOrResizingAWindow",
    completed: "common:ramspaceMovedOrResizedAWindow",
    failed: "common:ramspaceCouldnTFinishMovingOrResizingAWindow",
    cancelled: "common:ramspaceStoppedMovingOrResizingAWindow",
  },
  ramspace_computer_invoke_menu: {
    running: "common:ramspaceIsInvokingAMenuItem",
    completed: "common:ramspaceInvokedAMenuItem",
    failed: "common:ramspaceCouldnTFinishInvokingAMenuItem",
    cancelled: "common:ramspaceStoppedInvokingAMenuItem",
  },
  ramspace_computer_kill_app: {
    running: "common:ramspaceIsForceQuittingAnApp",
    completed: "common:ramspaceForceQuitAnApp",
    failed: "common:ramspaceCouldnTFinishForceQuittingAnApp",
    cancelled: "common:ramspaceStoppedForceQuittingAnApp",
  },
  ramspace_computer_set_window_minimized: {
    running: "common:ramspaceIsChangingAWindowSVisibility",
    completed: "common:ramspaceChangedAWindowSVisibility",
    failed: "common:ramspaceCouldnTFinishChangingAWindowSVisibility",
    cancelled: "common:ramspaceStoppedChangingAWindowSVisibility",
  },
  ramspace_computer_set_app_visibility: {
    running: "common:ramspaceIsChangingAnAppSVisibility",
    completed: "common:ramspaceChangedAnAppSVisibility",
    failed: "common:ramspaceCouldnTFinishChangingAnAppSVisibility",
    cancelled: "common:ramspaceStoppedChangingAnAppSVisibility",
  },
  ramspace_computer_wait: {
    running: "common:ramspaceIsWaitingForTheDesktop",
    completed: "common:ramspaceWaitedForTheDesktop",
    failed: "common:ramspaceCouldnTFinishWaitingForTheDesktop",
    cancelled: "common:ramspaceStoppedWaitingForTheDesktop",
  },
  ramspace_computer_read_clipboard: {
    running: "common:ramspaceIsReadingTheClipboard",
    completed: "common:ramspaceReadTheClipboard",
    failed: "common:ramspaceCouldnTFinishReadingTheClipboard",
    cancelled: "common:ramspaceStoppedReadingTheClipboard",
  },
  ramspace_computer_write_clipboard: {
    running: "common:ramspaceIsWritingToTheClipboard",
    completed: "common:ramspaceWroteToTheClipboard",
    failed: "common:ramspaceCouldnTFinishWritingToTheClipboard",
    cancelled: "common:ramspaceStoppedWritingToTheClipboard",
  },
  ramspace_computer_paste: {
    running: "common:ramspaceIsPastingText",
    completed: "common:ramspacePastedText",
    failed: "common:ramspaceCouldnTFinishPastingText",
    cancelled: "common:ramspaceStoppedPastingText",
  },
  ramspace_computer_run: {
    running: "common:ramspaceIsRunningADesktopSequence",
    completed: "common:ramspaceRanADesktopSequence",
    failed: "common:ramspaceCouldnTFinishRunningADesktopSequence",
    cancelled: "common:ramspaceStoppedRunningADesktopSequence",
  },
  ramspace_computer_inspect: {
    running: "common:ramspaceIsInspectingTheComputer",
    completed: "common:ramspaceInspectedTheComputer",
    failed: "common:ramspaceCouldnTFinishInspectingTheComputer",
    cancelled: "common:ramspaceStoppedInspectingTheComputer",
  },
  ramspace_computer_spaces: {
    running: "common:ramspaceIsInspectingDesktopSpaces",
    completed: "common:ramspaceInspectedDesktopSpaces",
    failed: "common:ramspaceCouldnTFinishInspectingDesktopSpaces",
    cancelled: "common:ramspaceStoppedInspectingDesktopSpaces",
  },
  ramspace_computer_browser_state: {
    running: "common:ramspaceIsReadingTheBrowserPage",
    completed: "common:ramspaceReadTheBrowserPage",
    failed: "common:ramspaceCouldnTFinishReadingTheBrowserPage",
    cancelled: "common:ramspaceStoppedReadingTheBrowserPage",
  },
  ramspace_computer_browser_prepare: {
    running: "common:ramspaceIsPreparingABrowser",
    completed: "common:ramspacePreparedABrowser",
    failed: "common:ramspaceCouldnTFinishPreparingABrowser",
    cancelled: "common:ramspaceStoppedPreparingABrowser",
  },
  ramspace_computer_browser_navigate: {
    running: "common:ramspaceIsOpeningABrowserPage",
    completed: "common:ramspaceOpenedABrowserPage",
    failed: "common:ramspaceCouldnTFinishOpeningABrowserPage",
    cancelled: "common:ramspaceStoppedOpeningABrowserPage",
  },
  ramspace_computer_browser_click: {
    running: "common:ramspaceIsClickingInTheBrowser",
    completed: "common:ramspaceClickedInTheBrowser",
    failed: "common:ramspaceCouldnTFinishClickingInTheBrowser",
    cancelled: "common:ramspaceStoppedClickingInTheBrowser",
  },
  ramspace_computer_browser_type: {
    running: "common:ramspaceIsTypingInABrowserField",
    completed: "common:ramspaceTypedInABrowserField",
    failed: "common:ramspaceCouldnTFinishTypingInABrowserField",
    cancelled: "common:ramspaceStoppedTypingInABrowserField",
  },
  ramspace_computer_browser_dialog: {
    running: "common:ramspaceIsHandlingABrowserDialog",
    completed: "common:ramspaceHandledABrowserDialog",
    failed: "common:ramspaceCouldnTFinishHandlingABrowserDialog",
    cancelled: "common:ramspaceStoppedHandlingABrowserDialog",
  },
  ramspace_computer_browser_upload: {
    running: "common:ramspaceIsAttachingFilesInTheBrowser",
    completed: "common:ramspaceAttachedFilesInTheBrowser",
    failed: "common:ramspaceCouldnTFinishAttachingFilesInTheBrowser",
    cancelled: "common:ramspaceStoppedAttachingFilesInTheBrowser",
  },
  ramspace_computer_browser_download: {
    running: "common:ramspaceIsDownloadingAFile",
    completed: "common:ramspaceDownloadedAFile",
    failed: "common:ramspaceCouldnTFinishDownloadingAFile",
    cancelled: "common:ramspaceStoppedDownloadingAFile",
  },
  ramspace_computer_browser_pointer: {
    running: "common:ramspaceIsUsingThePointerInTheBrowser",
    completed: "common:ramspaceUsedThePointerInTheBrowser",
    failed: "common:ramspaceCouldnTFinishUsingThePointerInThe",
    cancelled: "common:ramspaceStoppedUsingThePointerInTheBrowser",
  },
  ramspace_computer_browser_press: {
    running: "common:ramspaceIsPressingEnterInTheBrowser",
    completed: "common:ramspacePressedEnterInTheBrowser",
    failed: "common:ramspaceCouldnTFinishPressingEnterInTheBrowser",
    cancelled: "common:ramspaceStoppedPressingEnterInTheBrowser",
  },
  ramspace_context: {
    running: "chat:ramspaceIsCheckingItsContext",
    completed: "chat:ramspaceCheckedItsContext",
    failed: "chat:ramspaceCouldnTCheckItsContext",
    cancelled: "common:ramspaceStoppedCheckingItsContext",
  },
  ramspace_capabilities: {
    running: "chat:ramspaceIsCheckingAvailableAgents",
    completed: "chat:ramspaceCheckedAvailableAgents",
    failed: "chat:ramspaceCouldnTCheckAvailableAgents",
    cancelled: "common:ramspaceStoppedCheckingAvailableAgents",
  },
  ramspace_overview: {
    running: "chat:ramspaceIsGatheringAnOverview",
    completed: "chat:ramspaceGatheredAnOverview",
    failed: "chat:ramspaceCouldnTGatherAnOverview",
    cancelled: "common:ramspaceStoppedGatheringAnOverview",
  },
  ramspace_list_allowed_projects: {
    running: "chat:ramspaceIsListingAllowedProjects",
    completed: "chat:ramspaceListedAllowedProjects",
    failed: "chat:ramspaceCouldnTListAllowedProjects",
    cancelled: "common:ramspaceStoppedListingAllowedProjects",
  },
  ramspace_create_task: {
    running: "chat:ramspaceIsCreatingATask",
    completed: "chat:ramspaceCreatedATask",
    failed: "chat:ramspaceCouldnTCreateATask",
    cancelled: "common:ramspaceStoppedCreatingATask",
  },
  ramspace_wait_for_task: {
    running: "chat:ramspaceIsWaitingForATask",
    completed: "chat:ramspaceFinishedWaitingForATask",
    failed: "chat:ramspaceCouldnTWaitForATask",
    cancelled: "common:ramspaceStoppedWaitingForATask",
  },
  ramspace_read_task: {
    running: "chat:ramspaceIsReadingATask",
    completed: "chat:ramspaceReadATask",
    failed: "chat:ramspaceCouldnTReadATask",
    cancelled: "common:ramspaceStoppedReadingATask",
  },
  ramspace_list_projects: {
    running: "chat:ramspaceIsListingProjects",
    completed: "chat:ramspaceListedProjects",
    failed: "chat:ramspaceCouldnTListProjects",
    cancelled: "common:ramspaceStoppedListingProjects",
  },
  ramspace_list_threads: {
    running: "chat:ramspaceIsListingThreads",
    completed: "chat:ramspaceListedThreads",
    failed: "chat:ramspaceCouldnTListThreads",
    cancelled: "common:ramspaceStoppedListingThreads",
  },
  ramspace_read_thread: {
    running: "chat:ramspaceIsReadingAThread",
    completed: "chat:ramspaceReadAThread",
    failed: "chat:ramspaceCouldnTReadAThread",
    cancelled: "common:ramspaceStoppedReadingAThread",
  },
  ramspace_read_thread_activity: {
    running: "chat:ramspaceIsReadingThreadActivity",
    completed: "chat:ramspaceReadThreadActivity",
    failed: "chat:ramspaceCouldnTReadThreadActivity",
    cancelled: "common:ramspaceStoppedReadingThreadActivity",
  },
  ramspace_read_thread_events: {
    running: "chat:ramspaceIsReadingThreadEvents",
    completed: "chat:ramspaceReadThreadEvents",
    failed: "chat:ramspaceCouldnTReadThreadEvents",
    cancelled: "common:ramspaceStoppedReadingThreadEvents",
  },
  ramspace_read_thread_runtime_events: {
    running: "chat:ramspaceIsReadingThreadRuntimeEvents",
    completed: "chat:ramspaceReadThreadRuntimeEvents",
    failed: "chat:ramspaceCouldnTReadThreadRuntimeEvents",
    cancelled: "common:ramspaceStoppedReadingThreadRuntimeEvents",
  },
  ramspace_diagnose_thread: {
    running: "chat:ramspaceIsDiagnosingAThread",
    completed: "chat:ramspaceDiagnosedAThread",
    failed: "chat:ramspaceCouldnTDiagnoseAThread",
    cancelled: "common:ramspaceStoppedDiagnosingAThread",
  },
  ramspace_create_thread: {
    running: "chat:ramspaceIsCreatingAThread",
    completed: "chat:ramspaceCreatedAThread",
    failed: "chat:ramspaceCouldnTCreateAThread",
    cancelled: "common:ramspaceStoppedCreatingAThread",
  },
  ramspace_create_threads: {
    running: "chat:ramspaceIsCreatingThreads",
    completed: "chat:ramspaceCreatedThreads",
    failed: "chat:ramspaceCouldnTCreateThreads",
    cancelled: "common:ramspaceStoppedCreatingThreads",
  },
  ramspace_wait_for_threads: {
    running: "chat:ramspaceIsWaitingForThreads",
    completed: "chat:ramspaceFinishedWaitingForThreads",
    failed: "chat:ramspaceCouldnTWaitForThreads",
    cancelled: "common:ramspaceStoppedWaitingForThreads",
  },
  ramspace_send_message: {
    running: "chat:ramspaceIsSendingAMessage",
    completed: "chat:ramspaceSentAMessage",
    failed: "chat:ramspaceCouldnTSendAMessage",
    cancelled: "common:ramspaceStoppedSendingAMessage",
  },
  ramspace_read_kanban_board: {
    running: "chat:ramspaceIsReadingTheBoard",
    completed: "chat:ramspaceReadTheBoard",
    failed: "chat:ramspaceCouldnTReadTheBoard",
    cancelled: "common:ramspaceStoppedReadingTheBoard",
  },
  ramspace_read_kanban_card: {
    running: "chat:ramspaceIsReadingABoardCard",
    completed: "chat:ramspaceReadABoardCard",
    failed: "chat:ramspaceCouldnTReadABoardCard",
    cancelled: "common:ramspaceStoppedReadingABoardCard",
  },
  ramspace_create_kanban_task: {
    running: "chat:ramspaceIsCreatingABoardTask",
    completed: "chat:ramspaceCreatedABoardTask",
    failed: "chat:ramspaceCouldnTCreateABoardTask",
    cancelled: "common:ramspaceStoppedCreatingABoardTask",
  },
  ramspace_move_kanban_card: {
    running: "chat:ramspaceIsMovingABoardCard",
    completed: "chat:ramspaceMovedABoardCard",
    failed: "chat:ramspaceCouldnTMoveABoardCard",
    cancelled: "common:ramspaceStoppedMovingABoardCard",
  },
  ramspace_show_visual: {
    running: "chat:ramspaceIsShowingAVisual",
    completed: "chat:ramspaceShowedAVisual",
    failed: "chat:ramspaceCouldnTShowAVisual",
    cancelled: "common:ramspaceStoppedShowingAVisual",
  },
  ramspace_create_todo: {
    running: "chat:ramspaceIsAddingAToDo",
    completed: "chat:ramspaceAddedAToDo",
    failed: "chat:ramspaceCouldnTAddAToDo",
    cancelled: "common:ramspaceStoppedAddingAToDo",
  },
  ramspace_list_todos: {
    running: "chat:ramspaceIsReadingYourToDos",
    completed: "chat:ramspaceReadYourToDos",
    failed: "chat:ramspaceCouldnTReadYourToDos",
    cancelled: "common:ramspaceStoppedReadingYourToDos",
  },
  ramspace_update_todo: {
    running: "chat:ramspaceIsUpdatingAToDo",
    completed: "chat:ramspaceUpdatedAToDo",
    failed: "chat:ramspaceCouldnTUpdateAToDo",
    cancelled: "common:ramspaceStoppedUpdatingAToDo",
  },
  ramspace_interrupt_thread: {
    running: "chat:ramspaceIsInterruptingAThread",
    completed: "chat:ramspaceInterruptedAThread",
    failed: "chat:ramspaceCouldnTInterruptAThread",
    cancelled: "common:ramspaceStoppedInterruptingAThread",
  },
  ramspace_set_thread_title: {
    running: "chat:ramspaceIsRenamingAThread",
    completed: "chat:ramspaceRenamedAThread",
    failed: "chat:ramspaceCouldnTRenameAThread",
    cancelled: "common:ramspaceStoppedRenamingAThread",
  },
  ramspace_set_thread_archived: {
    running: "chat:ramspaceIsUpdatingAThread",
    completed: "chat:ramspaceUpdatedAThread",
    failed: "chat:ramspaceCouldnTUpdateAThread",
    cancelled: "common:ramspaceStoppedUpdatingAThread",
  },
  ramspace_create_automation: {
    running: "chat:ramspaceIsCreatingAnAutomation",
    completed: "chat:ramspaceCreatedAnAutomation",
    failed: "chat:ramspaceCouldnTCreateAnAutomation",
    cancelled: "common:ramspaceStoppedCreatingAnAutomation",
  },
  ramspace_list_automations: {
    running: "chat:ramspaceIsListingAutomations",
    completed: "chat:ramspaceListedAutomations",
    failed: "chat:ramspaceCouldnTListAutomations",
    cancelled: "common:ramspaceStoppedListingAutomations",
  },
  ramspace_view_automation: {
    running: "chat:ramspaceIsViewingAnAutomation",
    completed: "chat:ramspaceViewedAnAutomation",
    failed: "chat:ramspaceCouldnTViewAnAutomation",
    cancelled: "common:ramspaceStoppedViewingAnAutomation",
  },
  ramspace_update_automation: {
    running: "chat:ramspaceIsUpdatingAnAutomation",
    completed: "chat:ramspaceUpdatedAnAutomation",
    failed: "chat:ramspaceCouldnTUpdateAnAutomation",
    cancelled: "common:ramspaceStoppedUpdatingAnAutomation",
  },
  ramspace_update_automation_memory: {
    running: "chat:ramspaceIsUpdatingAutomationMemory",
    completed: "chat:ramspaceUpdatedAutomationMemory",
    failed: "chat:ramspaceCouldnTUpdateAutomationMemory",
    cancelled: "common:ramspaceStoppedUpdatingAutomationMemory",
  },
  ramspace_report_automation_result: {
    running: "chat:ramspaceIsReportingAnAutomationResult",
    completed: "chat:ramspaceReportedAnAutomationResult",
    failed: "chat:ramspaceCouldnTReportAnAutomationResult",
    cancelled: "common:ramspaceStoppedReportingAnAutomationResult",
  },
  ramspace_cancel_automation: {
    running: "chat:ramspaceIsStoppingAnAutomation",
    completed: "chat:ramspaceStoppedAnAutomation",
    failed: "chat:ramspaceCouldnTStopAnAutomation",
    cancelled: "common:ramspaceStoppedStoppingAnAutomation",
  },
  ramspace_browser_status: {
    running: "common:checkBrowserStatus",
    completed: "common:checkBrowserStatus",
    failed: "common:checkBrowserStatus",
    cancelled: "common:cancelledCheckBrowserStatus",
  },
  ramspace_browser_tabs: {
    running: "common:listBrowserTabs",
    completed: "common:listBrowserTabs",
    failed: "common:listBrowserTabs",
    cancelled: "common:cancelledListBrowserTabs",
  },
  ramspace_browser_open: {
    running: "common:openBrowserTab",
    completed: "common:openBrowserTab",
    failed: "common:openBrowserTab",
    cancelled: "common:cancelledOpenBrowserTab",
  },
  ramspace_browser_navigate: {
    running: "common:navigateBrowserTab",
    completed: "common:navigateBrowserTab",
    failed: "common:navigateBrowserTab",
    cancelled: "common:cancelledNavigateBrowserTab",
  },
  ramspace_browser_back: {
    running: "common:goBackInBrowserHistory",
    completed: "common:goBackInBrowserHistory",
    failed: "common:goBackInBrowserHistory",
    cancelled: "common:cancelledGoBackInBrowserHistory",
  },
  ramspace_browser_forward: {
    running: "common:goForwardInBrowserHistory",
    completed: "common:goForwardInBrowserHistory",
    failed: "common:goForwardInBrowserHistory",
    cancelled: "common:cancelledGoForwardInBrowserHistory",
  },
  ramspace_browser_reload: {
    running: "common:reloadBrowserPage",
    completed: "common:reloadBrowserPage",
    failed: "common:reloadBrowserPage",
    cancelled: "common:cancelledReloadBrowserPage",
  },
  ramspace_browser_resize: {
    running: "common:resizeBrowserViewport",
    completed: "common:resizeBrowserViewport",
    failed: "common:resizeBrowserViewport",
    cancelled: "common:cancelledResizeBrowserViewport",
  },
  ramspace_browser_screenshot: {
    running: "common:captureBrowserScreenshot",
    completed: "common:captureBrowserScreenshot",
    failed: "common:captureBrowserScreenshot",
    cancelled: "common:cancelledCaptureBrowserScreenshot",
  },
  ramspace_browser_logs: {
    running: "common:readBrowserDiagnostics",
    completed: "common:readBrowserDiagnostics",
    failed: "common:readBrowserDiagnostics",
    cancelled: "common:cancelledReadBrowserDiagnostics",
  },
  ramspace_browser_upload: {
    running: "common:uploadWorkspaceFiles",
    completed: "common:uploadWorkspaceFiles",
    failed: "common:uploadWorkspaceFiles",
    cancelled: "common:cancelledUploadWorkspaceFiles",
  },
  ramspace_browser_run: {
    running: "common:runBrowserActions",
    completed: "common:runBrowserActions",
    failed: "common:runBrowserActions",
    cancelled: "common:cancelledRunBrowserActions",
  },
  ramspace_browser_close: {
    running: "common:closeBrowserTab",
    completed: "common:closeBrowserTab",
    failed: "common:closeBrowserTab",
    cancelled: "common:cancelledCloseBrowserTab",
  },
  ramspace_browser_snapshot: {
    running: "chat:snapshotBrowserPage",
    completed: "chat:snapshotBrowserPage",
    failed: "chat:snapshotBrowserPage",
    cancelled: "common:cancelledSnapshotBrowserPage",
  },
  ramspace_browser_webmcp_tools: {
    running: "chat:discoverPageWebMCPTools",
    completed: "chat:discoverPageWebMCPTools",
    failed: "chat:discoverPageWebMCPTools",
    cancelled: "common:cancelledDiscoverPageWebMCPTools",
  },
  ramspace_browser_webmcp_call: {
    running: "chat:callPageWebMCPTool",
    completed: "chat:callPageWebMCPTool",
    failed: "chat:callPageWebMCPTool",
    cancelled: "common:cancelledCallPageWebMCPTool",
  },
  ramspace_browser_click: {
    running: "chat:clickBrowserTarget",
    completed: "chat:clickBrowserTarget",
    failed: "chat:clickBrowserTarget",
    cancelled: "common:cancelledClickBrowserTarget",
  },
  ramspace_browser_hover: {
    running: "chat:hoverBrowserTarget",
    completed: "chat:hoverBrowserTarget",
    failed: "chat:hoverBrowserTarget",
    cancelled: "common:cancelledHoverBrowserTarget",
  },
  ramspace_browser_drag: {
    running: "chat:dragBetweenBrowserTargets",
    completed: "chat:dragBetweenBrowserTargets",
    failed: "chat:dragBetweenBrowserTargets",
    cancelled: "common:cancelledDragBetweenBrowserTargets",
  },
  ramspace_browser_type: {
    running: "chat:typeIntoBrowserTarget",
    completed: "chat:typeIntoBrowserTarget",
    failed: "chat:typeIntoBrowserTarget",
    cancelled: "common:cancelledTypeIntoBrowserTarget",
  },
  ramspace_browser_select: {
    running: "chat:selectBrowserOptions",
    completed: "chat:selectBrowserOptions",
    failed: "chat:selectBrowserOptions",
    cancelled: "common:cancelledSelectBrowserOptions",
  },
  ramspace_browser_press: {
    running: "chat:pressBrowserKeys",
    completed: "chat:pressBrowserKeys",
    failed: "chat:pressBrowserKeys",
    cancelled: "common:cancelledPressBrowserKeys",
  },
  ramspace_browser_scroll: {
    running: "chat:scrollBrowserPage",
    completed: "chat:scrollBrowserPage",
    failed: "chat:scrollBrowserPage",
    cancelled: "common:cancelledScrollBrowserPage",
  },
  ramspace_browser_wait: {
    running: "chat:waitForBrowserCondition",
    completed: "chat:waitForBrowserCondition",
    failed: "chat:waitForBrowserCondition",
    cancelled: "common:cancelledWaitForBrowserCondition",
  },
  ramspace_browser_evaluate: {
    running: "chat:evaluateBrowserExpression",
    completed: "chat:evaluateBrowserExpression",
    failed: "chat:evaluateBrowserExpression",
    cancelled: "common:cancelledEvaluateBrowserExpression",
  },
} as const satisfies Record<
  keyof typeof RAMSPACE_MCP_TOOL_PRESENTATIONS,
  Record<RamspaceMcpToolStatus, string>
>;

function normalizeRamspaceMcpIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const RAMSPACE_BROWSER_TOOL_NAME_BY_PRESENTATION = new Map<string, RamspaceBrowserToolName>(
  BROWSER_HISTORY_TOOL_NAMES.map((toolName) => [
    normalizeRamspaceMcpIdentifier(BROWSER_HISTORY_TITLES[toolName]),
    `ramspace_${toolName}`,
  ]),
);

const RAMSPACE_MCP_TOOL_PRESENTATION_ENTRIES = Object.entries(RAMSPACE_MCP_TOOL_PRESENTATIONS).map(
  ([toolName, presentation]) => ({
    toolName,
    presentation,
    normalizedRunning: normalizeRamspaceMcpIdentifier(presentation.running),
    normalizedCompleted: normalizeRamspaceMcpIdentifier(presentation.completed),
    normalizedFailed: normalizeRamspaceMcpIdentifier(presentation.failed),
  }),
);

function extractRamspaceMcpToolName(normalizedCandidate: string): string | null {
  if (BROWSER_TOOL_NAME_SET.has(normalizedCandidate)) {
    return `ramspace_${normalizedCandidate}`;
  }
  if (normalizedCandidate.startsWith("mcp_ramspace_ramspace_")) {
    return normalizedCandidate.slice("mcp_ramspace_".length);
  }
  if (normalizedCandidate.startsWith("mcp_ramspace_")) {
    return `ramspace_${normalizedCandidate.slice("mcp_ramspace_".length)}`;
  }
  if (normalizedCandidate.startsWith("ramspace_ramspace_")) {
    return normalizedCandidate.slice("ramspace_".length);
  }
  if (normalizedCandidate.startsWith("ramspace_")) {
    return normalizedCandidate;
  }
  return null;
}

function resolveRamspaceBrowserToolName(
  candidates: ReadonlyArray<string | null | undefined>,
): RamspaceBrowserToolName | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalizedCandidate = normalizeRamspaceMcpIdentifier(candidate);
    const extractedToolName = extractRamspaceMcpToolName(normalizedCandidate);
    const candidateToolName =
      extractedToolName ??
      RAMSPACE_BROWSER_TOOL_NAME_BY_PRESENTATION.get(normalizedCandidate) ??
      normalizedCandidate;
    if (candidateToolName in RAMSPACE_BROWSER_TOOL_PRESENTATIONS) {
      return candidateToolName as RamspaceBrowserToolName;
    }
  }
  return null;
}

function fallbackRamspaceMcpToolPresentation(
  toolName: string,
  translate: typeof t,
): RamspaceMcpToolPresentation {
  const action =
    toolName
      .replace(/^ramspace_/, "")
      .replace(/_+/g, " ")
      .trim() || translate("chat:anAction");
  return {
    running: translate("chat:ramspaceIsHandling", { action }),
    completed: translate("chat:ramspaceHandled", { action }),
    failed: translate("chat:ramspaceCouldnTHandle", { action }),
    cancelled: translate("chat:ramspaceStoppedHandling", { action }),
  };
}

function localizeRamspaceMcpToolPresentation(
  toolName: keyof typeof RAMSPACE_MCP_TOOL_PRESENTATIONS,
  translate: typeof t,
): RamspaceMcpToolPresentation {
  const keys = RAMSPACE_MCP_TOOL_PRESENTATION_KEYS[toolName];
  return {
    running: translate(keys.running),
    completed: translate(keys.completed),
    failed: translate(keys.failed),
    cancelled: translate(keys.cancelled),
  };
}

function resolveRamspaceMcpToolPresentation(
  candidates: ReadonlyArray<string | null | undefined>,
  translate: typeof t,
): RamspaceMcpToolPresentation | null {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const normalizedCandidate = normalizeRamspaceMcpIdentifier(candidate);
    for (const entry of RAMSPACE_MCP_TOOL_PRESENTATION_ENTRIES) {
      if (
        normalizedCandidate === entry.normalizedRunning ||
        normalizedCandidate === entry.normalizedCompleted ||
        normalizedCandidate === entry.normalizedFailed
      ) {
        return localizeRamspaceMcpToolPresentation(
          entry.toolName as keyof typeof RAMSPACE_MCP_TOOL_PRESENTATIONS,
          translate,
        );
      }
    }
    const toolName = extractRamspaceMcpToolName(normalizedCandidate);
    const knownPresentation = toolName
      ? (RAMSPACE_MCP_TOOL_PRESENTATIONS[
          toolName as keyof typeof RAMSPACE_MCP_TOOL_PRESENTATIONS
        ] as RamspaceMcpToolSourcePresentation | undefined)
      : undefined;
    if (knownPresentation) {
      return localizeRamspaceMcpToolPresentation(
        toolName as keyof typeof RAMSPACE_MCP_TOOL_PRESENTATIONS,
        translate,
      );
    }
    // Free-text summaries (e.g. reconciler activity lines) can begin with the
    // word "Ramspace" and normalize into a fake tool identifier; only
    // identifier-shaped candidates may take an invented fallback presentation.
    if (/\s/.test(candidate.trim())) {
      continue;
    }
    if (normalizedCandidate.startsWith("ramspace_is_handling_")) {
      return fallbackRamspaceMcpToolPresentation(
        `ramspace_${normalizedCandidate.slice("ramspace_is_handling_".length)}`,
        translate,
      );
    }
    if (normalizedCandidate.startsWith("ramspace_handled_")) {
      return fallbackRamspaceMcpToolPresentation(
        `ramspace_${normalizedCandidate.slice("ramspace_handled_".length)}`,
        translate,
      );
    }
    if (normalizedCandidate.startsWith("ramspace_couldn_t_handle_")) {
      return fallbackRamspaceMcpToolPresentation(
        `ramspace_${normalizedCandidate.slice("ramspace_couldn_t_handle_".length)}`,
        translate,
      );
    }
    if (!toolName) {
      continue;
    }
    return fallbackRamspaceMcpToolPresentation(toolName, translate);
  }
  return null;
}

export type RamspaceMcpToolStatus = "running" | "completed" | "failed" | "cancelled";

export interface RamspaceMcpToolTitleInput {
  readonly toolName?: string | null | undefined;
  readonly title?: string | null | undefined;
  readonly fallbackLabel?: string | null | undefined;
  readonly status?: RamspaceMcpToolStatus | undefined;
}

export function isRamspaceBrowserToolCall(input: RamspaceMcpToolTitleInput): boolean {
  return (
    resolveRamspaceBrowserToolName([input.toolName, input.title, input.fallbackLabel]) !== null
  );
}

// Every provider exposes Ramspace's MCP tools differently: MCP, dynamic, and even
// file-change rows can all represent the same gateway action. Normalize by tool
// identity instead of provider item type so transport details never reach the UI.
export function deriveRamspaceMcpToolTitle(
  input: RamspaceMcpToolTitleInput,
  translate: typeof t = t,
): string | null {
  const presentation = resolveRamspaceMcpToolPresentation(
    [input.toolName, input.title, input.fallbackLabel],
    translate,
  );
  if (!presentation) {
    return null;
  }
  return presentation[input.status ?? "completed"];
}

export function sanitizeRamspaceMcpToolPreview(
  input: {
    readonly preview?: string | null | undefined;
    readonly heading: string;
    readonly status?: RamspaceMcpToolStatus | undefined;
  },
  translate: typeof t = t,
): string | null {
  const preview = input.preview?.trim();
  if (!preview) return null;
  const previewTitle = deriveRamspaceMcpToolTitle(
    { title: preview, status: input.status },
    translate,
  );
  if (
    previewTitle &&
    normalizeToolTextForComparison(previewTitle) === normalizeToolTextForComparison(input.heading)
  ) {
    return null;
  }
  return preview;
}

export function deriveReadableToolTitle(
  input: ReadableToolTitleInput,
  translate: typeof t = t,
): string | null {
  const normalizedTitle = normalizeCompactToolLabel(input.title ?? "");
  const normalizedFallback = normalizeCompactToolLabel(input.fallbackLabel);
  const commandLabel = input.command
    ? deriveReadableCommandDisplay(input.command, input.isRunning, translate).verb
    : null;
  const commandLike = input.itemType === "command_execution" || input.requestKind === "command";

  // Derive a verbal label from requestKind when the title is generic
  const requestKindLabel = humanizeRequestKind(input.requestKind, input.itemType, translate);

  if (normalizedTitle.length > 0 && !isGenericToolTitle(normalizedTitle)) {
    return (input.itemType === "mcp_tool_call" || input.itemType === "dynamic_tool_call") &&
      /[_-]/.test(normalizedTitle)
      ? (normalizeToolDescriptor(normalizedTitle, translate) ?? normalizedTitle)
      : normalizedTitle;
  }

  if (commandLike && commandLabel) {
    return commandLabel;
  }

  const descriptor = normalizeToolDescriptor(
    extractToolDescriptorFromPayload(input.payload),
    translate,
  );
  if (descriptor && !isGenericToolTitle(descriptor)) {
    return descriptor;
  }

  // A generic request kind describes the transport, while the payload can name
  // the actual tool. Only use it after the provider metadata has been checked.
  if (requestKindLabel) {
    return requestKindLabel;
  }

  if (normalizedFallback.length > 0 && !isGenericToolTitle(normalizedFallback)) {
    return normalizedFallback;
  }
  if (normalizedTitle.length > 0) {
    return normalizedTitle;
  }
  if (normalizedFallback.length > 0) {
    return normalizedFallback;
  }
  return null;
}

export interface ReadableCommandDisplay {
  readonly verb: string;
  readonly target: string;
  readonly fullCommand: string;
}

// "read" and "search" split the read-only inspections so a file read and a
// pattern search wear different glyphs; listings (`ls`) are plain commands.
export type CommandVisualKind = "read" | "search" | "git" | "github" | "terminal";

function humanizeRequestKind(
  requestKind: ReadableToolTitleInput["requestKind"],
  itemType: ReadableToolTitleInput["itemType"],
  translate: typeof t,
): string | null {
  if (requestKind === "file-read") return translate("chat:detail_read", { context: "command" });
  if (requestKind === "file-change" || itemType === "file_change")
    return translate("chat:timeline_edited");
  if (requestKind === "tool") return translate("chat:tool");
  // Don't handle command types here — let humanizeCommandToolLabel produce more specific labels
  if (itemType === "web_search") return translate("chat:searchedTheWeb");
  if (itemType === "image_generation") return translate("chat:generatedImage_generatedImage");
  if (itemType === "image_view") return translate("chat:viewedImage");
  if (itemType === "collab_agent_tool_call") return translate("chat:agentTask");
  return null;
}

export function isGenericToolTitle(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    normalized === "tool" ||
    normalized === "tool call" ||
    normalized === "dynamic tool call" ||
    normalized === "mcp tool call" ||
    normalized === "agent task" ||
    normalized === "subagent task" ||
    normalized === "task" ||
    normalized === "command run" ||
    normalized === "ran command" ||
    normalized === "running command" ||
    normalized === "command execution" ||
    normalized === "file change" ||
    normalized === "find" ||
    normalized === "read file"
  );
}

function normalizeToolDescriptor(value: string | null, translate: typeof t): string | null {
  if (!value) {
    return null;
  }
  const computerTool = computerToolName(value);
  if (computerTool) {
    return translate(COMPUTER_TOOL_TITLE_KEYS[computerTool], { context: "computerTool" });
  }
  const mcpIdentifier = humanizeMcpToolIdentifier(value);
  if (mcpIdentifier) {
    return mcpIdentifier;
  }
  const normalized = value.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const dedupedTokens: string[] = [];
  for (const token of normalized.split(" ")) {
    if (dedupedTokens.at(-1)?.toLowerCase() === token.toLowerCase()) {
      continue;
    }
    dedupedTokens.push(token);
  }
  const collapsed = dedupedTokens.join(" ").trim();
  if (!collapsed) {
    return null;
  }
  const lowerCollapsed = collapsed.toLowerCase();
  if (lowerCollapsed === "read") {
    return translate("chat:detail_read", { context: "command" });
  }
  if (lowerCollapsed === "search" || lowerCollapsed === "find" || lowerCollapsed === "searched") {
    return translate("workspace:primaryActions_search");
  }
  const readable = /[_-]/.test(value) ? humanizeMcpToken(collapsed) : collapsed;
  return readable.length > 64 ? `${readable.slice(0, 61).trimEnd()}...` : readable;
}

function humanizeMcpToken(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((token) => {
      const lower = token.toLowerCase();
      if (lower === "mcp") return "MCP";
      if (token.toUpperCase() === token && token.length <= 5) return token;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function extractToolDescriptorFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) {
    return null;
  }
  const mcpServerTool = extractMcpServerToolDescriptor(payload, 0);
  if (mcpServerTool) {
    return mcpServerTool;
  }
  const descriptorKeys = ["kind", "name", "tool", "tool_name", "toolName", "title"];
  const candidates: string[] = [];
  collectDescriptorCandidates(payload, descriptorKeys, candidates, 0);
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }
    if (isGenericToolTitle(normalizeCompactToolLabel(normalized))) {
      continue;
    }
    return normalized;
  }
  return null;
}

function extractMcpServerToolDescriptor(value: unknown, depth: number): string | null {
  const pair = findMcpServerToolPair(value, depth);
  return pair ? humanizeMcpServerTool(pair.server, pair.tool) : null;
}

// Codex reports MCP calls as `{ server, tool }` somewhere inside the payload.
function findMcpServerToolPair(
  value: unknown,
  depth: number,
): { readonly server: string; readonly tool: string } | null {
  if (depth > 4 || !value || typeof value !== "object") {
    return null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findMcpServerToolPair(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.server === "string" && typeof record.tool === "string") {
    return { server: record.server, tool: record.tool };
  }
  for (const nestedKey of [
    "item",
    "data",
    "event",
    "payload",
    "result",
    "input",
    "call",
    "invocation",
    "source",
  ]) {
    const nested = findMcpServerToolPair(record[nestedKey], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/**
 * The MCP server behind a tool call: Claude names tools `mcp__<server>__<tool>`,
 * Codex reports a `{ server, tool }` pair in the payload. Null for other tools.
 */
export function extractMcpServerName(
  toolName: string | null | undefined,
  payload: unknown,
): string | null {
  const trimmed = toolName?.trim() ?? "";
  if (trimmed.startsWith("mcp__")) {
    const server = trimmed.split("__")[1]?.trim();
    if (server) return server;
  }
  const server = findMcpServerToolPair(payload, 0)?.server.trim();
  return server ? server : null;
}

function collectDescriptorCandidates(
  value: unknown,
  keys: ReadonlyArray<string>,
  target: string[],
  depth: number,
) {
  if (depth > 4 || target.length >= 24) {
    return;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      target.push(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectDescriptorCandidates(entry, keys, target, depth + 1);
      if (target.length >= 24) {
        return;
      }
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") {
      const trimmed = (record[key] as string).trim();
      if (trimmed) {
        target.push(trimmed);
      }
    }
  }
  for (const nestedKey of ["item", "data", "event", "payload", "result", "input", "tool", "call"]) {
    if (nestedKey in record) {
      collectDescriptorCandidates(record[nestedKey], keys, target, depth + 1);
      if (target.length >= 24) {
        return;
      }
    }
  }
}

// Read-only inspection commands: file reads wear the file glyph, searches and
// finds the magnifier; listings and everything else keep the terminal icon.
// These sets are the single source of truth for both the command labels below
// and the icon decision.
const READ_FILE_COMMAND_TOOLS = new Set(["cat", "nl", "head", "tail", "sed", "less", "more"]);
const SEARCH_COMMAND_TOOLS = new Set(["rg", "grep", "ag", "ack"]);
const FIND_COMMAND_TOOLS = new Set(["find", "fd"]);
const LIST_COMMAND_TOOLS = new Set(["ls"]);

// Derives the compact command sentence shown inline while preserving the full command for hover/detail UI.
export function deriveReadableCommandDisplay(
  rawCommand: string,
  isRunning = false,
  translate: typeof t = t,
): ReadableCommandDisplay {
  const command = stripCommandDisplayWrappers(unwrapShellCommandIfPresent(rawCommand));
  const primaryCommand = firstShellCommandSegment(command);
  const [tool, args] = splitToolAndArgs(primaryCommand);

  if (READ_FILE_COMMAND_TOOLS.has(tool)) {
    return {
      verb: translate(isRunning ? "chat:reading" : "chat:detail_read", { context: "command" }),
      target: lastPathComponents(args, translate("common:file"), translate),
      fullCommand: rawCommand,
    };
  }
  if (SEARCH_COMMAND_TOOLS.has(tool)) {
    return {
      verb: translate(isRunning ? "chat:searching" : "chat:searched", { context: "command" }),
      target: searchSummary(args, translate),
      fullCommand: rawCommand,
    };
  }
  if (LIST_COMMAND_TOOLS.has(tool)) {
    return {
      verb: translate(isRunning ? "chat:listing" : "chat:listed", { context: "command" }),
      target: lastPathComponents(args, translate("workspace:directory"), translate),
      fullCommand: rawCommand,
    };
  }
  if (FIND_COMMAND_TOOLS.has(tool)) {
    return {
      verb: translate(isRunning ? "chat:finding" : "chat:found", { context: "command" }),
      target: findTarget(args, translate("chat:files"), translate),
      fullCommand: rawCommand,
    };
  }

  switch (tool) {
    case "mkdir":
      return {
        verb: translate(isRunning ? "chat:creating" : "settings:created", { context: "command" }),
        target: lastPathComponents(args, translate("workspace:directory"), translate),
        fullCommand: rawCommand,
      };
    case "rm":
      return {
        verb: translate(isRunning ? "chat:removing" : "chat:removed", { context: "command" }),
        target: lastPathComponents(args, translate("common:file"), translate),
        fullCommand: rawCommand,
      };
    case "cp":
    case "mv":
      return {
        verb: translate(
          isRunning
            ? tool === "cp"
              ? "chat:copying"
              : "chat:moving"
            : tool === "cp"
              ? "chat:theme_copied"
              : "chat:moved",
          { context: "command" },
        ),
        target: lastPathComponents(args, translate("common:file"), translate),
        fullCommand: rawCommand,
      };
    case "git":
      return humanizeGitCommand(args, rawCommand, isRunning, translate);
    case "node":
    case "bun":
    case "deno":
    case "python":
    case "python3":
    case "ruby":
    case "perl":
      return {
        verb: translate(isRunning ? "chat:runStatus_running" : "chat:ran", { context: "command" }),
        target: inlineScriptTarget(tool, command, args, translate) ?? compactInlineCommand(command),
        fullCommand: rawCommand,
      };
    case "osascript":
      return {
        verb: translate(isRunning ? "chat:runStatus_running" : "chat:ran", { context: "command" }),
        target: "AppleScript",
        fullCommand: rawCommand,
      };
    default:
      return {
        verb: translate(isRunning ? "chat:runStatus_running" : "chat:ran", { context: "command" }),
        target: compactInlineCommand(command),
        fullCommand: rawCommand,
      };
  }
}

function firstCommandExecutable(rawCommand: string): string {
  const trimmed = rawCommand.trim();
  const match = /^(?:"([^"]+)"|'([^']+)'|(\S+))/u.exec(trimmed);
  const executable = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  return executable.split(/[\\/]/u).at(-1)?.toLowerCase() ?? "";
}

// The object half of a command row's sentence ("Searched <for foo in src>"),
// kept short enough to read inline. Shell wrappers that carry no meaning for a
// human (a full pwsh.exe path) collapse to the shell's friendly name.
export function deriveFriendlyCommandTarget(rawCommand: string): string {
  const executable = firstCommandExecutable(rawCommand);
  if (
    executable === "pwsh" ||
    executable === "pwsh.exe" ||
    executable === "powershell" ||
    executable === "powershell.exe"
  ) {
    return "PowerShell";
  }
  if (executable === "cmd" || executable === "cmd.exe") {
    return t("chat:commandPrompt");
  }

  const target = deriveReadableCommandDisplay(rawCommand).target.trim();
  return target.length <= 72 ? target : `${target.slice(0, 69).trimEnd()}…`;
}

// Classifies command rows for transcript glyphs after peeling away shell/env wrappers.
// This keeps `git -C`, `env ... gh`, and `/bin/zsh -lc "cd ... && git ..."` visually branded.
export function resolveCommandVisualKind(rawCommand: string): CommandVisualKind {
  if (deriveCommandReadTargets(rawCommand) !== null) {
    return "read";
  }
  const command = stripCommandDisplayWrappers(unwrapShellCommandIfPresent(rawCommand));
  const [tool] = splitToolAndArgs(firstShellCommandSegment(command));
  if (SEARCH_COMMAND_TOOLS.has(tool) || FIND_COMMAND_TOOLS.has(tool)) {
    return "search";
  }
  if (tool === "git") {
    return "git";
  }
  if (tool === "gh" || tool === "hub") {
    return "github";
  }
  return "terminal";
}

export function deriveInlineCommandCall(rawCommand: string): string {
  return stripCommandDisplayWrappers(unwrapShellCommandIfPresent(rawCommand));
}

// The command a row shows: what actually ran, minus the shell wrapper
// (`/bin/zsh -lc "…"`) and leading `cd <dir> &&` preambles. Pipes, chains and
// quoting stay verbatim, unlike `deriveInlineCommandCall`, which keeps only the
// first pipeline stage for classification.
export function deriveLiteralCommand(rawCommand: string): string {
  let value = rawCommand.trim();
  const lowered = value.toLowerCase();
  for (const prefix of SHELL_WRAPPER_PREFIXES) {
    if (!lowered.startsWith(prefix)) {
      continue;
    }
    value = value.slice(prefix.length).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1).trim();
    }
    break;
  }
  return stripLeadingShellPreambles(value).replace(/\s+/g, " ").trim();
}

// Files a command only reads, or null when the command does anything else.
// A row may say "Read <file>" instead of the literal command only when that
// is the whole story: no pipes, chains, redirects or substitutions, and no
// in-place edit (`sed -i`).
export function deriveCommandReadTargets(rawCommand: string): string[] | null {
  const literal = deriveLiteralCommand(rawCommand);
  if (literal.length === 0 || hasUnquotedShellOperator(literal)) {
    return null;
  }
  const [tool, args] = splitToolAndArgs(stripCommandDisplayWrappers(literal));
  if (!READ_FILE_COMMAND_TOOLS.has(tool)) {
    return null;
  }
  const tokens = tokenizeCommandArgs(args);
  const files: string[] = [];
  let skipNext = false;
  let sedScriptPending = tool === "sed";
  let sedPrintOnly = false;
  for (const token of tokens) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      if (tool === "sed") {
        if (token === "-i" || token.startsWith("-i") || token.startsWith("--in-place")) {
          return null;
        }
        if (token === "-n" || token === "--quiet" || token === "--silent") {
          sedPrintOnly = true;
        }
        if (token === "-e" || token === "--expression") {
          sedScriptPending = false;
          skipNext = true;
        }
      }
      if ((tool === "head" || tool === "tail") && (token === "-n" || token === "-c")) {
        skipNext = true;
      }
      continue;
    }
    if (sedScriptPending) {
      sedScriptPending = false;
      continue;
    }
    files.push(compactPath(token));
  }
  if (tool === "sed" && !sedPrintOnly) {
    return null;
  }
  return files.length > 0 ? files : null;
}

const SHELL_WRAPPER_PREFIXES = [
  "/usr/bin/bash -lc ",
  "/usr/bin/bash -c ",
  "/bin/bash -lc ",
  "/bin/bash -c ",
  "/usr/bin/zsh -lc ",
  "/usr/bin/zsh -c ",
  "/bin/zsh -lc ",
  "/bin/zsh -c ",
  "/bin/sh -lc ",
  "/bin/sh -c ",
  "bash -lc ",
  "bash -c ",
  "zsh -lc ",
  "zsh -c ",
  "sh -lc ",
  "sh -c ",
];

// Pipes, chains, redirects, background jobs and substitutions outside quotes.
function hasUnquotedShellOperator(value: string): boolean {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (
      char === "|" ||
      char === "&" ||
      char === ";" ||
      char === ">" ||
      char === "<" ||
      char === "`" ||
      (char === "$" && value[index + 1] === "(")
    ) {
      return true;
    }
  }
  return false;
}

function humanizeGitCommand(
  args: string,
  rawCommand: string,
  isRunning: boolean,
  translate: typeof t,
): ReadableCommandDisplay {
  const normalizedArgs = stripGitGlobalOptions(args);
  const subcommand = normalizedArgs.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  switch (subcommand) {
    case "status":
      return {
        verb: translate(isRunning ? "chat:providerModelPicker_checking" : "chat:checked", {
          context: "command",
        }),
        target: "git status",
        fullCommand: rawCommand,
      };
    case "diff":
      return {
        verb: translate(isRunning ? "chat:comparing" : "chat:compared", { context: "command" }),
        target: translate("chat:changes"),
        fullCommand: rawCommand,
      };
    case "show":
      return {
        verb: translate(isRunning ? "chat:inspecting" : "chat:inspected", { context: "command" }),
        target: "commit",
        fullCommand: rawCommand,
      };
    case "log":
      return {
        verb: translate(isRunning ? "chat:reviewing" : "chat:reviewed", { context: "command" }),
        target: translate("chat:gitHistory"),
        fullCommand: rawCommand,
      };
    case "add":
      return {
        verb: translate(isRunning ? "chat:staging" : "git:gitPanel_staged", { context: "command" }),
        target: translate("chat:changes"),
        fullCommand: rawCommand,
      };
    case "commit":
      return {
        verb: translate(isRunning ? "chat:committing" : "chat:committed", { context: "command" }),
        target: translate("chat:changes"),
        fullCommand: rawCommand,
      };
    case "push":
      return {
        verb: translate(isRunning ? "chat:pushing" : "workspace:pushed", { context: "command" }),
        target: translate("chat:toRemote"),
        fullCommand: rawCommand,
      };
    case "pull":
      return {
        verb: translate(isRunning ? "chat:pulling" : "chat:pulled", { context: "command" }),
        target: translate("chat:fromRemote"),
        fullCommand: rawCommand,
      };
    case "checkout":
    case "switch":
      return {
        verb: translate(isRunning ? "chat:switchingTo" : "chat:switchedTo", { context: "command" }),
        target: checkoutTarget(args, translate),
        fullCommand: rawCommand,
      };
    default:
      return {
        verb: translate(isRunning ? "chat:runStatus_running" : "chat:ran", { context: "command" }),
        target: compactInlineCommand(`git ${normalizedArgs}`.trim()),
        fullCommand: rawCommand,
      };
  }
}

function stripGitGlobalOptions(args: string): string {
  const tokens = tokenizeCommandArgs(args);
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token === "-C" || token === "-c" || token === "--git-dir" || token === "--work-tree") {
      index += 2;
      continue;
    }
    if (
      token.startsWith("-C") ||
      token.startsWith("-c") ||
      token.startsWith("--git-dir=") ||
      token.startsWith("--work-tree=")
    ) {
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      index += 1;
      continue;
    }
    break;
  }
  return tokens.slice(index).join(" ");
}

function checkoutTarget(args: string, translate: typeof t): string {
  const branch = tokenizeCommandArgs(args).at(-1)?.trim();
  return branch ? branch : translate("common:branch");
}

function lastPathComponents(args: string, fallback: string, translate: typeof t): string {
  const tokens = tokenizeCommandArgs(args);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index]!.replace(/^['"]|['"]$/g, "");
    if (!token || token.startsWith("-")) {
      continue;
    }
    return compactPath(token, true, translate);
  }
  return fallback;
}

function findTarget(args: string, fallback: string, translate: typeof t): string {
  const tokens = tokenizeCommandArgs(args);
  let skipNext = false;
  for (const token of tokens) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (token.startsWith("-")) {
      if (
        token === "-maxdepth" ||
        token === "-mindepth" ||
        token === "-name" ||
        token === "-type" ||
        token === "-path"
      ) {
        skipNext = true;
      }
      continue;
    }
    return compactPath(token, true, translate);
  }
  return fallback;
}

function compactPath(path: string, localized = false, translate: typeof t = t): string {
  if (path === ".") {
    return localized ? translate("chat:currentDirectory") : "current directory";
  }
  if (path === "..") {
    return localized ? translate("chat:parentDirectory") : "parent directory";
  }
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) {
    return path;
  }
  return parts.slice(-2).join("/");
}

function compactInlineCommand(command: string): string {
  const normalized = command.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 137).trimEnd()}...`;
}

function firstShellCommandSegment(command: string): string {
  const chain = findShellChain(command);
  return chain ? command.slice(0, chain.operatorStart).trim() : command;
}

function inlineScriptTarget(
  tool: string,
  command: string,
  args: string,
  translate: typeof t,
): string | null {
  const normalizedTool = tool === "python3" ? "python" : tool;
  if (containsHeredoc(command) || hasInlineScriptFlag(args)) {
    return translate("chat:script", { tool: normalizedTool });
  }
  return null;
}

function containsHeredoc(command: string): boolean {
  return /(^|\s)<<-?\s*['"]?[A-Za-z0-9_]+/.test(command);
}

function hasInlineScriptFlag(args: string): boolean {
  const tokens = tokenizeCommandArgs(args);
  return tokens.some((token) => token === "-e" || token === "-c" || token.startsWith("-e="));
}

function searchSummary(args: string, translate: typeof t): string {
  const { pattern, path, directoryReference } = extractSearchPatternAndPath(args);
  const displayPath = directoryReference
    ? translate(path === "parent directory" ? "chat:parentDirectory" : "chat:currentDirectory")
    : path;
  if (pattern && path) {
    return translate("chat:forIn", { pattern, path: displayPath });
  }
  if (pattern) {
    return translate("chat:for", { pattern });
  }
  if (path) {
    return translate("chat:in", { path: displayPath });
  }
  return translate("chat:files");
}

function extractSearchPatternAndPath(args: string): {
  pattern: string | null;
  path: string | null;
  directoryReference: boolean;
} {
  const tokens = tokenizeCommandArgs(args);
  let pattern: string | null = null;
  let path: string | null = null;
  let directoryReference = false;
  let skipNext = false;

  for (const token of tokens) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (token.startsWith("-")) {
      if (
        token === "-t" ||
        token === "-g" ||
        token === "--type" ||
        token === "--glob" ||
        token === "--max-count"
      ) {
        skipNext = true;
      }
      continue;
    }
    if (!pattern) {
      const normalizedPattern = normalizeSearchPatternToken(token);
      if (!normalizedPattern) {
        const normalizedPath = normalizeSearchPathToken(token);
        if (normalizedPath && (!path || path === "current directory")) {
          path = normalizedPath;
          directoryReference = token.trim() === "." || token.trim() === "..";
        }
        continue;
      }
      pattern = normalizedPattern;
      continue;
    }
    if (!path || path === "current directory") {
      const normalizedPath = normalizeSearchPathToken(token);
      if (normalizedPath) {
        path = normalizedPath;
        directoryReference = token.trim() === "." || token.trim() === "..";
      }
      continue;
    }
  }

  if (pattern && path === "current directory" && looksLikeSearchPath(pattern)) {
    path = normalizeSearchPathToken(pattern);
    directoryReference = false;
    pattern = null;
  }

  return { pattern, path, directoryReference };
}

function normalizeSearchPatternToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return null;
  }
  if (!/[a-z0-9]/i.test(trimmed)) {
    return null;
  }
  return trimmed.length > 30 ? `${trimmed.slice(0, 27)}...` : trimmed;
}

function normalizeSearchPathToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  return compactPath(trimmed);
}

function looksLikeSearchPath(token: string): boolean {
  return token.includes("/") || token.startsWith(".") || token.includes("\\");
}

function tokenizeCommandArgs(args: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < args.length) {
    while (args[index] === " ") {
      index += 1;
    }
    if (index >= args.length) {
      break;
    }

    const quote = args[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      let token = "";
      while (index < args.length && args[index] !== quote) {
        if (args[index] === "\\" && index + 1 < args.length) {
          token += args[index + 1];
          index += 2;
          continue;
        }
        token += args[index];
        index += 1;
      }
      if (args[index] === quote) {
        index += 1;
      }
      tokens.push(token);
      continue;
    }

    let token = "";
    while (index < args.length && args[index] !== " ") {
      token += args[index];
      index += 1;
    }
    if (token) {
      tokens.push(token);
    }
  }

  return tokens;
}

function splitToolAndArgs(command: string): [tool: string, args: string] {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return ["", ""];
  }
  const separator = normalized.indexOf(" ");
  if (separator === -1) {
    return [basenameOfPath(normalized).toLowerCase(), ""];
  }
  const tool = basenameOfPath(normalized.slice(0, separator)).toLowerCase();
  const args = normalized.slice(separator + 1).trim();
  return [tool, args];
}

function unwrapShellCommandIfPresent(rawCommand: string): string {
  let value = rawCommand.trim();
  if (!value) {
    return value;
  }

  const lowered = value.toLowerCase();
  for (const prefix of SHELL_WRAPPER_PREFIXES) {
    if (!lowered.startsWith(prefix)) {
      continue;
    }
    value = value.slice(prefix.length).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1).trim();
    }
    value = stripLeadingShellPreambles(value);
    break;
  }

  const pipeIndex = value.indexOf("|");
  if (pipeIndex > 0) {
    value = value.slice(0, pipeIndex).trim();
  }

  return value;
}

function stripLeadingShellPreambles(value: string): string {
  let current = value.trim();
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const chain = findShellChain(current);
    if (!chain) {
      return current;
    }
    const head = current.slice(0, chain.operatorStart).trim();
    if (!isShellSetupPreamble(head)) {
      return current;
    }
    current = current.slice(chain.commandStart).trim();
  }
  return current;
}

function isShellSetupPreamble(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }
  if (/^(?:builtin\s+)?cd\s+/.test(normalized)) {
    return true;
  }
  if (/^(?:source|\.)\s+/.test(normalized)) {
    return true;
  }
  if (/^set\s+[-+][A-Za-z]/.test(normalized)) {
    return true;
  }
  if (
    /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=[^\s]+(?:\s+[A-Za-z_][A-Za-z0-9_]*=[^\s]+)*$/.test(
      normalized,
    )
  ) {
    return true;
  }
  return false;
}

function findShellChain(value: string): { operatorStart: number; commandStart: number } | null {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < value.length - 1; index += 1) {
    const char = value[index];
    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    const next = value[index + 1];
    if (char === "&" && next === "&") {
      return { operatorStart: index, commandStart: index + 2 };
    }
    if (char === ";") {
      return { operatorStart: index, commandStart: index + 1 };
    }
  }

  return null;
}

function stripCommandDisplayWrappers(command: string): string {
  let current = command.replace(/\s+/g, " ").trim();
  for (let attempts = 0; attempts < 4; attempts += 1) {
    const [tool, args] = splitToolAndArgs(current);
    const next =
      tool === "env"
        ? stripEnvCommand(args)
        : tool === "timeout" || tool === "gtimeout"
          ? stripTimeoutCommand(args)
          : tool === "nice"
            ? stripNiceCommand(args)
            : tool === "arch"
              ? stripArchCommand(args)
              : tool === "command"
                ? args
                : null;
    if (!next || next === current) {
      return current;
    }
    current = next.trim();
  }
  return current;
}

function stripEnvCommand(args: string): string | null {
  const tokens = tokenizeCommandArgs(args);
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token === "--") {
      index += 1;
      break;
    }
    if (token === "-u" || token === "--unset" || token === "-C" || token === "--chdir") {
      index += 2;
      continue;
    }
    if (token.startsWith("--unset=") || token.startsWith("--chdir=")) {
      index += 1;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    break;
  }
  return index < tokens.length ? tokens.slice(index).join(" ") : null;
}

function stripTimeoutCommand(args: string): string | null {
  const tokens = tokenizeCommandArgs(args);
  let index = 0;
  while (index < tokens.length && tokens[index]?.startsWith("-")) {
    index += tokens[index] === "-s" || tokens[index] === "-k" ? 2 : 1;
  }
  if (index < tokens.length && /^\d+(?:\.\d+)?[smhd]?$/.test(tokens[index]!)) {
    index += 1;
  }
  return index < tokens.length ? tokens.slice(index).join(" ") : null;
}

function stripNiceCommand(args: string): string | null {
  const tokens = tokenizeCommandArgs(args);
  let index = 0;
  if (tokens[index] === "-n") {
    index += 2;
  } else {
    while (tokens[index]?.startsWith("-")) {
      index += 1;
    }
  }
  return index < tokens.length ? tokens.slice(index).join(" ") : null;
}

function stripArchCommand(args: string): string | null {
  const tokens = tokenizeCommandArgs(args);
  let index = 0;
  while (tokens[index]?.startsWith("-")) {
    index += 1;
  }
  return index < tokens.length ? tokens.slice(index).join(" ") : null;
}
