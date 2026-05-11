---
description: 'Create branch, commit staged changes, push, and create PR (usage: /ship-staged [--skip-ai-review])'
model: zai-coding-plan/glm-5-turbo
---

Ship staged changes: create branch, commit, push, and create PR.

## Arguments

- `$ARGUMENTS` — Optional flag: `--skip-ai-review` to skip AI PR review

## Step 1: Gather Context

```bash
git status --short && git diff --cached --stat && git diff --cached && git log --oneline -10
```

If no staged changes exist, STOP and inform the user. Do NOT stage files yourself.

## Step 2: Analyze Changes (single pass)

Examine the diff output to determine:

1. **What** changed (files, modules, functions)
2. **Why** it changed (new feature, bug fix, refactor, etc.)
3. **Where** in the codebase (which scope/domain)

From this single analysis, derive BOTH the branch name and commit message.

### Choose Commit Type

Based on the project's `release.config.js`, ALL types trigger a release:

| Type                                   | Release Impact | Use When                               |
| -------------------------------------- | -------------- | -------------------------------------- |
| `feat`                                 | **minor**      | New feature for end users              |
| `fix`                                  | **patch**      | Bug fix for end users                  |
| `feat!` or `BREAKING CHANGE` in footer | **major**      | Breaking API/interface change          |
| `refactor`                             | patch          | Code restructuring, no behavior change |
| `chore`                                | patch          | Maintenance, deps, tooling             |
| `docs`                                 | patch          | Documentation only                     |
| `style`                                | patch          | Formatting, whitespace, semicolons     |
| `test`                                 | patch          | Adding or updating tests               |
| `build`                                | patch          | Build system, configs                  |
| `ci`                                   | patch          | CI/CD pipeline changes                 |

### Derive Branch Name

- `feat` → `feature/<scope>-<short-description>`
- `fix` → `fix/<scope>-<short-description>`
- `refactor` → `refactor/<scope>-<short-description>`
- Other types → `chore/<scope>-<short-description>`

Rules:

- Use kebab-case for description
- Keep description under 50 characters
- If a ticket ID is mentioned in the diff or branch context, include it: `feature/GTN-123-add-signing-flow`

### Format Commit Message

```
type(scope): description

- bullet point 1
- bullet point 2

BREAKING CHANGE: explanation (optional)
Closes #123 (optional)
```

Rules:

- **type**: required, from the table above
- **scope**: required — use domain/module name (`auth`, `contract`, `property`, `user`, `database`, `frontend`, `backend`, `api`, `ci`, etc.)
- **description**: lowercase, no period, imperative mood, max 72 characters, no emoji unless user explicitly requested
- **body**: required, bullet points — explain WHAT and WHY, not HOW, wrap at 72 chars
- **footer**: optional — `BREAKING CHANGE:`, `Closes #`, `Co-authored-by:`

## Step 3: Create Branch

```bash
git checkout -b <derived-branch-name>
```

If the branch already exists, STOP and inform the user.

## Step 4: Commit

### Single-line (only for trivial changes):

```bash
git commit -m "type(scope): description"
```

### Multi-line (always use this form):

```bash
git commit -m "type(scope): description" -m "$(cat <<'EOF'
- add user authentication endpoint
- validate JWT token in middleware

Closes #123
EOF
)"
```

## Step 5: Push Branch

```bash
git push -u origin <derived-branch-name>
```

If push fails, report the error and STOP.

## Step 6: Create Pull Request

```bash
gh pr create --fill
```

If `gh pr create` fails or is unavailable, inform the user with the manual push instructions.

## Step 7: AI PR Review (conditional)

Do NOT run `/ai-pr-review` locally. AI review is handled by CI.

If `$ARGUMENTS` contains `--skip-ai-review`, add the `skip-ai-review` label to the PR so the CI AI reviewer will skip it:

```bash
gh pr edit <PR_NUMBER> --add-label "skip-ai-review"
```

## Prohibitions

- NO "Generated with Claude Code" or any AI attribution markers
- NO emoji in commit message unless user explicitly requested
- NO `git add .` or staging additional files
- Do NOT modify code — only branch, commit, push, and PR operations
- Do NOT force push
- Do NOT skip verification steps
- DO NOT refactor unrelated code while committing
