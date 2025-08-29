Commit the current staged changes following the Conventional Commits specification.

Requirements:

- Use conventional commit format: `type(scope): description`
- Common types: feat, fix, chore, docs, style, refactor, test, build, ci
- Include a detailed commit body when appropriate
- Do not add "Generated with Claude Code" message
- Analyze git diff and recent commits to understand context and maintain consistency
- Use HEREDOC format for multi-line commit messages to ensure proper formatting

Process:

1. Check git status and git diff --cached to understand staged changes
2. Review recent commit messages with git log for style consistency
3. Create appropriate conventional commit message
4. Commit using git commit with proper formatting
5. Do not push unless asked to
