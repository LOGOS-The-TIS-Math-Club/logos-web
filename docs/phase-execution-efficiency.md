# LOGOS Web Phase Execution Efficiency Audit

> - Status: Active execution policy
> - Audited tasks: Phase 00 through Phase 05
> - Audit date: 2026-09-01
> - Related roadmap: [roadmap.md](./roadmap.md)

## 1. Scope and evidence

This audit reviewed the observable Codex task histories for Phase 00 through Phase 05: tool sequences, turn durations, reasoning-summary events, commentary, failures, browser activity, worker invocations, verification commands, and provider work.

It cannot inspect private hidden chain-of-thought. It evaluates the task-visible reasoning summaries and actions, which are the relevant evidence for latency, buffering, tool use, and repeated work.

The task histories contained approximately:

| Observable activity                      | Count |
| ---------------------------------------- | ----: |
| Shell/command executions                 |   667 |
| Browser/MCP tool calls                   |   321 |
| Total observable tool calls              |   988 |
| Failed, rejected, or declined tool calls |    95 |
| AGY-related invocations or probes        |    91 |
| Active CI/check watch commands           |    41 |
| Full or aggregate verification sequences |    27 |
| Agent commentary messages                |   320 |
| Reasoning-summary events                 | 1,477 |
| Context compactions                      |     9 |

Counts are approximate because some compound commands perform several operations and some tool metadata mentions a capability without executing it. They are sufficient to identify the dominant patterns.

## 2. Where the time and effort went

### 2.1 Delegation and repair loops

Phase 03 was the largest wall-time sink. It contained about 46 AGY-related calls and roughly 144 minutes of recorded shell-command duration. Several worker calls lasted between 6 and 24 minutes. Permission failures, incomplete edits, repeated diagnosis assignments, and progressively smaller repair prompts caused the same workstream to be delegated multiple times.

Phase 01 also issued about 13 AGY calls for implementation, documentation alignment, polish, and multiple reviews. Phase 05 spent its startup trying three incompatible AGY command forms or permission combinations before falling back to direct work.

**Root cause:** delegation was treated as a workflow to keep repairing rather than a single economical option. A worker failure frequently triggered another worker prompt before the controller proved that the failure mode had changed.

### 2.2 Browser and provider-console churn

Phase 02 issued about 210 browser calls. Phase 00 issued about 49 and Phase 04 about 46. Many calls listed tabs, reopened settings, captured large DOM snapshots, checked whether a setting persisted, or returned to a provider page after an API or UI mismatch.

Browser calls were not always long individually, but their DOM output and follow-up reasoning expanded context heavily. They also made progress feel buffered because a simple provider decision became a sequence of small observations and UI actions.

**Root cause:** browser automation was used as an ongoing implementation surface rather than a final critical-path verification or a short user-assisted setup step.

### 2.3 Repeated verification and active waiting

The six tasks contained about 41 active `gh ... --watch` or equivalent wait commands and roughly 27 aggregate verification sequences. Phase 00 alone had about 14 watch commands. Phase 04 repeatedly ran combinations of formatting, linting, type checking, tests, migrations, build, browser tests, and audit even after prior stages were already passing.

**Root cause:** verification was restarted from the beginning after small changes, and CI was watched actively more than once instead of checking once and returning only when the result could change a decision.

### 2.4 Excessive orchestration narration

The histories contain about 320 commentary messages and 1,477 reasoning-summary events. Phase 03 alone produced 133 agent messages and more than 6,000 words of commentary. Several updates described routine file reads, command selection, delegation mechanics, or another pending final check rather than a decision, blocker, or result.

**Root cause:** the controller narrated its process at tool-call granularity. This increased context, made the task appear slower, and encouraged re-evaluation of settled decisions.

### 2.5 External incidents becoming phase work

Phase 04 correctly ended by deferring the Neon Auth provisioning failure, but only after repeated provider inspection, smoke-test preparation, deletion approval, reprovisioning observation, and additional completion discussion.

**Root cause:** repository completion, provider activation, and live verification were not separated early enough. The provider incident inherited the phase's security urgency even after it stopped being a code blocker.

### 2.6 Oversized prompts and outputs

Several sessions pasted full architecture/phase briefs into workers, returned large JSON or DOM snapshots, and printed broad diffs or generated SQL. Phase 00–04 required nine context compactions in total.

**Root cause:** file paths and focused retrieval were available, but complete documents and outputs were repeatedly copied into the active conversation.

## 3. Required execution policy for Phase 06 and Phase 07

### 3.1 Five-minute preflight

Before implementation, perform one bounded preflight:

1. confirm branch, status, and relevant files;
2. read only the authoritative sections needed for the current outcome;
3. identify the focused test command and the final required suite;
4. check AGY availability and supported invocation once;
5. identify external actions that will require the user.

Do not start with a repository-wide audit, dependency survey, browser session, or multiple worker-model experiments.

### 3.2 Worker limit

- Use at most one primary AGY/Gemini implementation assignment for a phase outcome.
- Allow one corrected retry only when the first failure has a diagnosed, changed cause.
- If permission or edit mode fails twice, stop repairing AGY and continue directly or report a blocker.
- Do not delegate planning, implementation, polish, documentation, and review as separate overlapping worker loops.
- A review worker may be used once after deterministic checks pass; it reports material blockers only.
- Never use blanket permission bypass merely to preserve delegation.

### 3.3 Browser limit

- No browser work during ordinary repository implementation.
- Use deterministic component and route tests first.
- After the feature stabilizes, run one browser pass covering only the named critical journeys.
- Prefer Gemini for that pass when it is already working safely.
- Otherwise give the user a numbered click checklist with expected results.
- Do not repeatedly list tabs, capture whole-page DOM snapshots, or reopen unchanged settings.
- A failed path may receive one focused rerun after a relevant fix.

### 3.4 Verification ladder

Use this order:

1. focused test for the changed unit or journey;
2. formatting check for changed files;
3. affected lint/type/database check;
4. one final `pnpm check` or current canonical aggregate suite;
5. one dependency/security check if it is not already included;
6. one CI-status check after pushing.

If a final stage fails, repair and rerun that stage plus directly affected checks. Do not restart every passing stage without a relevant change.

### 3.5 CI and waiting

- Do not run repeated `gh pr checks --watch` loops.
- Check once after push.
- Use one bounded wait only when its result determines the next action.
- If CI remains pending, report that state and stop; the user can return when checks complete.
- Do not perform another local full suite merely because remote CI is pending.

### 3.6 Provider boundary

Treat these as separate gates:

1. repository implementation;
2. provider configuration;
3. live smoke verification;
4. production activation.

Finish safe repository work first. Give the user one grouped, exact-target setup checklist. Make one approved smoke attempt. If the provider fails for an external reason, preserve concise evidence and defer unless the current critical journey cannot function without it.

### 3.7 Communication and context budget

During an uninterrupted implementation run, commentary should normally appear only at:

1. start and scope confirmation;
2. a material decision or blocker;
3. completion of implementation and start of final verification;
4. final result.

Use file paths instead of pasting documents into worker prompts. Read targeted sections with `rg` and bounded line ranges. Truncate logs to the first actionable failure. Avoid printing generated bundles, complete migrations, large DOM trees, or full diffs unless the content itself is under review.

### 3.8 Stop rule

Stop when the phase acceptance criteria pass and the unmerged PR is ready. Do not add another audit, another worker, another browser pass, or another full-suite run to increase confidence without a concrete unresolved risk.

## 4. Phase-specific application

### Phase 06

- Approve application questions before coding.
- Build the landing page, application persistence, Google identification boundary, and focused leadership application view as one outcome-owned workstream.
- Use synthetic identity adapters until live OAuth is available.
- Run browser verification only after the complete poster-to-submission journey exists.
- Provider activation cannot consume more time than the application itself.

### Phase 07

- Execute the four roadmap milestones sequentially within one branch and PR.
- Verify each milestone with focused checks, but run the full suite only after integration settles.
- Use configured Classroom/Drive/Calendar links unless API activation delivers immediate user value.
- Keep dashboards structural and task-oriented.
- Reserve browser and provider work for the final critical-journey and launch checks.

## 5. Expected result

These limits should remove the dominant causes of buffering: worker retry storms, browser micro-steps, active CI watching, repeated full verification, provider over-investigation, and low-value narration. They preserve the engineering gates that protect student data and production reliability while shifting model time toward visible product outcomes.
