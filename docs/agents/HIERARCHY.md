# Breaker Codex Orchestration

Project-scoped custom agents live in `.codex/agents/`. They are reusable role definitions, not running processes. The primary Codex session remains the orchestrator and owns the user objective, scope, final integration, and decisions involving competing evidence.

## Roles

| Role | Default | Access | Use |
| --- | --- | --- | --- |
| `ui_design_specialist` | Terra / Medium | workspace-write | Presentation, CSS, responsiveness, accessibility, visual verification |
| `domain_data_specialist` | Terra / Medium | workspace-write | Scintel/Foundry provenance, identity, extraction, contracts, evidence |
| `logic_state_specialist` | Terra / Medium | workspace-write | Fitting, Mining, inventory, reservations, workflows, persistence, compatibility |
| `qa_validation_specialist` | Terra / Medium | read-only | Independent regressions, tests, viewport and contract verification |

The four role definitions obey `AGENTS.md`. The coordinator supplies only the bounded task, relevant evidence, owner, constraints, and acceptance checks; task prompts do not repeat the project’s permanent rules.

## Routing and Concurrency

- Trivial and small isolated work stays with the primary session.
- Use one specialist for moderate work only when its bounded expertise offsets delegation cost.
- For cross-system work, use at most two concurrent specialists by default and only for independent, non-overlapping owners. One writer owns any canonical file set at a time.
- Run independent QA after implementation when the change is cross-domain, high-risk, user-visible, provenance-sensitive, or otherwise lacks sufficient direct acceptance evidence.
- Never delegate a summary of an earlier agent report. Reuse the report and request only a new, bounded evidence task.
- Nesting is root to specialist. A specialist may delegate only if the root expressly authorizes one independent deeper task.

## Reasoning and Token Discipline

The specialist default is Terra/Medium. Lower reasoning is appropriate for mechanical, evidence-bounded checks only; raise effort only for demonstrated architecture, data-semantic, or integration ambiguity. More agents are not presumed cheaper: prefer direct execution when their context setup, duplicate reading, or review cost exceeds the task.

Read the smallest useful durable context. Start from `D:\Vaults\Star Citizen Projects\Projects\Breaker\Breaker.md`, then the relevant index or current-state note, and follow only task-relevant links. Verify volatile claims in the live repository or accepted selector rather than copying old snapshots into a prompt.

## Checkpoints and Recovery

For non-trivial work, record a concise checkpoint in the relevant vault active-work note before pausing or handing off. Include: task scope; exact repository and worktree; branch and HEAD; relevant dirty paths; canonical owner and vault references; completed validation; unresolved items; and next safe action. Mark source merge, accepted data, publication, and deployment separately.

To resume, read the original task, `AGENTS.md`, the relevant checkpoint, and only the linked authoritative vault notes; then re-check worktree, branch, HEAD, dirty state, and any volatile selectors before editing. Never treat a chat summary, a historical handoff, or a stale generated artifact as current authority.
