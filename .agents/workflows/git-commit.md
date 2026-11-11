---
description: Analyzes current code changes and creates atomic, goal-oriented commits using the Conventional Commits format.
---

# Git Commit Workflow

## Philosophy

Every commit message must answer the question: **"What did we achieve?"** — not "What did we touch?".

A good commit message reads like a changelog entry a teammate would understand without reading the diff.

**Bad (mechanical/literal):** `refactor(scheduler): update modal and component files`
**Good (goal-oriented):** `feat(scheduler): add drag-and-drop session rescheduling`

**Bad:** `refactor(clients): fix html and ts files`
**Good:** `refactor(clients): decompose client detail into metrics and notes tab components`

---

## Execution Steps

### Step 1: Analyze the Full Changeset

Run `git status` and `git diff` (or `git diff --cached` for staged files) to understand ALL changes in the working tree.

Read the diffs carefully. Identify:

- **What was the developer's goal?** (not what files changed)
- **Are there logically independent changes?** (infra vs domain, feature vs tooling, etc.)
- **Are there user-facing features (`feat`) or bugfixes (`fix`) that warrant a version bump?**

---

### Step 2: Version Bumping & "What's New" Automation

If the changes contain new features (`feat`) or user-facing fixes (`fix`), the agent MUST automate the release process before finalizing commits:

1. **Calculate the next SemVer version:**
   - New feature / module: Bump **MINOR** (e.g. `0.4.0` -> `0.5.0`).
   - Bugfixes / optimizations only: Bump **PATCH** (e.g. `0.4.1` -> `0.4.2`).
   - Breaking change: Bump **MAJOR** (e.g. `1.0.0`).

2. **Generate structured Release Notes in Ukrainian (`flow-fit-api`):**
   - Formulate human-friendly changelog entries (with emojis and categories).
   - Prepend the new release object to `APP_UPDATES_DATA` in `flow-fit-api/src/modules/app-updates/data/app-updates.data.ts` (if accessible) and update `app-updates.service.spec.ts`.

3. **Synchronize version in config files:**
   - `flow-fit-client/package.json` -> `"version": "<new-version>"`
   - `flow-fit-client/src/environments/environment.ts` -> `appVersion: '<new-version>'`
   - `flow-fit-client/src/environments/environment.prod.ts` -> `appVersion: '<new-version>'`
   - `flow-fit-api/package.json` -> `"version": "<new-version>"` (if accessible)

---

### Step 3: Plan Atomic Commits

Split changes into **logical units**, each representing a single completed goal. Apply these grouping rules:

| Layer                | What belongs together                                   | Example scope                     |
| -------------------- | ------------------------------------------------------- | --------------------------------- |
| **Infrastructure**   | New packages, Angular/Ionic config, router setup        | `deps`, `config`, `routes`        |
| **Core/Shared**      | Shared UI components, modals, pipes, interceptors       | `shared`, `ui`, `auth`            |
| **Domain consumers** | Feature pages, components, services                     | `scheduler`, `clients`, `reports` |
| **Release / Notes**  | Version bump in package.json and environments           | `release`                         |
| **Tooling/Meta**     | Agent rules, workflows, configs, docs                   | `agents`, `docs`, `ci`            |

**Rules:**

- Infrastructure setup BEFORE consumers that use it.
- A commit must compile and pass lint on its own (no broken intermediate states).
- If 10+ files have the same 2-line mechanical change (e.g., removing an import), that's ONE commit — not 10.
- Never mix functional changes with tooling/docs in the same commit.

### Step 4: Present the Commit Plan

Show the user a table:

```
| # | Files to stage | Commit message |
|---|----------------|---------------|
| 1 | package.json, angular.json | chore(deps): update angular to v20 |
| 2 | src/app/shared/modals/* | refactor(modals): migrate constructor DI to inject() |
| 3 | src/app/pages/scheduler/* | feat(scheduler): add week-view calendar filtering |
| 4 | package.json, src/environments/* | chore(release): bump client version to 0.4.2 |
| 5 | .agents/rules/*.md | chore(agents): update code style rules |
```

### Step 5: Execute Commits One by One

For each commit in the plan:

1. Stage only the relevant files: `git add <file1> <file2> ...`
2. Verify staged content: `git diff --cached --stat`
3. Show the commit message and **wait for user confirmation**
4. Run `git commit -m "message"`
5. Proceed to the next commit

### Step 6: Post-Release Broadcast Prompt

If a new version was released, ask the user:
> *"Бажаєте надіслати сповіщення про реліз v<new-version> усім тренерам через Telegram-бота (`POST /app-updates/broadcast-telegram`)?"*

---

## Commit Message Rules

### Format

```
<type>(<scope>): <goal-oriented description>

<optional body: context, rationale, or impact>
```

### Types

| Type       | When to use                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New capability, new behavior, new UI feature   |
| `fix`      | Bug fix, correction of wrong behavior          |
| `refactor` | Code restructuring without changing behavior   |
| `chore`    | Dependencies, configs, build, CI, tooling      |
| `docs`     | Documentation only                             |
| `perf`     | Performance improvement                        |
| `test`     | Adding or fixing tests                         |

### Scope

- Use the **primary domain** affected: `auth`, `scheduler`, `clients`, `reports`, `settings`, `sessions`, `locations`, `shared`, `ui`, `modals`, `agents`
- **Omit scope** when the change spans 3+ unrelated modules (e.g., global rename or cross-cutting cleanup)
- Never use generic scopes like `code`, `files`, `update`

### Description Quality Checklist

Before finalizing, verify the description against these anti-patterns:

| ❌ Anti-pattern                            | ✅ Better alternative                                       | Why                                   |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| `update modal and component`               | `migrate modal dependency injection to inject()`            | Describes the goal, not the mechanism |
| `fix button styles in scss`                | `improve touch target sizing for mobile clients`            | Explains WHY and WHAT                 |
| `clean up code`                            | `decompose client detail into metrics and notes components` | Concrete, not abstract                |
| `update files`                             | `migrate legacy constructor injections to inject()`         | Specific and meaningful               |

### The "Changelog Test"

Read the commit message as if it were a line in a CHANGELOG.md. Would a teammate understand the impact? If not — rewrite it.

---

## Body (Optional but Recommended for Non-Trivial Changes)

Add a body when the commit:

- Removes a dependency or pattern used across many files
- Introduces a new architectural pattern
- Has non-obvious rationale
