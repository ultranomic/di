---
description: Commit the current staged changes
model: glm-4.7
---

Commit staged changes with a conventional commit message.

## Single Bash Call (parallel execution)

Run ALL context gathering in ONE command:

```bash
git status --short && git diff --cached --stat && git diff --cached && git log --oneline -5
```

## Commit Format

```
type(scope): description
```

- Types: feat, fix, chore, docs, style, refactor, test, build, ci
- Scope: optional but recommended (backend, frontend, database, etc.)
- Description: lowercase, no period, imperative mood

## Rules

1. NO "Generated with Claude Code" or similar AI markers
2. NO emojis unless user explicitly requested
3. Use HEREDOC for multi-line body:
   ```bash
   git commit -m "type(scope): description" -m "$(cat <<'EOF'
   body line 1
   body line 2
   EOF
   )"
   ```

## After Commit

Run `git status` to verify success.
