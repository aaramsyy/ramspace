/**
 * Public contracts for the Ramspace agent-control gateway.
 *
 * New gateway tools decode these schemas before doing any work. Keeping the
 * limits here ensures the MCP surface, server implementation, and tests share
 * the same definition of an exact creation/wait plan.
 */
import { Schema } from "effect";

import { EnvironmentId, ProjectId, ThreadId, TurnId } from "./baseSchemas";
import { ModelSelection, ProviderKind, RuntimeMode } from "./orchestration";
import { ProviderModelDescriptor } from "./providerDiscovery";
import { ProviderInstanceId } from "./providerInstance";
import { ServerProviderAuthStatus } from "./server";

export const RAMSPACE_GATEWAY_MAX_THREADS_PER_OPERATION = 20;
export const RAMSPACE_GATEWAY_MAX_REQUEST_ID_LENGTH = 256;
export const RAMSPACE_GATEWAY_MAX_WAIT_MS = 60_000;

export const RamspaceGatewayErrorCode = Schema.Literals([
  "caller_session_inactive",
  "caller_turn_inactive",
  "capability_denied",
  "provider_unavailable",
  "model_unavailable",
  "model_option_unavailable",
  "idempotency_conflict",
  "creation_plan_locked",
  "creation_limit_exceeded",
  "thread_not_found",
  "wait_timed_out",
  "operation_failed",
  "remote_unavailable",
]);
export type RamspaceGatewayErrorCode = typeof RamspaceGatewayErrorCode.Type;

export const RamspaceGatewayError = Schema.Struct({
  code: RamspaceGatewayErrorCode,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
});
export type RamspaceGatewayError = typeof RamspaceGatewayError.Type;

export const RamspaceGatewayErrorResult = Schema.Struct({
  error: RamspaceGatewayError,
});
export type RamspaceGatewayErrorResult = typeof RamspaceGatewayErrorResult.Type;

export const RamspaceContextResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  harness: Schema.Struct({
    name: Schema.Literal("Ramspace"),
    policyVersion: Schema.String,
  }),
  caller: Schema.Struct({
    environmentId: Schema.optional(EnvironmentId),
    threadId: ThreadId,
    turnId: Schema.NullOr(TurnId),
    provider: ProviderKind,
    projectId: ProjectId,
  }),
  capabilities: Schema.Struct({
    threadRead: Schema.Boolean,
    threadCreate: Schema.Boolean,
    threadWait: Schema.Boolean,
    automations: Schema.Boolean,
  }),
});
export type RamspaceContextResult = typeof RamspaceContextResult.Type;

export const RamspaceCreateThreadSpec = Schema.Struct({
  prompt: Schema.String.check(Schema.isNonEmpty()),
  contextMessageIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isNonEmpty())).check(Schema.isMaxLength(16)),
  ),
  notifyCreatorOnComplete: Schema.optional(Schema.Boolean),
  title: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  target: ModelSelection,
  projectId: Schema.optional(ProjectId),
  environment: Schema.optional(Schema.Literals(["local", "worktree"])),
  baseRef: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  // Legacy inputs remain decodable for replay/backward compatibility, but the
  // MCP catalog no longer advertises branch-backed worktree creation.
  baseBranch: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  branchName: Schema.optional(Schema.String.check(Schema.isNonEmpty())),
  runtimeMode: Schema.optional(Schema.Literals(["approval-required", "full-access"])),
  // External integrations need the "computer:control" scope; provider sessions
  // cannot delegate computer control to created threads.
  enableComputerControl: Schema.optional(Schema.Boolean),
  // Proposed identity of one task inside a Hub request. The coordinator may
  // propose it; the Hub routing service freezes the normalized key at the first
  // persisted decision, so a retry reuses the same worker instead of creating a
  // second one. Ignored outside Hubs.
  taskKey: Schema.optional(Schema.String.check(Schema.isNonEmpty()).check(Schema.isMaxLength(128))),
  // Short reason recorded with the routing decision and shown on the task card.
  // It authorizes nothing and is not part of task identity.
  routingReason: Schema.optional(Schema.String.check(Schema.isMaxLength(500))),
});
export type RamspaceCreateThreadSpec = typeof RamspaceCreateThreadSpec.Type;

const RamspaceGatewayRequestId = Schema.String.check(Schema.isNonEmpty()).check(
  Schema.isMaxLength(RAMSPACE_GATEWAY_MAX_REQUEST_ID_LENGTH),
);

export const RamspaceCreateThreadsInput = Schema.Struct({
  requestId: RamspaceGatewayRequestId,
  threads: Schema.Array(RamspaceCreateThreadSpec)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(RAMSPACE_GATEWAY_MAX_THREADS_PER_OPERATION)),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type RamspaceCreateThreadsInput = typeof RamspaceCreateThreadsInput.Type;

export const RamspaceProviderInstanceCatalog = Schema.Struct({
  instanceId: ProviderInstanceId,
  displayName: Schema.String.check(Schema.isNonEmpty()),
  isDefault: Schema.Boolean,
  enabled: Schema.Boolean,
});
export type RamspaceProviderInstanceCatalog = typeof RamspaceProviderInstanceCatalog.Type;

export const RamspaceProviderCatalog = Schema.Struct({
  provider: ProviderKind,
  defaultModel: Schema.NullOr(Schema.String),
  models: Schema.Array(ProviderModelDescriptor),
  // Optional for older MCP clients that decode a capability response from a
  // server predating provider-instance discovery. Current servers always emit
  // the field, including an empty array when no extra instances are configured.
  instances: Schema.optional(Schema.Array(RamspaceProviderInstanceCatalog)),
  enabled: Schema.Boolean,
  available: Schema.Boolean,
  authStatus: Schema.optional(ServerProviderAuthStatus),
  source: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});
export type RamspaceProviderCatalog = typeof RamspaceProviderCatalog.Type;

export const RamspaceGatewayTargetOptionValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
]);
export type RamspaceGatewayTargetOptionValue = typeof RamspaceGatewayTargetOptionValue.Type;

export const RamspaceGatewayTargetOptionRule = Schema.Struct({
  key: Schema.String,
  valueType: Schema.Literals(["string", "number", "boolean"]),
  allowedValues: Schema.Array(RamspaceGatewayTargetOptionValue),
  allowedValuesSource: Schema.Literals(["provider-contract", "model-discovery"]),
});
export type RamspaceGatewayTargetOptionRule = typeof RamspaceGatewayTargetOptionRule.Type;

export const RamspaceGatewayTargetConstruction = Schema.Struct({
  modelValueSource: Schema.Literal("providers[].models[].slug"),
  primaryOptionKey: Schema.String,
  alternativeOptionKeys: Schema.Array(Schema.String),
  optionSelectionRule: Schema.String,
  providerOptions: Schema.Array(RamspaceGatewayTargetOptionRule),
  optionsByModel: Schema.Record(Schema.String, Schema.Array(RamspaceGatewayTargetOptionRule)),
  exampleTarget: Schema.NullOr(ModelSelection),
});
export type RamspaceGatewayTargetConstruction = typeof RamspaceGatewayTargetConstruction.Type;

export const RamspaceCapabilitiesResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  targetConstruction: Schema.Record(Schema.String, RamspaceGatewayTargetConstruction),
  providers: Schema.Array(RamspaceProviderCatalog),
  limits: Schema.Struct({
    maxThreadsPerOperation: Schema.Int,
    maxWaitMs: Schema.Int,
    oneCreationPlanPerActiveTurn: Schema.Boolean,
  }),
});
export type RamspaceCapabilitiesResult = typeof RamspaceCapabilitiesResult.Type;

export const RamspaceCreatedThreadResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  threadId: ThreadId,
  projectId: ProjectId,
  title: Schema.String,
  target: ModelSelection,
  provider: ProviderKind,
  model: Schema.String,
  runtimeMode: RuntimeMode,
  environment: Schema.Literals(["local", "worktree"]),
  branch: Schema.NullOr(Schema.String),
  worktreePath: Schema.NullOr(Schema.String),
  /** Ready-to-use markdown link target for the created thread
   * (`thread://<threadId>`) — renders as a clickable thread link. */
  link: Schema.optional(Schema.String),
  status: Schema.Literal("task_dispatched"),
});
export type RamspaceCreatedThreadResult = typeof RamspaceCreatedThreadResult.Type;

export const RamspaceCreateThreadsResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  operationId: Schema.String,
  requestId: RamspaceGatewayRequestId,
  requestedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  createdCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  threadIds: Schema.Array(ThreadId),
  threads: Schema.Array(RamspaceCreatedThreadResult),
});
export type RamspaceCreateThreadsResult = typeof RamspaceCreateThreadsResult.Type;

export const RamspaceWaitForThreadsInput = Schema.Struct({
  threadIds: Schema.Array(ThreadId)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(RAMSPACE_GATEWAY_MAX_THREADS_PER_OPERATION)),
  runIds: Schema.optional(
    Schema.Array(Schema.NullOr(TurnId)).check(
      Schema.isMaxLength(RAMSPACE_GATEWAY_MAX_THREADS_PER_OPERATION),
    ),
  ),
  timeoutMs: Schema.optional(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).check(
      Schema.isLessThanOrEqualTo(RAMSPACE_GATEWAY_MAX_WAIT_MS),
    ),
  ),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type RamspaceWaitForThreadsInput = typeof RamspaceWaitForThreadsInput.Type;

export const RamspaceWaitedThreadResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  threadId: ThreadId,
  runId: Schema.NullOr(TurnId),
  state: Schema.Literals(["idle", "pending", "running", "completed", "error", "interrupted"]),
  terminal: Schema.Boolean,
  timedOut: Schema.Boolean,
  summary: Schema.NullOr(Schema.String),
  summaryTruncated: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  readThread: Schema.Struct({
    tool: Schema.Literal("ramspace_read_thread"),
    arguments: Schema.Struct({ threadId: ThreadId, environmentId: Schema.optional(EnvironmentId) }),
  }),
});
export type RamspaceWaitedThreadResult = typeof RamspaceWaitedThreadResult.Type;

export const RamspaceWaitForThreadsResult = Schema.Struct({
  environmentId: Schema.optional(EnvironmentId),
  callerThreadId: ThreadId,
  runIds: Schema.Array(Schema.NullOr(TurnId)),
  allTerminal: Schema.Boolean,
  timedOut: Schema.Boolean,
  threads: Schema.Array(RamspaceWaitedThreadResult),
});
export type RamspaceWaitForThreadsResult = typeof RamspaceWaitForThreadsResult.Type;
