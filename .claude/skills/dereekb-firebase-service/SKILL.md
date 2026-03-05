# @dereekb/firebase Service

Guide for the `service.ts` file pattern that integrates Firestore models into a centralized service layer with role-based access control. This file is a core component that enables the same permission logic to work on both frontend and backend.

## Overview

The `service.ts` file serves as the integration point where all Firestore models are wired together with their permission logic. This file is unique in that the context types and service definitions it creates are used on **both frontend and backend**, allowing consistent role checking across your entire application.

**Key Concept:** The same `DemoFirebaseContext` type and role-checking logic works in your Angular app and your Cloud Functions, enabling the frontend to determine what actions a user can perform using the exact same code that enforces those permissions on the backend.

## File Structure

A typical `service.ts` file contains:

1. **Collections Interface & Factory** - Central registry of all Firestore collections
2. **Service Factories** - Role mapping logic for each model
3. **Service Aggregation** - Combining all services into a unified registry
4. **Context Types** - Shared types used across frontend and backend

```typescript
// Example structure:
export abstract class DemoFirestoreCollections { ... }
export function makeDemoFirestoreCollections() { ... }

export const guestbookFirebaseModelServiceFactory = { ... }
export const profileFirebaseModelServiceFactory = { ... }
// ... more service factories

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = { ... }
export const demoFirebaseModelServices = firebaseModelsService(...);

export type DemoFirebaseContext = ...
```

> **Note:** "Demo" is used as the project prefix throughout these examples. Replace "Demo" with your own project name (e.g., "MyApp" → `MyAppFirestoreCollections`, `MyAppFirebaseContext`).

## 1. Collections Interface & Factory

### Abstract Collections Class

The abstract class defines all collections your application uses, implementing the collection interfaces from each model:

```typescript
import {
  type FirestoreContext,
  type FirestoreContextReference
} from '@dereekb/firebase';
import {
  type GuestbookFirestoreCollections,
  type ProfileFirestoreCollections,
  type SystemStateFirestoreCollections
} from './[model]';

export abstract class DemoFirestoreCollections
  implements
    FirestoreContextReference,
    GuestbookFirestoreCollections,
    ProfileFirestoreCollections,
    SystemStateFirestoreCollections {

  abstract readonly firestoreContext: FirestoreContext;

  // Root collections
  abstract readonly systemStateCollection: SystemStateFirestoreCollection;
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
  abstract readonly profileCollection: ProfileFirestoreCollection;

  // Subcollection factories
  abstract readonly guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;

  // Collection groups
  abstract readonly guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
}
```

**Key points:**
- Implements `FirestoreContextReference` for context access
- Implements each model's collection interface (e.g., `GuestbookFirestoreCollections`)
- Includes root collections, subcollection factories, and collection groups
- All properties are abstract - implementation comes from the factory

### Collections Factory Function

The factory function creates a concrete implementation:

```typescript
export function makeDemoFirestoreCollections(
  firestoreContext: FirestoreContext
): DemoFirestoreCollections {
  return {
    firestoreContext,
    systemStateCollection: systemStateFirestoreCollection(firestoreContext),
    guestbookCollection: guestbookFirestoreCollection(firestoreContext),
    guestbookEntryCollectionFactory: guestbookEntryFirestoreCollectionFactory(firestoreContext),
    guestbookEntryCollectionGroup: guestbookEntryFirestoreCollectionGroup(firestoreContext),
    profileCollection: profileFirestoreCollection(firestoreContext),
    // ... initialize all collections
  };
}
```

**Pattern:** Each collection is initialized by calling its factory function from the model definition, passing in the `FirestoreContext`.

## 2. Service Factories

Each model needs a service factory that defines its permission logic using `firebaseModelServiceFactory`:

```typescript
import {
  firebaseModelServiceFactory,
  type FirebasePermissionServiceModel
} from '@dereekb/firebase';
import { type PromiseOrValue } from '@dereekb/util';
import { type GrantedRoleMap } from '@dereekb/model';

export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<
  DemoFirebaseContext,    // Your application's context type
  Guestbook,               // Model interface
  GuestbookDocument,       // Document class
  GuestbookRoles          // Roles union type
>({
  roleMapForModel: function (
    output: FirebasePermissionServiceModel<Guestbook, GuestbookDocument>,
    context: DemoFirebaseContext,
    model: GuestbookDocument
  ): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    // Role mapping logic here
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});
```

### Type Parameters

The four type parameters are:

1. **Context** (`DemoFirebaseContext`) - Your application's Firebase context type (shared frontend/backend)
2. **Model** (`Guestbook`) - The model interface
3. **Document** (`GuestbookDocument`) - The document class that wraps the model
4. **Roles** (`GuestbookRoles`) - Union type of role strings (e.g., `'read' | 'update' | 'delete'`)

### Configuration

Two required properties:

#### `roleMapForModel`

Function that determines what roles the current user has for a specific model instance.

**Inputs:**
- `output: FirebasePermissionServiceModel<Model, Document>` - Service model helpers
- `context: DemoFirebaseContext` - Current user context (auth, claims, etc.)
- `model: Document` - The specific document instance being accessed

**Returns:** `PromiseOrValue<GrantedRoleMap<Roles>>` - Object mapping role names to `true`/`false`

**Example return values:**
```typescript
// Full access
{ read: true, update: true, delete: true, create: true }

// Limited access
{ read: true, like: true }

// No access
{}
```

#### `getFirestoreCollection`

Function that retrieves the appropriate collection from context.

```typescript
getFirestoreCollection: (c) => c.app.guestbookCollection
```

For collection groups (subcollections queried across all parents):
```typescript
getFirestoreCollection: (c) => c.app.guestbookEntryCollectionGroup
```

### Role Mapping Helpers

The `@dereekb/firebase` package provides helper functions for common permission patterns:

```typescript
import {
  grantFullAccessIfAdmin,
  grantFullAccessIfAuthUserRelated,
  grantModelRolesIfAdmin
} from '@dereekb/firebase';
```

#### `grantFullAccessIfAdmin(context)`

Returns all permissions if user is admin, otherwise no permissions.

```typescript
roleMapForModel: function (output, context, model) {
  return grantFullAccessIfAdmin(context);
}
```

#### `grantFullAccessIfAuthUserRelated({ context, document })`

Returns all permissions if user owns the document (matching UID), otherwise no permissions.

```typescript
roleMapForModel: function (output, context, model) {
  return grantFullAccessIfAuthUserRelated({ context, document: model });
}
```

#### `grantModelRolesIfAdmin(context, adminRoles, otherwise?)`

Returns specific roles for admins, with optional fallback logic for non-admins.

```typescript
roleMapForModel: function (output, context, model) {
  return grantModelRolesIfAdmin(
    context,
    fullAccessRoleMap(),
    () => {
      // Non-admin logic
      return { read: true };
    }
  );
}
```

#### Custom Logic

You can implement any permission logic you need:

```typescript
roleMapForModel: async function (output, context, model) {
  // Check admin
  if (context.auth?.admin) {
    return fullAccessRoleMap();
  }

  // Check ownership
  if (context.auth?.uid === model.data.uid) {
    return { read: true, update: true, delete: true };
  }

  // Check public visibility
  if (model.data.isPublic) {
    return { read: true };
  }

  // No access
  return {};
}
```

**Helper functions for building role maps:**
```typescript
import {
  fullAccessRoleMap,
  grantedRoleKeysMapFromArray
} from '@dereekb/model';

// All permissions
const allRoles = fullAccessRoleMap();

// Specific permissions from array
const roles = grantedRoleKeysMapFromArray(['read', 'update']);
// Returns: { read: true, update: true }
```

## 3. Service Aggregation

### Model Types Union

Combine all model type identities into a single union type:

```typescript
import { type GuestbookTypes } from './guestbook';
import { type ProfileTypes } from './profile';
import { type SystemStateTypes } from './system/system';

export type DemoFirebaseModelTypes =
  | SystemStateTypes
  | GuestbookTypes
  | ProfileTypes
  | NotificationTypes
  | StorageFileTypes;
```

**Pattern:** Each model exports a `*Types` type (e.g., `GuestbookTypes`) that combines the identities of the model and its subcollections. Union all of these together.

### Service Factory Registry

Create an object containing all service factories:

```typescript
export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  guestbook: guestbookFirebaseModelServiceFactory,
  guestbookEntry: guestbookEntryFirebaseModelServiceFactory,
  profile: profileFirebaseModelServiceFactory,
  profilePrivate: profilePrivateDataFirebaseModelServiceFactory,
  notificationUser: notificationUserFirebaseModelServiceFactory,
  storageFile: storageFileFirebaseModelServiceFactory
  // ... all service factories
};

export type DemoFirebaseModelServiceFactories = typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES;
```

**Key points:**
- Object keys should be camelCase model names
- Include service factories for both root collections and subcollections
- Export the type for use in context definitions

### Main Service Initialization

Initialize the unified models service:

```typescript
import { firebaseModelsService } from '@dereekb/firebase';

export const demoFirebaseModelServices = firebaseModelsService<
  DemoFirebaseModelServiceFactories,
  DemoFirebaseBaseContext,
  DemoFirebaseModelTypes
>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);
```

This creates the service that manages all model permissions and provides the core functionality used by both frontend and backend.

## 4. Context Types (Frontend & Backend Shared)

### Context Type Hierarchy

The context types are structured in layers:

```typescript
import { type FirebaseAppModelContext } from '@dereekb/firebase';

// 1. App context = collections
export type DemoFirebaseContextAppContext = DemoFirestoreCollections;

// 2. Base context = Firebase app context with collections
export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirebaseContextAppContext>;

// 3. Full context = base + services
export type DemoFirebaseContext = DemoFirebaseBaseContext & {
  service: DemoFirebaseModelServiceFactories;
};
```

**Type breakdown:**

1. **`DemoFirebaseContextAppContext`** - Your collections interface
2. **`DemoFirebaseBaseContext`** - Firebase app model context with your collections
   - Includes: `app: DemoFirestoreCollections`, `auth`, `claims`, etc.
3. **`DemoFirebaseContext`** - Complete context with service factories
   - Everything from base + `service` property with all model services

### Frontend & Backend Usage

**This is a core feature of @dereekb/firebase:** The same context type is used on both frontend and backend, enabling consistent permission checking.

#### Frontend Usage (Angular)

```typescript
import { DemoFirebaseContext } from '@demo-firebase/model/service';

@Injectable()
export class GuestbookService {
  constructor(
    @Inject(FIREBASE_CONTEXT_TOKEN) private context: DemoFirebaseContext
  ) {}

  async canUserEditGuestbook(guestbook: GuestbookDocument): Promise<boolean> {
    // Same role checking logic as backend!
    const roles = await this.context.service.guestbook.roleMapForModel(
      /* output */ {},
      this.context,
      guestbook
    );
    return roles.update === true;
  }
}
```

#### Backend Usage (Cloud Functions)

```typescript
import { DemoFirebaseContext } from '@demo-firebase/model/service';

export const updateGuestbook = onCallWithContext<DemoFirebaseContext>(
  async (params, context) => {
    const guestbook = await loadGuestbook(params.id);

    // Same role checking logic as frontend!
    const roles = await context.service.guestbook.roleMapForModel(
      /* output */ {},
      context,
      guestbook
    );

    if (!roles.update) {
      throw new ForbiddenError('No permission to update');
    }

    // Perform update...
  }
);
```

**Key benefit:** The frontend can determine what UI to show (hide/disable buttons) using the exact same permission logic that the backend will enforce. No duplicate code, no permission logic drift between frontend and backend.

### Context Properties

The `DemoFirebaseContext` (via `FirebaseAppModelContext`) includes:

- **`app`** - Your collections (`DemoFirestoreCollections`)
- **`auth`** - Current user auth info (`{ uid, email, admin, ... }`)
- **`claims`** - Custom user claims from Firebase Auth
- **`service`** - All model service factories
- Additional Firebase context properties

## 5. Complete Example

Here's a minimal complete `service.ts` file:

```typescript
import {
  type CollectionReference,
  type FirestoreContext,
  type FirestoreContextReference,
  firebaseModelServiceFactory,
  firebaseModelsService,
  type FirebaseAppModelContext,
  grantFullAccessIfAdmin,
  grantFullAccessIfAuthUserRelated
} from '@dereekb/firebase';
import { type PromiseOrValue } from '@dereekb/util';
import { type GrantedRoleMap } from '@dereekb/model';
import {
  type GuestbookFirestoreCollections,
  type Guestbook,
  type GuestbookDocument,
  type GuestbookRoles,
  type GuestbookTypes,
  guestbookFirestoreCollection
} from './guestbook';

// 1. Collections Interface
export abstract class DemoFirestoreCollections
  implements FirestoreContextReference, GuestbookFirestoreCollections {
  abstract readonly firestoreContext: FirestoreContext;
  abstract readonly guestbookCollection: GuestbookFirestoreCollection;
}

// 2. Collections Factory
export function makeDemoFirestoreCollections(
  firestoreContext: FirestoreContext
): DemoFirestoreCollections {
  return {
    firestoreContext,
    guestbookCollection: guestbookFirestoreCollection(firestoreContext)
  };
}

// 3. Service Factory
export const guestbookFirebaseModelServiceFactory = firebaseModelServiceFactory<
  DemoFirebaseContext,
  Guestbook,
  GuestbookDocument,
  GuestbookRoles
>({
  roleMapForModel: function (output, context, model): PromiseOrValue<GrantedRoleMap<GuestbookRoles>> {
    return grantFullAccessIfAdmin(context);
  },
  getFirestoreCollection: (c) => c.app.guestbookCollection
});

// 4. Service Aggregation
export type DemoFirebaseModelTypes = GuestbookTypes;

export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  guestbook: guestbookFirebaseModelServiceFactory
};

export type DemoFirebaseModelServiceFactories = typeof DEMO_FIREBASE_MODEL_SERVICE_FACTORIES;

export const demoFirebaseModelServices = firebaseModelsService<
  DemoFirebaseModelServiceFactories,
  DemoFirebaseBaseContext,
  DemoFirebaseModelTypes
>(DEMO_FIREBASE_MODEL_SERVICE_FACTORIES);

// 5. Context Types
export type DemoFirebaseContextAppContext = DemoFirestoreCollections;
export type DemoFirebaseBaseContext = FirebaseAppModelContext<DemoFirebaseContextAppContext>;
export type DemoFirebaseContext = DemoFirebaseBaseContext & {
  service: DemoFirebaseModelServiceFactories;
};
```

## Adding a New Model to service.ts

When you've created a new model using the [dereekb-firebase-model](../dereekb-firebase-model/SKILL.md) skill, follow these steps to integrate it into `service.ts`:

### Step 1: Update Collections Interface

```typescript
export abstract class DemoFirestoreCollections
  implements
    FirestoreContextReference,
    GuestbookFirestoreCollections,
    YourModelFirestoreCollections {  // Add interface

  // Add collections
  abstract readonly yourModelCollection: YourModelFirestoreCollection;
  abstract readonly yourModelSubCollectionFactory?: YourModelSubCollectionFactory;
}
```

### Step 2: Update Collections Factory

```typescript
export function makeDemoFirestoreCollections(firestoreContext: FirestoreContext) {
  return {
    // ... existing collections
    yourModelCollection: yourModelFirestoreCollection(firestoreContext),
    yourModelSubCollectionFactory: yourModelSubCollectionFactory(firestoreContext)
  };
}
```

### Step 3: Create Service Factory

```typescript
export const yourModelFirebaseModelServiceFactory = firebaseModelServiceFactory<
  DemoFirebaseContext,
  YourModel,
  YourModelDocument,
  YourModelRoles
>({
  roleMapForModel: function (output, context, model) {
    // Choose appropriate role logic:
    return grantFullAccessIfAdmin(context);  // or other pattern
  },
  getFirestoreCollection: (c) => c.app.yourModelCollection
});
```

### Step 4: Update Model Types Union

```typescript
export type DemoFirebaseModelTypes =
  | SystemStateTypes
  | GuestbookTypes
  | YourModelTypes;  // Add your type
```

### Step 5: Add to Service Registry

```typescript
export const DEMO_FIREBASE_MODEL_SERVICE_FACTORIES = {
  systemState: systemStateFirebaseModelServiceFactory,
  guestbook: guestbookFirebaseModelServiceFactory,
  yourModel: yourModelFirebaseModelServiceFactory  // Add here
};
```

That's it! Your model is now integrated and the permission logic will work on both frontend and backend.

## Key Concepts

### 1. Centralized Collections

All Firestore collections are accessed through a single `DemoFirestoreCollections` interface. This ensures:
- Consistent collection access across the application
- Type safety when accessing collections
- Easy mocking for tests

### 2. Permission Logic Co-location

Each model's permission logic lives in its service factory right next to its collection definition. This makes it easy to:
- Understand what permissions exist for a model
- Update permission logic in one place
- See all models and their permissions at a glance

### 3. Frontend/Backend Consistency

The same `DemoFirebaseContext` type and permission checking code works on both frontend and backend. This means:
- **No duplicate permission logic** - Write once, use everywhere
- **Frontend can pre-check permissions** - Show/hide UI based on real permissions
- **Backend enforces same rules** - Security guaranteed to match frontend expectations
- **Fewer bugs** - No permission drift between frontend and backend

### 4. Type Safety

TypeScript ensures:
- Service factories have correct context and model types
- Role maps only include valid roles for each model
- Collections are properly typed throughout the application

## Common Patterns

### Default Strategies

- **System/admin resources** → `grantFullAccessIfAdmin(context)`
- **User-owned data** → `grantFullAccessIfAuthUserRelated({ context, document: model })`
- **Mixed permissions** → Use `grantModelRolesIfAdmin` with fallback function
- **Custom logic** → Implement directly in `roleMapForModel`

### Organization

```typescript
// Group related models with comments
// MARK: Core Models
export const systemStateFirebaseModelServiceFactory = ...

// MARK: Guestbook
export const guestbookFirebaseModelServiceFactory = ...
export const guestbookEntryFirebaseModelServiceFactory = ...

// MARK: User Profile
export const profileFirebaseModelServiceFactory = ...
export const profilePrivateDataFirebaseModelServiceFactory = ...
```

## Reference

### Key Imports

```typescript
// Core service factory
import {
  firebaseModelServiceFactory,
  firebaseModelsService,
  type FirebasePermissionServiceModel,
  type FirebaseAppModelContext,
  type FirestoreContext,
  type FirestoreContextReference
} from '@dereekb/firebase';

// Role helper functions
import {
  grantFullAccessIfAdmin,
  grantFullAccessIfAuthUserRelated,
  grantModelRolesIfAdmin
} from '@dereekb/firebase';

// Role utilities
import {
  fullAccessRoleMap,
  grantedRoleKeysMapFromArray,
  type GrantedRoleMap
} from '@dereekb/model';

// Utilities
import { type PromiseOrValue } from '@dereekb/util';
```

### Related Files

- [components/demo-firebase/src/lib/model/service.ts](../../components/demo-firebase/src/lib/model/service.ts) - Complete example

### Related Skills

- **[dereekb-firebase-model](../dereekb-firebase-model/SKILL.md)** - Creating model definitions (prerequisite)
- **[dereekb-firebase-snapshot-fields](../dereekb-firebase-snapshot-fields/SKILL.md)** - Field type reference

## Summary

The `service.ts` file is the integration hub that:

1. **Centralizes collections** - Single source of truth for all Firestore collections
2. **Defines permissions** - Role-based access control for each model
3. **Enables shared context** - Same types and logic work on frontend and backend
4. **Powers the application** - Foundation for all Firebase operations

The shared context pattern is a core feature of `@dereekb/firebase` that eliminates duplicate permission logic and ensures consistency across your entire application.
