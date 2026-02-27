# @dereekb Package Ecosystem

Complete reference for all packages in the DBX Components monorepo.

## Package Categories

### Foundational Utilities (No Dependencies)

**[@dereekb/util](packages/util/)** - Pure TypeScript utilities
- **Path:** `packages/util`
- **Entry Points:** main, test, fetch
- **Modules:** 35 domain-organized modules (array, string, promise, object, date, number, set, map, etc.)
- **Description:** Pure TypeScript utility library with ~1,972 exports providing foundational operations for arrays, strings, promises, objects, and more. No external dependencies.
- **Skills:** [`dereekb-util`](.agent/skills/dereekb-util/)
- **Use When:** You need to manipulate data structures, work with promises, handle types, or perform common operations

**[@dereekb/date](packages/date/)** - Date/time utilities
- **Path:** `packages/date`
- **Dependencies:** date-fns, @dereekb/util
- **Modules:** date, expires, query, rrule, timezone
- **Description:** Advanced date/time utilities built on date-fns, including expiration handling, date queries, recurring rules, and timezone management
- **Use When:** You need complex date calculations, timezone handling, or recurring date patterns

**[@dereekb/model](packages/model/)** - Data modeling abstractions
- **Path:** `packages/model`
- **Dependencies:** @dereekb/util
- **Modules:** data, service, transform, validator
- **Description:** Domain model abstractions, data transformation utilities, and validation patterns
- **Use When:** You need to define domain models, transform data between layers, or validate data structures

### Reactive Programming

**[@dereekb/rxjs](packages/rxjs/)** - RxJS utilities and patterns
- **Path:** `packages/rxjs`
- **Dependencies:** rxjs, @dereekb/util
- **Modules:** filter (FilterMap), iterator, loading (LoadingState), lock, work
- **Description:** RxJS-specific utilities including LoadingState for async state management, FilterMap for filter state, and work queue patterns
- **Skills:** [`dereekb-rxjs-loading`](.agent/skills/dereekb-rxjs-loading/)
- **Use When:** You need reactive patterns, loading state management, or Observable-based operations

### Angular Core (Platform-Agnostic)

**[@dereekb/dbx-core](packages/dbx-core/)** - Foundation Angular utilities
- **Path:** `packages/dbx-core`
- **Dependencies:** @angular/*, @dereekb/util, @dereekb/rxjs
- **Modules:** router, storage, context, auth, injection, filter, pipes, action
- **Description:** Platform-agnostic Angular utilities that work in any Angular environment (web, mobile, SSR). Foundation for all DBX packages.
- **Skills:** [`dbx-core`](.agent/skills/dereekb-dbx-core/), [`dbx-injection`](.agent/skills/dbx-injection/), [`dbx-filter`](.agent/skills/dbx-filter/), [`dbx-value-pipes`](.agent/skills/dbx-value-pipes/), [`dbx-core-actions`](.agent/skills/dbx-core-actions/)
- **Use When:** Building Angular applications, need router abstractions, state management, or base components

### Angular Web (Browser-Specific)

**[@dereekb/dbx-web](packages/dbx-web/)** - Web UI components
- **Path:** `packages/dbx-web`
- **Entry Points:** main, calendar, mapbox, table
- **Dependencies:** @angular/material, @dereekb/dbx-core
- **Description:** Browser-specific Material Design UI components including layouts, lists, forms, and specialized extensions for calendar, mapbox, and tables
- **Skills:** [`dbx-web-layout`](.agent/skills/dbx-web-layout/), [`dbx-web-actions`](.agent/skills/dbx-web-actions/)
- **Use When:** Building web UIs with Material Design, need layout components, or specialized visual components

**[@dereekb/dbx-form](packages/dbx-form/)** - Form components
- **Path:** `packages/dbx-form`
- **Entry Points:** main, calendar, mapbox
- **Dependencies:** @angular/forms, @dereekb/dbx-core, @dereekb/dbx-web
- **Description:** Angular form components with specialized extensions for calendar and mapbox inputs
- **Use When:** Building complex forms, need calendar pickers, or mapbox location inputs

**[@dereekb/dbx-analytics](packages/dbx-analytics/)** - Analytics integration
- **Path:** `packages/dbx-analytics`
- **Dependencies:** @dereekb/dbx-core
- **Description:** Analytics integration utilities for Angular applications
- **Use When:** You need to track user interactions or integrate analytics services

### Firebase

**[@dereekb/firebase](packages/firebase/)** - Firebase client utilities
- **Path:** `packages/firebase`
- **Entry Points:** main, test
- **Dependencies:** firebase, @dereekb/util, @dereekb/rxjs, @dereekb/model, @dereekb/date
- **Description:** Firebase/Firestore client utilities for authentication, data access, and real-time subscriptions
- **Skills:** [`dereekb-firebase-model`](.agent/skills/dereekb-firebase-model/), [`dereekb-firebase-service`](.agent/skills/dereekb-firebase-service/), [`dereekb-firebase-snapshot-fields`](.agent/skills/dereekb-firebase-snapshot-fields/)
- **Use When:** Building Firebase client applications, accessing Firestore, or managing Firebase authentication

**[@dereekb/firebase-server](packages/firebase-server/)** - Firebase backend utilities
- **Path:** `packages/firebase-server`
- **Entry Points:** main, mailgun, model, test, zoho
- **Dependencies:** firebase-admin, @dereekb/firebase, @dereekb/nestjs (optional)
- **Description:** Firebase Functions and Admin SDK utilities for server-side operations, including Mailgun email, model operations, and Zoho integration
- **Use When:** Building Firebase Functions, server-side Firebase operations, or backend integrations

**[@dereekb/dbx-firebase](packages/dbx-firebase/)** - Angular + Firebase integration
- **Path:** `packages/dbx-firebase`
- **Dependencies:** @angular/fire, @dereekb/firebase, @dereekb/dbx-core, @dereekb/dbx-web
- **Description:** Angular components and services that integrate Firebase with DBX components
- **Use When:** Building Angular applications with Firebase, need reactive Firebase UI components

### Backend & Integration

**[@dereekb/nestjs](packages/nestjs/)** - NestJS utilities
- **Path:** `packages/nestjs`
- **Entry Points:** main, mailgun, stripe, vapiai, openai, typeform, twilio
- **Dependencies:** @nestjs/*, @dereekb/util, @dereekb/model
- **Description:** NestJS framework utilities and service integrations for Mailgun, Stripe, OpenAI, VapiAI, Typeform, and Twilio
- **Use When:** Building NestJS applications or integrating external services

**[@dereekb/browser](packages/browser/)** - Browser-specific utilities
- **Path:** `packages/browser`
- **Dependencies:** @dereekb/util
- **Description:** Browser-specific utilities for DOM manipulation, storage, and browser APIs
- **Use When:** You need browser-specific operations outside of Angular

**[@dereekb/zoho](packages/zoho/)** - Zoho CRM integration
- **Path:** `packages/zoho`
- **Entry Points:** main, nestjs
- **Dependencies:** @dereekb/util
- **Description:** Zoho CRM API client and NestJS integration
- **Use When:** Integrating with Zoho CRM

**[@dereekb/zoom](packages/zoom/)** - Zoom integration
- **Path:** `packages/zoom`
- **Entry Points:** main, nestjs
- **Dependencies:** @dereekb/util
- **Description:** Zoom API client and NestJS integration
- **Use When:** Integrating with Zoom meetings or webhooks

## Package Dependency Architecture

The packages follow a strict layered architecture:

```
┌─────────────────────────────────────────┐
│ Foundation Layer (No Dependencies)       │
│  • @dereekb/util                        │
│  • @dereekb/model                       │
│  • @dereekb/date                        │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────┐
│ Reactive Layer                          │
│  • @dereekb/rxjs                       │
│    (depends on: util)                   │
└────────────────┬───────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────┐
│ Angular Core Layer                      │
│  • @dereekb/dbx-core                   │
│    (depends on: util, rxjs)            │
└────────────────┬───────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────┐
│ Angular Web Layer                       │
│  • @dereekb/dbx-web                    │
│  • @dereekb/dbx-form                   │
│  • @dereekb/dbx-analytics              │
│    (depends on: dbx-core)              │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Firebase Stack (Parallel)               │
│  @dereekb/firebase                     │
│  (depends on: util, rxjs, model, date) │
│         ↓                               │
│  @dereekb/firebase-server              │
│  (depends on: firebase)                 │
│         ↓                               │
│  @dereekb/dbx-firebase                 │
│  (depends on: firebase, dbx-core)      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Backend & Integration (Parallel)        │
│  • @dereekb/nestjs                     │
│  • @dereekb/browser                    │
│  • @dereekb/zoho, @dereekb/zoom        │
│    (depends on: util, model)           │
└────────────────────────────────────────┘
```

## Quick Reference: I need to...

### Data Manipulation
- **Manipulate arrays** (filter, map, unique, flatten) → [@dereekb/util](#deereekbutil) (array module)
- **Work with strings** (join, split, encode, case conversion) → [@dereekb/util](#deereekbutil) (string module)
- **Handle objects** (merge, filter, equality, mapping) → [@dereekb/util](#deereekbutil) (object module)
- **Work with sets/maps** → [@dereekb/util](#deereekbutil) (set, map modules)

### Async & Control Flow
- **Promise utilities** (delays, limits, loops, tasks) → [@dereekb/util](#deereekbutil) (promise module)
- **Observable patterns** → [@dereekb/rxjs](#deereekbrxjs)
- **Loading state management** → [@dereekb/rxjs](#deereekbrxjs) (LoadingState)
- **Work queues** → [@dereekb/rxjs](#deereekbrxjs) (work module)

### Date & Time
- **Basic date operations** (unix time, expiration, ranges) → [@dereekb/util](#deereekbutil) (date module)
- **Complex date calculations** (timezone, recurrence, queries) → [@dereekb/date](#deereekbdate)

### Type System & Values
- **Type guards** (isObject, isString, isMaybe) → [@dereekb/util](#deereekbutil) (type, value modules)
- **Maybe types** (optional values) → [@dereekb/util](#deereekbutil) (value module)
- **Getter patterns** (lazy evaluation, caching) → [@dereekb/util](#deereekbutil) (getter module)

### Domain Modeling
- **Model abstractions** → [@dereekb/model](#deereekbmodel)
- **Data transformation** → [@dereekb/model](#deereekbmodel) (transform module)
- **Validation** → [@dereekb/model](#deereekbmodel) (validator module)

### Angular Development
- **Platform-agnostic components** → [@dereekb/dbx-core](#deereekbdbx-core)
- **Dynamic component injection** → [@dereekb/dbx-core](#deereekbdbx-core) (injection module)
- **Filter state management** → [@dereekb/dbx-core](#deereekbdbx-core) (filter module)
- **Web UI with Material Design** → [@dereekb/dbx-web](#deereekbdbx-web)
- **Complex forms** → [@dereekb/dbx-form](#deereekbdbx-form)
- **Router abstractions** → [@dereekb/dbx-core](#deereekbdbx-core) (router module)

### Firebase
- **Firebase client operations** → [@dereekb/firebase](#deereekbfirebase)
- **Firebase Functions/Admin** → [@dereekb/firebase-server](#deereekbfirebase-server)
- **Angular + Firebase UI** → [@dereekb/dbx-firebase](#deereekbdbx-firebase)

### Backend Development
- **NestJS applications** → [@dereekb/nestjs](#deereekbnestjs)
- **Email (Mailgun)** → [@dereekb/nestjs](#deereekbnestjs) or [@dereekb/firebase-server](#deereekbfirebase-server) (mailgun entry point)
- **Payments (Stripe)** → [@dereekb/nestjs](#deereekbnestjs) (stripe entry point)
- **AI (OpenAI, Vapi)** → [@dereekb/nestjs](#deereekbnestjs) (openai, vapiai entry points)

### External Integrations
- **Zoho CRM** → [@dereekb/zoho](#deereekbzoho)
- **Zoom** → [@dereekb/zoom](#deereekbzoom)

## Available Skills

Skills provide detailed implementation guidance. See [.agent/skills/README.md](.agent/skills/README.md) for complete list.

### Foundational Package Skills
- `dereekb-util` - Pure TypeScript utilities overview

### DBX Core Skills
- `dbx-core` - DBX core overview
- `dbx-injection` - Dynamic component injection
- `dbx-filter` - Filter state management
- `dbx-value-pipes` - Value transformation pipes
- `dbx-core-actions` - Action system

### DBX Web Skills
- `dbx-web-layout` - Layout components
- `dbx-web-actions` - Web-specific actions

### Firebase Skills
- `dereekb-firebase-model` - Firebase model patterns
- `dereekb-firebase-service` - Firebase service utilities
- `dereekb-firebase-snapshot-fields` - Snapshot field handling
- `dereekb-rxjs-loading` - LoadingState patterns

## Import Paths

All packages are available via TypeScript path mappings (see `tsconfig.base.json`):

```typescript
// Foundational
import { convertToArray } from '@dereekb/util';
import { LoadingState } from '@dereekb/rxjs';
import { DateRange } from '@dereekb/date';
import { ModelKey } from '@dereekb/model';

// Angular
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { DbxActionComponent } from '@dereekb/dbx-web';
import { DbxFormComponent } from '@dereekb/dbx-form';

// Firebase
import { FirestoreContext } from '@dereekb/firebase';
import { FirebaseFunctionMap } from '@dereekb/firebase-server';
import { DbxFirebaseAuthService } from '@dereekb/dbx-firebase';

// Backend
import { NestjsService } from '@dereekb/nestjs';

// Sub-packages with specific entry points
import { FetchError } from '@dereekb/util/fetch';
import { itShouldFail } from '@dereekb/util/test';
import { MailgunService } from '@dereekb/firebase-server/mailgun';
import { ZohoClient } from '@dereekb/zoho';
```

## Package Publishing

38 publishable packages are released to npm under the `@dereekb/*` scope:
- All packages version synchronized (currently v12.7.0)
- Release process uses `nx release` with conventional commits
- All packages use peer dependencies (not bundled)

## Additional Resources

- **Workspace Configuration:** See [CLAUDE.md](CLAUDE.md) for Nx-specific guidelines
- **Model Patterns:** See [wiki/Models.md](wiki/Models.md) for Firestore model structure
- **Service Patterns:** See [wiki/ServiceFile.md](wiki/ServiceFile.md) for service layer patterns
- **Version History:** See [CHANGELOG.md](CHANGELOG.md) and package-specific CHANGELOGs
- **Migration Guide:** See [VERSION_MIGRATION.md](VERSION_MIGRATION.md) for breaking changes
