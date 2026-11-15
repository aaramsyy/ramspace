import { describe, expect, it } from "vitest";
import { isClipboardWritePermission } from "./clipboardPermissions";

const requester = (url = "https://example.com/page", focused = true, destroyed = false) => ({
  getURL: () => url,
  isFocused: () => focused,
  isDestroyed: () => destroyed,
});
describe("clipboard permissions", () => {
  it.each([
    "https://example.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("allows foreground copy buttons on %s", (url) => {
    expect(
      isClipboardWritePermission(
        requester(url),
        "clipboard-sanitized-write",
        { isMainFrame: true, requestingUrl: url, embeddingOrigin: new URL(url).origin },
        url,
      ),
    ).toBe(true);
  });
  it.each([
    "ramspace://app",
    "ramspace-canary://app",
    "ramspace-cua://app",
    "ramspace-beta://app",
    "ramspace-remote://app",
  ])("allows foreground copy buttons on the %s desktop origin", (origin) => {
    const url = `${origin}/index.html`;
    expect(
      isClipboardWritePermission(
        requester(url),
        "clipboard-sanitized-write",
        { isMainFrame: true, requestingUrl: url, embeddingOrigin: origin },
        origin,
      ),
    ).toBe(true);
  });
  it.each([
    "ramspace-beta://app",
    "ramspace-remote://evil.test",
    "ramspace-remote://app:8080",
    "ramspace-remote://user@app",
  ])("rejects foreign clipboard request metadata from %s", (origin) => {
    const page = requester("ramspace-remote://app/index.html");
    expect(isClipboardWritePermission(page, "clipboard-sanitized-write", {}, origin)).toBe(false);
    expect(
      isClipboardWritePermission(page, "clipboard-sanitized-write", { requestingUrl: origin }),
    ).toBe(false);
    expect(
      isClipboardWritePermission(page, "clipboard-sanitized-write", { embeddingOrigin: origin }),
    ).toBe(false);
  });
  it.each(["clipboard-read", "deprecated-sync-clipboard-read", "media", "unknown"])(
    "does not grant %s",
    (permission) => {
      expect(isClipboardWritePermission(requester(), permission, {})).toBe(false);
    },
  );
  it("leaves document focus to Chromium but rejects destroyed, insecure and foreign-frame requests", () => {
    for (const source of [
      null,
      requester(undefined, true, true),
      requester("http://example.com"),
      requester("file:///tmp/page.html"),
      requester("bad-url"),
      requester("ramspace-remote://evil.test"),
      requester("ramspace-remote://app.evil.test"),
      requester("ramspace-remote://app:8080"),
      requester("ramspace-remote://user@app"),
      requester("ramspace-remotes://app"),
    ])
      expect(isClipboardWritePermission(source, "clipboard-sanitized-write", {})).toBe(false);
    for (const details of [
      { isMainFrame: false },
      { embeddingOrigin: "https://other.test" },
      { requestingUrl: "https://other.test" },
      { requestingUrl: "invalid" },
    ])
      expect(isClipboardWritePermission(requester(), "clipboard-sanitized-write", details)).toBe(
        false,
      );
    expect(
      isClipboardWritePermission(
        requester(),
        "clipboard-sanitized-write",
        {},
        "https://other.test",
      ),
    ).toBe(false);
    expect(isClipboardWritePermission(requester(), "clipboard-sanitized-write", {})).toBe(true);
    expect(
      isClipboardWritePermission(requester(undefined, false), "clipboard-sanitized-write", {}),
    ).toBe(true);
  });
});
