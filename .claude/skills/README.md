# Available Skills

Index of all agent skills available in the DBX Components workspace.

## How to Use Skills

Skills provide specialized knowledge and implementation guidance for specific packages or features. Reference a skill by name (e.g., `dereekb-util`) to get detailed documentation.

## Quick Navigation

- **Need foundational utilities?** → See [Foundational Package Skills](#foundational-package-skills)
- **Building Angular components?** → See [DBX Core Skills](#dbx-angular-core-skills) and [DBX Web Skills](#dbx-angular-web-skills)
- **Working with Firebase?** → See [Firebase Skills](#firebase-integration-skills)
- **Nx workspace tasks?** → See [Workflow Skills](#workflow-skills)

## Foundational Package Skills

### `dereekb-util`
**Package:** [@dereekb/util](../../packages/util/)
**Description:** Pure TypeScript utilities with 35 modules for array, string, promise, object, date manipulation and more. No external dependencies.
**Use When:** You need data structure manipulation, async operations, type utilities, or common operations
**Topics:** Arrays, strings, promises, objects, values, sets, maps, dates, numbers, models, auth, contact info

### `dereekb-rxjs` *(planned)*
**Package:** [@dereekb/rxjs](../../packages/rxjs/)
**Description:** RxJS-specific utilities and patterns
**Use When:** You need Observable patterns, reactive state management
**See Also:** `dereekb-rxjs-loading` for LoadingState details

### `dereekb-model` *(planned)*
**Package:** [@dereekb/model](../../packages/model/)
**Description:** Data modeling abstractions, transformations, and validation
**Use When:** You need domain models, data transformation, or validation patterns

### `dereekb-date` *(planned)*
**Package:** [@dereekb/date](../../packages/date/)
**Description:** Advanced date/time utilities with date-fns integration
**Use When:** You need complex date calculations, timezones, or recurrence patterns

## DBX Angular Core Skills

### `dbx-core`
**Package:** [@dereekb/dbx-core](../../packages/dbx-core/)
**Description:** Overview of platform-agnostic Angular utilities package
**Use When:** Working with dbx-core components, need router/storage/context guidance
**Topics:** Router, storage, context, authentication, environment services

### `dbx-injection`
**Package:** [@dereekb/dbx-core](../../packages/dbx-core/) (injection module)
**Description:** Dynamic component injection system for runtime component display
**Use When:** Displaying components in dialogs, temporary contexts, or dynamic content areas
**Key Components:** `DbxInjectionComponent`, `DbxInjectionContextDirective`

### `dbx-filter`
**Package:** [@dereekb/dbx-core](../../packages/dbx-core/) (filter module)
**Description:** Reactive filter state management for sharing filter state across components
**Use When:** Building filterable lists/tables, search interfaces, or filter presets
**Key Components:** `FilterMap`, filter sources and connectors

### `dbx-value-pipes`
**Package:** [@dereekb/dbx-core](../../packages/dbx-core/) (pipes)
**Description:** Angular pipes for value transformation in templates
**Use When:** Need text truncation, currency formatting, getter resolution, date ranges
**Key Pipes:** `cutText`, `getValue`, `dollarAmount`, `dateDayRange`

### `dbx-core-actions`
**Package:** [@dereekb/dbx-core](../../packages/dbx-core/) (action module)
**Description:** Action system for user interactions and commands
**Use When:** Building action-based UIs, command patterns, or user interaction flows

## DBX Angular Web Skills

### `dbx-web-layout`
**Package:** [@dereekb/dbx-web](../../packages/dbx-web/)
**Description:** Layout components and page structure utilities
**Use When:** Building web layouts, page structures, or responsive designs
**Topics:** Material Design layouts, responsive grids, page templates

### `dbx-web-actions`
**Package:** [@dereekb/dbx-web](../../packages/dbx-web/)
**Description:** Web-specific action components and interactions
**Use When:** Building action buttons, menus, or web-specific user interactions

## Firebase Integration Skills

### `dereekb-firebase-model`
**Package:** [@dereekb/firebase](../../packages/firebase/)
**Description:** Firebase model patterns for Firestore documents
**Use When:** Defining Firestore models, understanding model structure (.id.ts, .ts, .api.ts pattern)
**Topics:** Model definitions, converters, document references
**See Also:** [wiki/Models.md](../../wiki/Models.md) for detailed model patterns

### `dereekb-firebase-service`
**Package:** [@dereekb/firebase](../../packages/firebase/)
**Description:** Firebase service utilities for data access
**Use When:** Creating Firebase services, accessing Firestore, managing collections
**Topics:** Service layer patterns, CRUD operations, queries

### `dereekb-firebase-snapshot-fields`
**Package:** [@dereekb/firebase](../../packages/firebase/)
**Description:** Snapshot field handling for Firestore documents
**Use When:** Working with Firestore snapshot fields, server timestamps, computed fields
**Topics:** Field transformations, snapshot utilities

### `dereekb-rxjs-loading`
**Package:** [@dereekb/rxjs](../../packages/rxjs/)
**Description:** LoadingState pattern for async state management
**Use When:** Managing loading states, async operations, or data fetching states
**Key Concepts:** `LoadingState`, `LoadingStateContext`, `loadingStateFromObs`
**Common Use:** Firebase data loading, API calls, async form submissions

## Release & Git Workflow Skills

### `merge-release`
**Description:** Merge main branch changes back into develop after a release
**Use When:** A release has been published and main needs to be merged back into develop
**Scripts:** `start-merge-in-main.sh`, `end-merge-in-main.sh`, `make-dev-tag.sh`

### `dbx-commit-messages`
**Description:** Commit message conventions for the workspace
**Use When:** Writing commit messages, understanding commit format rules

## Workflow Skills

Workflow skills help with Nx-specific tasks and are located in `.gemini/skills/` and `.opencode/skills/` directories:

### `nx-workspace`
**Description:** Workspace navigation patterns for querying projects, targets, and dependencies
**Use When:** Exploring the Nx workspace, understanding project structure

### `nx-generate`
**Description:** Scaffolding and generator patterns for creating apps, libs, and components
**Use When:** Creating new projects, libraries, or components

### `nx-run-tasks`
**Description:** Task execution patterns for build, test, lint, and other operations
**Use When:** Running tasks across the workspace

### `monitor-ci`
**Description:** CI monitoring and build status checking
**Use When:** Checking CI/CD pipeline status

### `link-workspace-packages`
**Description:** Local package linking for development
**Use When:** Linking packages locally for testing

### `nx-plugins`
**Description:** Nx plugin management and customization
**Use When:** Working with Nx plugins or creating custom plugins

## Package Coverage Overview

**Skills Available (11 total):**
- ✅ Foundational: `dereekb-util`
- ✅ DBX Core: `dbx-core`, `dbx-injection`, `dbx-filter`, `dbx-value-pipes`, `dbx-core-actions`
- ✅ DBX Web: `dbx-web-layout`, `dbx-web-actions`
- ✅ Firebase: `dereekb-firebase-model`, `dereekb-firebase-service`, `dereekb-firebase-snapshot-fields`
- ✅ RxJS: `dereekb-rxjs-loading`

**Skills Planned:**
- 🔜 `dereekb-rxjs` - RxJS utilities overview
- 🔜 `dereekb-model` - Model abstractions
- 🔜 `dereekb-date` - Date/time utilities

**Packages Without Dedicated Skills:**
- @dereekb/dbx-form - Form components (general Angular/Material knowledge applies)
- @dereekb/dbx-analytics - Analytics integration
- @dereekb/dbx-firebase - Angular + Firebase (use firebase + dbx-core skills)
- @dereekb/firebase-server - Backend Firebase utilities
- @dereekb/nestjs - NestJS utilities and integrations
- @dereekb/browser - Browser utilities
- @dereekb/zoho, @dereekb/zoom - External service integrations

## Finding the Right Skill

### By Task

**I need to...**
- Manipulate arrays/strings → `dereekb-util`
- Handle async operations → `dereekb-util` (promise module)
- Manage loading states → `dereekb-rxjs-loading`
- Build Angular components → `dbx-core` or `dbx-web-layout`
- Inject components dynamically → `dbx-injection`
- Add filters to lists → `dbx-filter`
- Transform values in templates → `dbx-value-pipes`
- Work with Firebase models → `dereekb-firebase-model`
- Access Firestore data → `dereekb-firebase-service`
- Create/scaffold projects → `nx-generate`
- Run builds/tests → `nx-run-tasks`

### By Package

**Working with package X? Check these skills:**
- @dereekb/util → `dereekb-util`
- @dereekb/rxjs → `dereekb-rxjs-loading` (LoadingState), `dereekb-rxjs` *(planned)* (general)
- @dereekb/dbx-core → `dbx-core`, `dbx-injection`, `dbx-filter`, `dbx-value-pipes`, `dbx-core-actions`
- @dereekb/dbx-web → `dbx-web-layout`, `dbx-web-actions`
- @dereekb/firebase → `dereekb-firebase-model`, `dereekb-firebase-service`, `dereekb-firebase-snapshot-fields`

## Additional Resources

- **[.agent/PACKAGES.md](../PACKAGES.md)** - Complete package catalog with quick reference
- **[CLAUDE.md](../../CLAUDE.md)** - Workspace configuration and guidelines
- **[wiki/Models.md](../../wiki/Models.md)** - Firestore model structure guide
- **[wiki/ServiceFile.md](../../wiki/ServiceFile.md)** - Service layer patterns

## Contributing Skills

Skills follow this structure:
```markdown
---
name: skill-name
description: Brief description of what the skill covers
---

# Skill Title

## Overview
[Package info, key features]

## Module/Feature Organization
[Organized sections with examples]

## Common Patterns
[Real-world usage examples]

## Best Practices
[Do's and don'ts]

## Related Packages/Skills
[Cross-references]
```

See existing skills in this directory for examples.
