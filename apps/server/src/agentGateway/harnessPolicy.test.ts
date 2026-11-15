import { assert, describe, it } from "@effect/vitest";
import { AUTOMATION_AUTHORING_GUIDANCE } from "./automationAuthoringGuidance.ts";

import {
  renderRamspaceHarnessPolicy,
  RAMSPACE_HARNESS_POLICY_MARKER,
  takeRamspaceHarnessPolicyForProviderSession,
  takeRamspaceHarnessPolicyTextPartForProviderSession,
  takeRamspaceHarnessPolicyForSession,
} from "./harnessPolicy.ts";

describe("Ramspace harness policy", () => {
  it("defers duplicate automation authoring text while preserving tool routing and run rules", () => {
    const inline = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    const deferred = renderRamspaceHarnessPolicy({
      gatewayControlAvailable: true,
      automationAuthoring: "tool-descriptions",
    });
    assert.equal(deferred, inline.replace(`${AUTOMATION_AUTHORING_GUIDANCE}\n`, ""));
    assert.include(deferred, "ramspace_create_automation");
    assert.include(deferred, "ramspace_view_automation");
    assert.include(deferred, "ramspace_report_automation_result");
  });

  it("includes honest completion evidence and opt-in delegated E2E testing", () => {
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    for (const text of [
      "completion report",
      "artifactPath",
      "![Result description]",
      "explicitly asked",
      "ramspace_e2e_review",
      "Do not load it for unrelated work",
    ]) {
      assert.include(policy, text);
    }
    assert.notInclude(
      renderRamspaceHarnessPolicy({ gatewayControlAvailable: false }),
      "browser_screenshot({kind:'proof'})",
    );
  });

  it("identifies Ramspace and explains exact batch coordination when MCP is available", () => {
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    assert.include(policy, RAMSPACE_HARNESS_POLICY_MARKER);
    assert.include(policy, "Ramspace is the host and harness");
    assert.include(policy, "one exact ramspace_create_threads plan");
    assert.include(policy, "before returning an operationId");
    assert.include(policy, "ramspace_wait_for_threads");
    assert.include(policy, "ramspace_set_thread_pull_request");
    assert.include(policy, "current thread's own deliverable");
    assert.include(policy, "only reviews, references, or discusses");
    assert.include(policy, "use browser_* autonomously");
    assert.include(policy, "canonical, complete control surface");
    assert.include(policy, "never substitute Chrome");
    assert.include(policy, "user's active chat");
    assert.include(policy, "Detailed rules live in each tool description");
    assert.notInclude(policy, "BrowserInterruptedByHuman");
    assert.notInclude(policy, "start with browser_open");
    assert.include(policy, "do not create Ramspace threads");
    assert.include(policy, "specific 3–8 word outcome label");
    assert.include(policy, "Assume no chat context");
    assert.include(policy, "notify-versus-silent criteria");
    assert.include(policy, 'later manual follow-up such as "continue"');
    assert.include(policy, "Never call this tool for a manual follow-up turn");
  });

  it("asks agents to emit known absolute file URLs instead of invented relative links", () => {
    const gateway = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    const identityOnly = renderRamspaceHarnessPolicy({ gatewayControlAvailable: false });

    for (const policy of [gateway, identityOnly]) {
      assert.include(policy, "[config.ts](file:///absolute/path/config.ts)");
      assert.include(policy, "Relative links are only for the session working directory");
      assert.include(policy, "use plain text and never invent a path");
    }
  });

  it("keeps final answers self-contained when intermediate progress is collapsed", () => {
    const gateway = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    const identityOnly = renderRamspaceHarnessPolicy({ gatewayControlAvailable: false });

    for (const policy of [gateway, identityOnly]) {
      assert.include(policy, 'under "Worked for..."');
      assert.include(policy, "Final responses must restate every needed scope");
      assert.include(policy, 'Never request approval using "this", "the above"');
      assert.include(policy, "structured user-input tool");
      assert.include(policy, "include all decision context");
    }
  });

  it("never advertises gateway mutation to providers without scoped MCP", () => {
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: false });
    assert.include(policy, "Ramspace MCP control is unavailable");
    assert.notInclude(policy, "one exact ramspace_create_threads plan");
  });

  it("delivers a private host-context block once per provider session", () => {
    const state: { harnessPolicyDelivered?: boolean } = {};
    assert.include(
      takeRamspaceHarnessPolicyForSession(state, { gatewayControlAvailable: true }) ?? "",
      "<ramspace_host_context>",
    );
    assert.isNull(takeRamspaceHarnessPolicyForSession(state, { gatewayControlAvailable: true }));

    // The text-part form ACP adapters inject obeys the same once-per-session latch.
    const partState: { harnessPolicyDelivered?: boolean } = {};
    const input = { provider: "cursor", scopedGatewayConnectionAvailable: true } as const;
    assert.include(
      takeRamspaceHarnessPolicyTextPartForProviderSession(partState, input)?.text ?? "",
      RAMSPACE_HARNESS_POLICY_MARKER,
    );
    assert.isNull(takeRamspaceHarnessPolicyTextPartForProviderSession(partState, input));
  });

  it("keeps OpenCode and Pi identity-only until scoped setup succeeds", () => {
    for (const provider of ["opencode", "pi"] as const) {
      const text =
        takeRamspaceHarnessPolicyForProviderSession(
          {},
          { provider, scopedGatewayConnectionAvailable: false },
        ) ?? "";
      assert.include(text, RAMSPACE_HARNESS_POLICY_MARKER, provider);
      assert.include(text, "Ramspace MCP control is unavailable", provider);
      assert.notInclude(text, "one exact ramspace_create_threads plan", provider);
    }
  });

  it("routes iOS work to device tools without embedding per-tool instructions", () => {
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    assert.include(policy, "any-language iOS app or simulator request");
    assert.include(policy, "call device_* directly and autonomously");
    assert.include(policy, "never use xcrun simctl");
    assert.include(policy, "open Simulator.app");
    assert.include(policy, "user watches the streamed pane");
    assert.notInclude(policy, "device_list first");
    assert.notInclude(policy, "com.apple.Preferences");
  });

  it("keeps hub roles out of reach of a worker without loosening normal conversations", () => {
    // Sessions with gateway control get the hub role line; sessions without it
    // are told nothing about hub routing they cannot perform anyway.
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: true });
    assert.include(policy, "Hub roles come from the server");
    assert.include(policy, "the coordinator routes assigned hub work and owns hub automations");
    assert.include(
      policy,
      "workers do their assigned work and cannot create threads or message other threads",
    );
    assert.include(policy, "Other conversations retain ordinary thread tools.");
    assert.notInclude(
      renderRamspaceHarnessPolicy({ gatewayControlAvailable: false }),
      "Hub roles come from the server",
    );
  });

  it("keeps the gateway policy below its prompt budget", () => {
    // Role guidance adds one line; keep the optional visual guidance in its own budget.
    assert.isAtMost(renderRamspaceHarnessPolicy({ gatewayControlAvailable: true }).length, 6_250);
    assert.isAtMost(
      renderRamspaceHarnessPolicy({ gatewayControlAvailable: true, inlineVisuals: true }).length,
      6_380,
    );
  });

  it("points to ramspace_show_visual only when the session can call it", () => {
    const visualLine = "call ramspace_show_visual and place its block in your reply";
    assert.include(
      renderRamspaceHarnessPolicy({ gatewayControlAvailable: true, inlineVisuals: true }),
      visualLine,
    );
    assert.notInclude(renderRamspaceHarnessPolicy({ gatewayControlAvailable: true }), visualLine);
    assert.notInclude(
      renderRamspaceHarnessPolicy({ gatewayControlAvailable: false, inlineVisuals: true }),
      visualLine,
    );
  });

  it("withholds device guidance from sessions with no gateway control", () => {
    const policy = renderRamspaceHarnessPolicy({ gatewayControlAvailable: false });

    // Promising tools this session cannot reach would be a lie.
    assert.notInclude(policy, "device_list");
    assert.notInclude(policy, "device_describe_ui");
  });

  it("includes Computer tool guidance only when the session can use Computer", () => {
    for (const gatewayControlAvailable of [true, false] as const) {
      for (const enableComputerControl of [true, false, undefined] as const) {
        const policy = renderRamspaceHarnessPolicy({
          gatewayControlAvailable,
          ...(enableComputerControl === undefined ? {} : { enableComputerControl }),
        });
        const scope = `${gatewayControlAvailable}/${enableComputerControl}`;
        if (gatewayControlAvailable && enableComputerControl === true) {
          assert.include(policy, "## Ramspace computer use", scope);
          assert.include(policy, "The computer_* tools are live on this session", scope);
        } else {
          assert.notInclude(policy, "## Ramspace computer use", scope);
          assert.notInclude(policy, "computer_", scope);
          assert.notInclude(policy, "turn Computer control on in Settings", scope);
        }
      }
    }
  });
});

it("adds Computer guidance only for an explicitly enabled scoped session across all providers", () => {
  const providers = [
    "codex",
    "claudeAgent",
    "cursor",
    "grok",
    "droid",
    "devin",
    "opencode",
    "pi",
    "antigravity",
  ] as const;
  for (const provider of providers) {
    const off = takeRamspaceHarnessPolicyForProviderSession(
      {},
      { provider, scopedGatewayConnectionAvailable: true },
    );
    const explicitOff = takeRamspaceHarnessPolicyForProviderSession(
      { enableComputerControl: false },
      { provider, scopedGatewayConnectionAvailable: true },
    );
    assert.strictEqual(off, explicitOff);
    assert.notInclude(off ?? "", "## Ramspace computer use");
    assert.notInclude(off ?? "", "computer_", provider);
    const state = { enableComputerControl: true };
    const on =
      takeRamspaceHarnessPolicyForProviderSession(state, {
        provider,
        scopedGatewayConnectionAvailable: true,
      }) ?? "";
    assert.equal(on.split("## Ramspace computer use").length - 1, 1, provider);
    assert.include(on, "never replay it");
    assert.isNull(
      takeRamspaceHarnessPolicyForProviderSession(state, {
        provider,
        scopedGatewayConnectionAvailable: true,
      }),
    );
    assert.notInclude(
      takeRamspaceHarnessPolicyForProviderSession(
        { enableComputerControl: true },
        { provider, scopedGatewayConnectionAvailable: false },
      ) ?? "",
      "## Ramspace computer use",
    );
  }
});
