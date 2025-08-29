# Auto Version Bump with Gemini

A reusable GitHub Action that analyzes git changes using Gemini AI and automatically bumps semantic versions based on the type and scope of changes.

## Features

- 🤖 **AI-Powered Analysis**: Uses Google Gemini to intelligently analyze code changes
- 📋 **Smart Changelog Generation**: Automatically generates user-friendly changelogs
- 🔍 **Zero Configuration**: Auto-detects project type and package name from file structure
- 🎯 **Smart Templates**: Built-in templates for TypeScript, React, Python, Go, and more
- 🔧 **Fully Customizable**: Override auto-detection with custom prompts and settings
- 📊 **Rich Reporting**: Detailed summaries and analysis reports
- 🔄 **Dry Run Support**: Test analysis without making changes
- 📦 **Multi-Language**: Supports any project type with intelligent detection

## Quick Start

**Zero configuration - works out of the box:**

```yaml
- name: Auto Version Bump
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

That's it! The action will automatically:

- Detect your project type (TypeScript, React, Python, Go, etc.)
- Find your package name from `package.json`, `setup.py`, `go.mod`, or README
- Identify main files that indicate API changes
- Generate appropriate semantic version analysis
- Create an intelligent changelog describing the changes
- Commit and push the version bump (if needed)

## Auto-Detection

The action intelligently detects your project type by analyzing:

### TypeScript Library

- **Detects**: `tsconfig.json` + `src/index.ts` OR `package.json` with `types` field
- **Package Name**: From `package.json`
- **Main Files**: `src/index.ts`, `src/**/*.ts`, `lib/**/*.ts`

### React Application

- **Detects**: React dependencies OR start scripts with `react-scripts`/`vite`
- **Package Name**: From `package.json`
- **Main Files**: `src/**/*.tsx`, `src/**/*.ts`, `public/**/*`

### Python Package

- **Detects**: `setup.py`, `pyproject.toml`, `requirements.txt`, or `.py` files
- **Package Name**: From `setup.py` or `pyproject.toml` or README title
- **Main Files**: `**/*.py`, `setup.py`, `pyproject.toml`

### Go Module

- **Detects**: `go.mod`, `go.sum`, or `.go` files
- **Package Name**: From `go.mod` module declaration
- **Main Files**: `**/*.go`, `go.mod`, `go.sum`

### Node.js Package

- **Detects**: `package.json` without TypeScript, has `main`/`bin`/`exports`
- **Package Name**: From `package.json`
- **Main Files**: `index.js`, `lib/**/*.js`, `src/**/*.js`

### Generic Project

- **Fallback**: When no specific patterns match
- **Package Name**: From README title or repository name
- **Main Files**: Auto-detected based on directory structure

## All Input Parameters

| Parameter        | Required | Default        | Description                                      |
| ---------------- | -------- | -------------- | ------------------------------------------------ |
| `gemini-api-key` | ✅       | -              | Google Gemini API key                            |
| `project-type`   | ❌       | `auto`         | Project type (auto-detected or specify manually) |
| `package-name`   | ❌       | (auto)         | Package name (auto-detected from project files)  |
| `diff-range`     | ❌       | `HEAD~1..HEAD` | Git diff range to analyze                        |
| `main-files`     | ❌       | (auto)         | Main files that indicate API changes             |
| `custom-prompt`  | ❌       | -              | Custom analysis prompt (overrides templates)     |
| `dry-run`        | ❌       | `false`        | Only analyze without bumping version             |
| `auto-push`      | ❌       | `true`         | Automatically push version bump commit and tag   |

## Outputs

| Output            | Description                                       |
| ----------------- | ------------------------------------------------- |
| `version-bump`    | Recommended bump type (`major`, `minor`, `patch`) |
| `current-version` | Current version before bump                       |
| `new-version`     | New version after bump (if bumped)                |
| `needs-bump`      | Whether version bump was needed                   |
| `version-bumped`  | Whether version was actually bumped               |
| `changelog`       | AI-generated changelog for this version           |

## Usage Examples

### Zero Configuration (Recommended)

```yaml
- name: Auto Version Bump
  id: version
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}

- name: Show generated changelog
  if: steps.version.outputs.version-bumped == 'true'
  run: |
    echo "Generated changelog:"
    echo "${{ steps.version.outputs.changelog }}"

- name: Publish if version bumped
  if: steps.version.outputs.version-bumped == 'true'
  run: npm publish
```

### Override Auto-Detection

```yaml
- name: Auto Version Bump
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    project-type: 'typescript-library' # Override detection
    package-name: '@my-org/my-lib' # Override detection
    main-files: 'src/index.ts,src/api/*.ts' # Override detection
```

### Custom Analysis Prompt

```yaml
- name: Custom Analysis
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    custom-prompt: |
      Analyze this monorepo changes for semantic versioning.

      MAJOR: Breaking changes to any public APIs
      MINOR: New packages or features
      PATCH: Bug fixes and internal changes

      Focus on packages/ directory changes.
```

### Dry Run for Testing

```yaml
- name: Test Version Analysis
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    dry-run: 'true'
```

### Using Changelog in Releases

````yaml
- name: Auto Version Bump
  id: version
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}

- name: Create Release with AI Changelog
  if: steps.version.outputs.version-bumped == 'true'
  uses: actions/create-release@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    tag_name: v${{ steps.version.outputs.new-version }}
    release_name: Release v${{ steps.version.outputs.new-version }}
    body: |
      ## What's Changed

      ${{ steps.version.outputs.changelog }}

      ## Installation

      ```bash
      npm install my-package@${{ steps.version.outputs.new-version }}
      ```
````

### Disable Auto Push

```yaml
- name: Version Bump Only (No Push)
  id: version
  uses: ./.github/actions/auto-version
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
    auto-push: 'false'

# Handle push manually with custom logic
- name: Custom Push Logic
  if: steps.version.outputs.version-bumped == 'true'
  run: |
    echo "Generated changelog: ${{ steps.version.outputs.changelog }}"
    git push origin main
    git push origin "v${{ steps.version.outputs.new-version }}"
```

### Complete Publishing Workflow with Changelog

```yaml
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      # Auto-bump version and generate changelog
      - name: Auto Version Bump
        id: version
        uses: ./.github/actions/auto-version
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          project-type: 'typescript-library'

      # Create GitHub Release with generated changelog
      - name: Create GitHub Release
        if: steps.version.outputs.version-bumped == 'true'
        run: |
          VERSION="${{ steps.version.outputs.new-version }}"
          CHANGELOG="${{ steps.version.outputs.changelog }}"

          RELEASE_NOTES="Version $VERSION is now available!

          ## What's Changed

          ${CHANGELOG}

          ## Installation

          \`\`\`bash
          npm install my-package@$VERSION
          \`\`\`"

          gh release create "v$VERSION" \
            --title "Release v$VERSION" \
            --notes "$RELEASE_NOTES"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Continue with publishing...
      - name: Publish to npm
        if: steps.version.outputs.version-bumped == 'true'
        run: npm publish
```

## Semantic Versioning Rules

The action follows strict semantic versioning (semver.org) rules:

- **MAJOR**: Breaking changes that require users to modify their code
- **MINOR**: New features that are backward-compatible
- **PATCH**: Bug fixes and non-breaking changes

Each project type template defines specific rules for what constitutes each type of change.

## Requirements

1. **Gemini API Key**: Add `GEMINI_API_KEY` to your repository secrets
2. **Node.js**: Action requires Node.js to read `package.json`
3. **Git History**: Requires git history to analyze changes

## Changelog Generation

The action uses a dual AI approach:

1. **Version Analysis**: Determines semantic version bump (major/minor/patch)
2. **Changelog Generation**: Creates user-friendly changelog with:
   - Grouped changes by type (Features, Bug Fixes, etc.)
   - Focus on end-user impact
   - Exclusion of internal changes unless they affect functionality

### Changelog Features

- **AI-Generated**: Uses Gemini to create intelligent, readable changelogs
- **Fallback Safety**: Uses commit messages if AI generation fails
- **Flexible Output**: Raw changelog text that can be formatted as needed
- **User-Focused**: Emphasizes changes that matter to package users

## Error Handling

- Defaults to `patch` if Gemini API fails
- Uses commit messages as changelog fallback
- Validates Gemini responses for expected values
- Graceful fallback behavior ensures workflow continues

## Contributing

This action is designed to be generic and reusable. To add support for new project types, modify the `projectTemplates` object in `action.yml`.
