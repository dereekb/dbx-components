# Nx Release Migration Guide
This document covers migrating from @jscutlery/semver to Nx's native release system for Nx 22+ projects.

## Overview

The @jscutlery/semver plugin is no longer compatible with Nx 22+. This guide documents the migration to Nx's built-in release functionality, which provides the same capabilities with better integration and active maintenance.

## Prerequisites

- Nx 22+ workspace
- Existing @jscutlery/semver configuration (or its remnants if already removed)
- Understanding of current versioning strategy (fixed vs independent)

## Migration Steps

### 1. Understand Current Setup

Identify the current configuration before making changes:

**Check for @jscutlery/semver usage:**
```bash
# Look for version target in workspace project.json
grep -A 10 '"version"' project.json

# Check if @jscutlery/semver is in dependencies
grep '@jscutlery/semver' package.json
```

**Key information needed:**
- Current version strategy
  - `syncVersions: true` → fixed versioning (all packages share same version)
  - `syncVersions: false` → independent versioning (each package has own version)
- Base branch (usually "main" or "develop")
- Tag prefix (usually "v")
- Commit message format
- Number of publishable packages
- CI/CD configuration

### 2. Configure Nx Release in nx.json

Add the `release` configuration block to nx.json:

```json
"release": {
  "projects": ["tag:publishable"],
  "projectsRelationship": "fixed",
  "version": {
    "conventionalCommits": true
  },
  "releaseTag": {
    "requireSemver": true
  },
  "changelog": {
    "workspaceChangelog": {
      "createRelease": false,
      "file": "{workspaceRoot}/CHANGELOG.md",
      "renderOptions": {
        "authors": false,
        "applyUsernameToAuthors": false,
        "commitReferences": true,
        "versionTitleDate": true
      }
    },
    "projectChangelogs": {
      "createRelease": false,
      "file": "{projectRoot}/CHANGELOG.md",
      "renderOptions": {
        "authors": false,
        "applyUsernameToAuthors": false,
        "commitReferences": true,
        "versionTitleDate": true
      }
    },
    "automaticFromRef": true
  },
  "git": {
    "commit": true,
    "commitMessage": "release($workspace): v{version} release",
    "commitArgs": "--no-verify",
    "tag": true,
    "tagMessage": "v{version}",
    "stageChanges": true
  },
  "releaseTagPattern": "v{version}"
}
```

**Configuration details:**

- **`projects: ["tag:publishable"]`** - Uses the "publishable" tag to identify which packages to release
- **`projectsRelationship: "fixed"`** - All packages share the same version (change to "independent" for separate versioning)
- **`conventionalCommits: true`** - Automatically determines version bump from commit messages (feat:, fix:, etc.)
- **`renderOptions.authors: false`** - Removes emoji headers (🚀 Features) and "❤️ Thank You" sections from changelogs
- **`commitMessage`** - Match your existing commit message format
- **`commitArgs: "--no-verify"`** - Skips git hooks during CI release commits
- **`releaseTagPattern: "v{version}"`** - Match your existing tag format

### 3. Tag Publishable Packages

All packages that should be included in releases need the `publishable` tag in their project.json.

**Find packages with publish targets:**
```bash
npx nx show projects --with-target publish-npmjs
```

**Add publishable tag to each package:**

Update each package's `project.json` file, changing:
```json
"tags": []
```

to:
```json
"tags": ["publishable"]
```

**Automated approach for multiple packages:**
```bash
# Example for common package names
for pkg in util rxjs date model browser nestjs firebase firebase-server zoho zoom dbx-core dbx-web dbx-analytics dbx-form dbx-firebase; do
  sed -i '' 's/"tags": \[\]/"tags": ["publishable"]/' "packages/$pkg/project.json"
done
```

**Verify all packages are tagged:**
```bash
grep -r '"tags": \["publishable"\]' packages/*/project.json | wc -l
```

### 4. Update Workspace project.json

**Remove the old @jscutlery/semver version target:**

Delete this entire block from your workspace `project.json`:
```json
"version": {
  "executor": "@jscutlery/semver:version",
  "options": {
    "baseBranch": "main",
    "tagPrefix": "v",
    "syncVersions": true,
    "commitMessageFormat": "release(${projectName}): v${version} release"
  }
}
```

**Add convenience targets for local testing:**
```json
"release-dry-run": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx nx release --dry-run --verbose"
  }
},
"release": {
  "executor": "nx:run-commands",
  "options": {
    "command": "npx nx release --skip-publish --verbose"
  }
}
```

### 5. Update CI/CD Configuration

#### CircleCI

Update the release job command:

**Before:**
```yaml
- run:
    name: build release
    command: npx nx run --parallel=1 workspace:version
```

**After:**
```yaml
- run:
    name: build release with nx release
    command: npx nx release --skip-publish --verbose
```

**Important notes:**
- `--skip-publish` prevents automatic npm publishing, preserving manual approval workflows
- `--verbose` provides detailed CI logs for debugging
- Keep the rest of the CircleCI workflow unchanged (tag capture, branch merging, npm publishing)

#### GitHub Actions

Update the release workflow:

**Before:**
```yaml
- name: Version
  run: npx nx run --parallel=1 workspace:version
```

**After:**
```yaml
- name: Version and Changelog
  run: npx nx release --skip-publish --verbose
```

### 6. Test the Migration

**Run a dry-run test:**
```bash
npx nx release --dry-run --verbose
```

**Expected output:**
- ✅ Current version detected from git tags (e.g., v12.7.0)
- ✅ New version calculated based on conventional commits
- ✅ List of package.json files that would be updated
- ✅ List of CHANGELOG.md files that would be updated
- ✅ Commit message preview
- ✅ Git tag preview
- ✅ Note that changes were NOT actually written (dry-run)

**Verify configuration:**
```bash
npx nx release --printConfig
```

**Check:**
- Projects count matches expected number of publishable packages
- `projectsRelationship` is "fixed" or "independent" as expected
- `releaseTagPattern` matches your tag format

### 7. First Real Release

After merging migration changes to your development branch:

1. **Trigger release using your existing workflow** (e.g., `./start-release.sh`)

2. **Monitor CI/CD job** for successful completion

3. **Verify results on main branch:**
   ```bash
   git checkout main
   git pull origin main

   # Check commit message format
   git log -1 --oneline
   # Expected: release($workspace): v12.8.0 release

   # Check git tag
   git describe --tags --abbrev=0
   # Expected: v12.8.0

   # Check root package.json version
   grep '"version"' package.json
   # Expected: "version": "12.8.0"

   # Check a sample package version
   grep '"version"' packages/util/package.json
   # Expected: "version": "12.8.0"

   # Check changelogs updated
   head -20 CHANGELOG.md
   head -20 packages/util/CHANGELOG.md
   ```

4. **Test npm publish workflow** (if applicable)
   - Follow your standard approval process
   - Verify packages publish successfully with new version

### 8. Optional: Update CHANGELOG Headers

After successful first release, update CHANGELOG headers to reference Nx Release:

```bash
find . -name "CHANGELOG.md" -not -path "*/node_modules/*" -exec sed -i '' \
  's|This file was generated using \[@jscutlery/semver\].*|This file was generated using [Nx Release](https://nx.dev/features/manage-releases).|' {} \;

git add **/CHANGELOG.md
git commit -m "docs: update CHANGELOG headers to reference Nx Release"
```

## Configuration Options

### Fixed vs Independent Versioning

**Fixed Versioning** (all packages share same version):
```json
"release": {
  "projectsRelationship": "fixed"
}
```

**Independent Versioning** (each package has its own version):
```json
"release": {
  "projectsRelationship": "independent"
}
```

### Custom Commit Message Format

```json
"git": {
  "commitMessage": "chore(release): publish {version}"
}
```

### Disable Workspace Changelog

```json
"changelog": {
  "workspaceChangelog": false,
  "projectChangelogs": {
    "createRelease": false,
    "file": "{projectRoot}/CHANGELOG.md"
  }
}
```

### Custom Tag Pattern

```json
"releaseTagPattern": "release-{version}"
```

## Troubleshooting

### Problem: Nx can't find previous version tag

**Error:** Unable to determine current version or "No previous release found"

**Solution:** Use the `--first-release` flag:
```bash
npx nx release --first-release --dry-run
npx nx release --first-release --version 12.8.0
```

### Problem: Version bump is incorrect (e.g., patch instead of minor)

**Issue:** Nx determines version bump from conventional commit messages.

**Solutions:**
1. Check recent commit messages follow conventional commits format:
   - `feat:` → minor bump (1.2.0 → 1.3.0)
   - `fix:` → patch bump (1.2.0 → 1.2.1)
   - `BREAKING CHANGE:` or `!` → major bump (1.2.0 → 2.0.0)

2. Manually specify version:
   ```bash
   npx nx release --version 13.0.0
   ```

### Problem: Changelogs include emojis and "Thank You" sections

**Solution:** Set `renderOptions.authors: false` in nx.json (already included in config above).

### Problem: CircleCI job fails with "executor not found"

**Issue:** The old `version` target still exists in project.json.

**Solution:** Verify you removed the old `@jscutlery/semver:version` target from workspace project.json.

### Problem: Not all packages are being released

**Issue:** Missing `publishable` tag on some packages.

**Solution:** Verify all packages have the tag:
```bash
npx nx show projects --with-target publish-npmjs
grep -r '"tags": \["publishable"\]' packages/*/project.json
```

## Key Differences from @jscutlery/semver

| Aspect | @jscutlery/semver | Nx Release |
|--------|-------------------|------------|
| **Installation** | External npm package | Built into Nx 22+ |
| **Configuration** | project.json target | nx.json release block |
| **Command** | `nx run workspace:version` | `nx release` |
| **Maintenance** | Community plugin | Official Nx feature |
| **Performance** | Good | Optimized for Nx monorepos |
| **Compatibility** | Up to Nx 21 | Nx 22+ |

## New Capabilities

After migration, these capabilities become available:

1. **Local dry-run testing:**
   ```bash
   npx nx release --dry-run --verbose
   ```

2. **Manual version override:**
   ```bash
   npx nx release --version 13.0.0
   ```

3. **Prerelease versions:**
   ```bash
   npx nx release --preid beta --version prerelease
   ```

4. **Print current configuration:**
   ```bash
   npx nx release --printConfig
   ```

5. **Skip changelog generation:**
   ```bash
   npx nx release --skip-changelog
   ```

6. **First release mode:**
   ```bash
   npx nx release --first-release
   ```

## Additional Resources

- [Nx Release Documentation](https://nx.dev/features/manage-releases)
- [Nx Release Configuration Reference](https://nx.dev/reference/nx-json#release)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Nx Release Recipes](https://nx.dev/recipes/nx-release)

## Summary

The migration from @jscutlery/semver to Nx Release is straightforward and maintains your existing workflow while providing better integration with Nx. The key benefits include:

- Native Nx support (no external dependencies)
- Better performance and reliability
- Active maintenance from the Nx team
- Enhanced features and flexibility
- Consistent with modern Nx best practices
