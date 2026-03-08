<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Package Documentation

When working with @dereekb packages, use these resources for quick discovery and detailed guidance.

## Quick Discovery

- **Package catalog:** See [.agent/PACKAGES.md](.agent/PACKAGES.md) for complete package list, dependencies, and "I need to..." quick reference
- **Package skills:** Use skills like `dereekb-util`, `dereekb-rxjs` for detailed module-by-module guidance
- **TypeScript paths:** Check [tsconfig.base.json](tsconfig.base.json) for all available import paths

## Foundational Packages

These packages have no external dependencies and form the foundation of the ecosystem:

- **@dereekb/util** - Pure TypeScript utilities (35 modules: array, string, promise, object, date, etc.)
  - Skill: `dereekb-util`
  - Use for: Data manipulation, async operations, type utilities
- **@dereekb/model** - Data modeling abstractions
  - Use for: Domain models, data transformation, validation
- **@dereekb/date** - Date/time utilities with date-fns
  - Use for: Complex date calculations, timezones, recurrence

## Reactive & Angular Packages

- **@dereekb/rxjs** - RxJS patterns and utilities
  - Skills: `dereekb-rxjs-loading` (LoadingState patterns)
  - Use for: Observable patterns, loading states, filter management
- **@dereekb/dbx-core** - Platform-agnostic Angular utilities
  - Skills: `dbx-core`, `dbx-injection`, `dbx-filter`, `dbx-value-pipes`, `dbx-core-actions`
  - Use for: Angular foundations, router, storage, context
- **@dereekb/dbx-web** - Material Design UI components
  - Skills: `dbx-web-layout`, `dbx-web-actions`
  - Use for: Web UI, layouts, lists, forms
- **@dereekb/dbx-form** - Form components
  - Use for: Complex forms, calendar/mapbox inputs

## Firebase Packages

- **@dereekb/firebase** - Client utilities
  - Skills: `dereekb-firebase-model`, `dereekb-firebase-service`, `dereekb-firebase-snapshot-fields`
  - Use for: Firebase client operations, Firestore access
- **@dereekb/firebase-server** - Backend utilities
  - Use for: Firebase Functions, Admin SDK, server-side operations
- **@dereekb/dbx-firebase** - Angular + Firebase integration
  - Use for: Reactive Firebase UI components

## Backend Packages

- **@dereekb/nestjs** - NestJS utilities and integrations
  - Entry points: main, mailgun, stripe, openai, vapiai, typeform, twilio
  - Use for: NestJS applications, external service integrations
- **@dereekb/browser** - Browser-specific utilities
  - Use for: DOM operations, browser APIs (outside Angular)

## Quick Reference: Finding the Right Package

- **Array/string/object operations** → @dereekb/util
- **Async patterns (promises, delays, limits)** → @dereekb/util (promise module)
- **Reactive patterns (Observables, LoadingState)** → @dereekb/rxjs
- **Date calculations** → @dereekb/date (or @dereekb/util for basic operations)
- **Angular components** → @dereekb/dbx-core (platform-agnostic) or @dereekb/dbx-web (browser-specific)
- **Firebase integration** → @dereekb/firebase (client) or @dereekb/firebase-server (backend)
- **Backend services** → @dereekb/nestjs

## Package Architecture

The packages follow a strict dependency hierarchy:

```
util, model, date (no dependencies)
    ↓
rxjs (depends on util)
    ↓
dbx-core (depends on util, rxjs)
    ↓
dbx-web, dbx-form (depend on dbx-core)
```

Firebase stack runs in parallel:
```
firebase (depends on util, rxjs, model, date)
    ↓
firebase-server (depends on firebase)
    ↓
dbx-firebase (depends on firebase, dbx-core)
```
