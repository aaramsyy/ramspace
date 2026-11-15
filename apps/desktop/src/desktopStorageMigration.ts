// FILE: desktopStorageMigration.ts
// Purpose: Reads and acknowledges a validated browser-storage handoff from older desktop builds.
// Layer: Desktop main-process utility

import * as FS from "node:fs";
import * as Path from "node:path";

import type { RamspaceStorageSnapshot } from "@ramspace/contracts";

export const RAMSPACE_STORAGE_SNAPSHOT_FILE_NAME = "ramspace-storage-origin-v1.json";
export const RAMSPACE_STORAGE_SNAPSHOT_MAX_BYTES = 16 * 1024 * 1024;
export const RAMSPACE_STORAGE_SNAPSHOT_MAX_ENTRIES = 2_048;
export const RAMSPACE_STORAGE_SNAPSHOT_MAX_KEY_LENGTH = 512;
export const RAMSPACE_STORAGE_SNAPSHOT_MAX_VALUE_LENGTH = 16 * 1024 * 1024;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isRamspaceStorageKey(key: string): boolean {
  return key.startsWith("ramspace:") || key.startsWith("ramspace.");
}

export function validateRamspaceStorageSnapshot(value: unknown): RamspaceStorageSnapshot | null {
  if (!isPlainRecord(value) || value.version !== 1 || !isPlainRecord(value.entries)) {
    return null;
  }
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    return null;
  }

  const entries = Object.entries(value.entries);
  if (entries.length > RAMSPACE_STORAGE_SNAPSHOT_MAX_ENTRIES) {
    return null;
  }
  for (const [key, entryValue] of entries) {
    if (
      !isRamspaceStorageKey(key) ||
      key.length === 0 ||
      key.length > RAMSPACE_STORAGE_SNAPSHOT_MAX_KEY_LENGTH ||
      typeof entryValue !== "string" ||
      entryValue.length > RAMSPACE_STORAGE_SNAPSHOT_MAX_VALUE_LENGTH
    ) {
      return null;
    }
  }

  const snapshot = value as unknown as RamspaceStorageSnapshot;
  try {
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > RAMSPACE_STORAGE_SNAPSHOT_MAX_BYTES) {
      return null;
    }
  } catch {
    return null;
  }
  return snapshot;
}

export function resolveRamspaceStorageSnapshotPath(userDataPath: string): string {
  return Path.join(userDataPath, RAMSPACE_STORAGE_SNAPSHOT_FILE_NAME);
}

export function readRamspaceStorageSnapshot(snapshotPath: string): RamspaceStorageSnapshot | null {
  try {
    const stats = FS.statSync(snapshotPath);
    if (!stats.isFile() || stats.size > RAMSPACE_STORAGE_SNAPSHOT_MAX_BYTES) {
      return null;
    }
    return validateRamspaceStorageSnapshot(JSON.parse(FS.readFileSync(snapshotPath, "utf8")));
  } catch {
    return null;
  }
}

export async function acknowledgeRamspaceStorageSnapshot(snapshotPath: string): Promise<void> {
  await FS.promises.rm(snapshotPath, { force: true }).catch(() => undefined);
}
