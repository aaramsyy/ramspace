# Release history and preparation snapshot

Repository: `aaramsyy/ramspace`. Snapshot date: 2026-11-15.
Baseline: `a1a1b55d3861b266b73ea3ad82c8e034fd7e8042` (`main`, `v1.5.4`).

## Complete tag inventory

[The CSV inventory](release-tag-inventory.csv) records all 152 remote tags,
their peeled commit IDs, original author timestamps, and whether each commit
is an ancestor of the baseline. Rows are sorted by author timestamp and tag;
a commit timestamp is not a tag creation or publication timestamp.

The inventory spans `v0.0.16` through `v1.5.4`. Of these tags, 141 are
ancestors of the baseline and 11 are not. Non-ancestor tags are Beta/Remote
history; this does not establish whether their patches were incorporated
through another commit. Tags and original commit dates have not been changed.

GitHub returned no releases at the time of this snapshot. Existing tags do
not establish that installers, signatures, or update manifests are available.
The repository has three recorded PRs: #1 open, #2 and #3 closed without merge.
Those records cannot reconstruct historical review of imported Git commits.

## Latest release blocker

[Release run 43667448554](https://github.com/aaramsyy/ramspace/actions/runs/43667448554)
failed exact-source preflight: `apps/server/package.json` contains `1.5.3`,
but the requested release is `1.5.4`. Another release run, 43667480348, was
queued when inspected; its outcome has not been verified.

## Preparation order

1. Review the tag inventory from the earliest historical version to the latest.
   Preserve existing tag targets and original commit timestamps.
2. For any historical version selected for publication, check out its exact
   source, inspect its own release workflow and dependencies, and establish
   whether original artifacts exist. Mark reconstructed artifacts with their
   actual build/publication date. Do not present them as original releases.
3. Resolve the latest version mismatch in a separate implementation PR. Align
   all manifests and lockfile using the repository release tooling. Since
   `v1.5.4` already points to a mismatched source, prepare a new version and tag
   rather than silently moving the historical tag.
4. Run the checks and build-only qualification described in the
   [release checklist](release.md). Confirm all required platform artifacts,
   signatures, provenance, startup checks, and update manifests.
5. Publish only the qualified source and artifacts. Preserve Stable, Beta,
   and Remote channel separation, and keep historical releases from replacing
   the intended Stable Latest release.

This PR prepares the inventory and release work; it does not certify any
historical or current version as ready to publish. No application or UI
behavior is changed.
