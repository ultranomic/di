---
description: Commit the current staged changes
---

Commit staged changes following Conventional Commits (Angular) and semantic-release standards.

## Step 1: Gather Context

```bash
git status --short && git diff --cached --stat && git diff --cached && git log --oneline -10
```

## Step 2: Analyze Changes

Examine the diff output to determine:

1. **What** changed (files, modules, functions)
2. **Why** it changed (new feature, bug fix, refactor, etc.)
3. **Where** in the codebase (which scope/domain)

## Step 3: Choose Commit Type

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

## Step 4: Format Commit Message

### Format

```
type(scope): description

- bullet point 1
- bullet point 2

BREAKING CHANGE: explanation (optional)
Closes #123 (optional)
```

### Rules

- **type**: required, from the table above
- **scope**: required — use domain/module name
  - `auth`, `contract`, `property`, `user`, `database`, `frontend`, `backend`, `api`, `ci`, etc.
- **description**:
  - lowercase, no period, imperative mood ("add" not "added" or "adds")
  - max 72 characters
  - no emoji unless user explicitly requested
- **body**: required, bullet points describing what changed and why
  - one bullet per logical change
  - explain WHAT and WHY, not HOW
  - wrap at 72 characters per line
  - separate from description with blank line
- **footer**: optional, for metadata
  - `BREAKING CHANGE: <description>` — triggers major version
  - `Closes #123` — link issues
  - `Co-authored-by: Name <email>` — credit contributors
- **Breaking changes**: use `!` after scope OR `BREAKING CHANGE:` in footer
  - `feat(api)!: redesign user endpoint response format`
  - OR include `BREAKING CHANGE: response format changed` in footer

## Step 5: Execute Commit

### Single-line (only for trivial changes):

```bash
git commit -m "type(scope): description"
```

### Multi-line (always use this form):

```bash
git commit -m "type(scope): description" -m "$(cat <<'EOF
- add user authentication endpoint
- validate JWT token in middleware

Closes #123
EOF
)"
```

## Prohibitions

- NO "Generated with Claude Code" or any AI attribution markers
- NO emoji in commit message unless user explicitly requested
- NO `git add .` or staging additional files
- NO pushing to remote unless user explicitly asks
- DO NOT refactor unrelated code while committing

## After Commit

Run `git status` to verify success.
