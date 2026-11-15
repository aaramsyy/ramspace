import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "vitest";

import {
  acknowledgeRamspaceStorageSnapshot,
  readRamspaceStorageSnapshot,
  RAMSPACE_STORAGE_SNAPSHOT_MAX_BYTES,
  validateRamspaceStorageSnapshot,
} from "./desktopStorageMigration";

const snapshot = () => ({
  version: 1 as const,
  exportedAt: "2026-07-09T00:00:00.000Z",
  entries: {
    "ramspace:theme": "dark",
    "ramspace.openUsage.enabled": "true",
  },
});

describe("desktopStorageMigration", () => {
  it("reads a legacy snapshot and removes it after acknowledgement", async () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "ramspace-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      FS.writeFileSync(target, `${JSON.stringify(snapshot())}\n`);
      expect(readRamspaceStorageSnapshot(target)).toEqual(snapshot());

      await acknowledgeRamspaceStorageSnapshot(target);
      expect(readRamspaceStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed, disallowed, and oversized snapshots", () => {
    expect(validateRamspaceStorageSnapshot({ version: 1 })).toBeNull();
    expect(
      validateRamspaceStorageSnapshot({
        ...snapshot(),
        entries: { "foreign:theme": "dark" },
      }),
    ).toBeNull();
    expect(
      validateRamspaceStorageSnapshot({
        ...snapshot(),
        entries: { "ramspace:large": "x".repeat(RAMSPACE_STORAGE_SNAPSHOT_MAX_BYTES) },
      }),
    ).toBeNull();
  });

  it("accepts renderer snapshots containing large composer drafts", () => {
    const largeDraft = "x".repeat(2 * 1024 * 1024);

    expect(
      validateRamspaceStorageSnapshot({
        ...snapshot(),
        entries: { "ramspace:composer-drafts:v1": largeDraft },
      })?.entries["ramspace:composer-drafts:v1"],
    ).toBe(largeDraft);
  });

  it("treats missing and malformed files as absent", () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "ramspace-storage-migration-"));
    const target = Path.join(directory, "snapshot.json");
    try {
      expect(readRamspaceStorageSnapshot(target)).toBeNull();
      FS.writeFileSync(target, "not json");
      expect(readRamspaceStorageSnapshot(target)).toBeNull();
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });
});
