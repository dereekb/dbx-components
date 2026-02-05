# @dereekb/firebase Model Creation

Guide for creating Firestore models using the @dereekb/firebase library patterns. This skill covers the complete structure for defining models with proper types, converters, collections, queries, and API definitions.

## Model Structure Overview

A complete model consists of several files:
- **`[model].ts`** - Main model definition with types, converters, and collections
- **`[model].id.ts`** - ID/key type definitions (to avoid import loops)
- **`[model].query.ts`** - Query constraint functions
- **`[model].api.ts`** - API DTOs with validation decorators
- **`[model].action.ts`** - Backend action type definitions

## 1. ID/Key Types (`[model].id.ts`)

Define ID and key types first to avoid circular imports:

```typescript
import { type FirebaseAuthUserId } from '@dereekb/firebase';

export type GuestbookId = string;
export type GuestbookKey = string;

// For subcollections that use parent user IDs:
export type GuestbookEntryId = FirebaseAuthUserId;
export type GuestbookEntryKey = string;
```

**Pattern:**
- Use `[Model]Id` for the document ID type
- Use `[Model]Key` for the document key type (often same as ID)
- Import from `@dereekb/firebase` for special types like `FirebaseAuthUserId`

## 2. Main Model Definition (`[model].ts`)

### 2.1 Imports

```typescript
import {
  type CollectionReference,
  AbstractFirestoreDocument,
  snapshotConverterFunctions,
  firestoreString,
  firestoreDate,
  firestoreBoolean,
  firestoreNumber,
  optionalFirestoreDate,
  optionalFirestoreString,
  type FirestoreCollection,
  type FirestoreContext,
  type FirestoreCollectionWithParent,
  type FirestoreCollectionGroup,
  type CollectionGroup,
  firestoreModelIdentity,
  type UserRelated,
  type UserRelatedById,
  copyUserRelatedDataAccessorFactoryFunction,
  firestoreUID
} from '@dereekb/firebase';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
```

### 2.2 Model Identity

Use `firestoreModelIdentity()` to define the model's collection name and prefix:

```typescript
// Root collection
export const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');

// Subcollection (nested under parent)
export const guestbookEntryIdentity = firestoreModelIdentity(
  guestbookIdentity,
  'guestbookEntry',
  'gbe'
);
```

**Parameters:**
- Root collection: `(collectionName, prefix)`
- Subcollection: `(parentIdentity, collectionName, prefix)`

### 2.3 Model Interface

Define the model interface with all fields:

```typescript
export interface Guestbook {
  /**
   * Whether or not this guestbook should show up in the list.
   */
  published: boolean;
  /**
   * Guestbook name
   */
  name: string;
  /**
   * Whether or not this guestbook and its entries can still be edited.
   */
  locked: boolean;
  /**
   * Date the guestbook was locked at.
   */
  lockedAt?: Maybe<Date>;
  /**
   * User who created the guestbook.
   */
  cby?: Maybe<ProfileId>;
}
```

**Best practices:**
- Use JSDoc comments for all fields
- Use `Maybe<T>` from `@dereekb/util` for optional fields
- Use proper types (Date, not string for dates)
- Include metadata fields like `createdAt`, `updatedAt`, `uid`, `cby` as needed

### 2.4 Role Types

Define role types for access control:

```typescript
export type GuestbookRoles = 'admin' | 'subscribeToNotifications' | GrantedReadRole;

export type GuestbookEntryRoles = 'like' | GrantedReadRole | GrantedUpdateRole;
```

**Common roles:**
- `GrantedReadRole` - Standard read permissions
- `GrantedUpdateRole` - Standard update permissions
- Custom roles as string literals

### 2.5 Document Class

Extend `AbstractFirestoreDocument` for root collections:

```typescript
export class GuestbookDocument extends AbstractFirestoreDocument<
  Guestbook,
  GuestbookDocument,
  typeof guestbookIdentity
> {
  get modelIdentity() {
    return guestbookIdentity;
  }
}
```

For subcollections, extend `AbstractFirestoreDocumentWithParent`:

```typescript
export class GuestbookEntryDocument extends AbstractFirestoreDocumentWithParent<
  Guestbook,           // Parent model
  GuestbookEntry,      // This model
  GuestbookEntryDocument,
  typeof guestbookEntryIdentity
> {
  get modelIdentity() {
    return guestbookEntryIdentity;
  }
}
```

### 2.6 Snapshot Converter

Use `snapshotConverterFunctions()` to define field mappings:

```typescript
export const guestbookConverter = snapshotConverterFunctions<Guestbook>({
  fields: {
    published: firestoreBoolean({ default: false }),
    name: firestoreString({ default: '' }),
    locked: firestoreBoolean({ default: false }),
    lockedAt: optionalFirestoreDate(),
    cby: optionalFirestoreString()
  }
});
```

**Field function selection:**
- Required fields: `firestoreString()`, `firestoreBoolean()`, `firestoreNumber()`, `firestoreDate()`
- Optional fields: `optionalFirestoreString()`, `optionalFirestoreDate()`, etc.
- See the `dereekb-firebase-snapshot-fields` skill for all available field types

### 2.7 Collection Reference

Create a function to get the collection reference:

```typescript
// Root collection
export function guestbookCollectionReference(
  context: FirestoreContext
): CollectionReference<Guestbook> {
  return context.collection(guestbookIdentity.collectionName);
}

// Subcollection factory
export function guestbookEntryCollectionReferenceFactory(
  context: FirestoreContext
): (guestbook: GuestbookDocument) => CollectionReference<GuestbookEntry> {
  return (guestbook: GuestbookDocument) => {
    return context.subcollection(
      guestbook.documentRef,
      guestbookEntryIdentity.collectionName
    );
  };
}
```

### 2.8 Collection Types and Factory

Define collection types and factory function:

```typescript
// Root collection
export type GuestbookFirestoreCollection = FirestoreCollection<
  Guestbook,
  GuestbookDocument
>;

export function guestbookFirestoreCollection(
  firestoreContext: FirestoreContext
): GuestbookFirestoreCollection {
  return firestoreContext.firestoreCollection({
    converter: guestbookConverter,
    modelIdentity: guestbookIdentity,
    collection: guestbookCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) =>
      new GuestbookDocument(accessor, documentAccessor),
    firestoreContext
  });
}
```

For subcollections with parent:

```typescript
export type GuestbookEntryFirestoreCollection = FirestoreCollectionWithParent<
  GuestbookEntry,
  Guestbook,
  GuestbookEntryDocument,
  GuestbookDocument
>;

export type GuestbookEntryFirestoreCollectionFactory = (
  parent: GuestbookDocument
) => GuestbookEntryFirestoreCollection;

export function guestbookEntryFirestoreCollectionFactory(
  firestoreContext: FirestoreContext
): GuestbookEntryFirestoreCollectionFactory {
  const factory = guestbookEntryCollectionReferenceFactory(firestoreContext);

  return (parent: GuestbookDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      converter: guestbookEntryConverter,
      modelIdentity: guestbookEntryIdentity,
      collection: factory(parent),
      accessorFactory: guestbookEntryAccessorFactory, // if using UserRelated
      makeDocument: (accessor, documentAccessor) =>
        new GuestbookEntryDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}
```

### 2.9 Collection Group (for subcollections)

For querying across all subcollections:

```typescript
export function guestbookEntryCollectionReference(
  context: FirestoreContext
): CollectionGroup<GuestbookEntry> {
  return context.collectionGroup(guestbookEntryIdentity.collectionName);
}

export type GuestbookEntryFirestoreCollectionGroup = FirestoreCollectionGroup<
  GuestbookEntry,
  GuestbookEntryDocument
>;

export function guestbookEntryFirestoreCollectionGroup(
  firestoreContext: FirestoreContext
): GuestbookEntryFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    converter: guestbookEntryConverter,
    modelIdentity: guestbookEntryIdentity,
    accessorFactory: guestbookEntryAccessorFactory,
    queryLike: guestbookEntryCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) =>
      new GuestbookEntryDocument(accessor, documentAccessor),
    firestoreContext
  });
}
```

### 2.10 User-Related Models

For models that track user relationships:

```typescript
export interface GuestbookEntry extends UserRelated, UserRelatedById {
  uid: FirebaseAuthUserId; // Required for UserRelatedById
  message: string;
  // ... other fields
}

// Create accessor factory
export const guestbookEntryAccessorFactory =
  copyUserRelatedDataAccessorFactoryFunction<GuestbookEntry>();
```

### 2.11 Collections Interface

Optionally create an interface grouping all collections:

```typescript
export interface GuestbookFirestoreCollections {
  guestbookCollection: GuestbookFirestoreCollection;
  guestbookEntryCollectionFactory: GuestbookEntryFirestoreCollectionFactory;
  guestbookEntryCollectionGroup: GuestbookEntryFirestoreCollectionGroup;
}

export type GuestbookTypes = typeof guestbookIdentity | typeof guestbookEntryIdentity;
```

## 3. Query Functions (`[model].query.ts`)

Define reusable query constraint functions:

```typescript
import { type FirestoreQueryConstraint, where, orderBy, limit } from '@dereekb/firebase';

export function publishedGuestbook(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}

export function publishedGuestbookEntry(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}

export function recentGuestbookEntries(count = 10): FirestoreQueryConstraint[] {
  return [
    orderBy('createdAt', 'desc'),
    limit(count)
  ];
}
```

**Best practices:**
- Return `FirestoreQueryConstraint` or `FirestoreQueryConstraint[]`
- Use descriptive function names
- Provide sensible defaults
- These can be used on both frontend and backend

## 4. API DTOs (`[model].api.ts`)

Define DTOs with validation decorators:

```typescript
import { Expose } from 'class-transformer';
import {
  IsOptional,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsBoolean
} from 'class-validator';
import {
  FirebaseFunctionTypeConfigMap,
  ModelFirebaseCreateFunction,
  ModelFirebaseCrudFunction,
  ModelFirebaseCrudFunctionConfigMap,
  ModelFirebaseFunctionMap,
  AbstractSubscribeToNotificationBoxParams,
  TargetModelParams,
  callModelFirebaseFunctionMapFactory
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type GuestbookTypes } from './guestbook';

// Define max lengths
export const GUESTBOOK_NAME_MAX_LENGTH = 40;
export const GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH = 200;

// Create DTO
export class CreateGuestbookParams {
  @Expose()
  @IsNotEmpty()
  @IsString()
  @MaxLength(GUESTBOOK_NAME_MAX_LENGTH)
  name!: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  published?: Maybe<boolean>;
}

// Update DTO
export class InsertGuestbookEntryParams extends GuestbookEntryParams {
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH)
  message?: string;
}

// Target action DTO
export class LikeGuestbookEntryParams extends TargetModelParams {}

// Type map for custom functions
export type GuestbookFunctionTypeMap = {};

export const guestbookFunctionTypeConfigMap:
  FirebaseFunctionTypeConfigMap<GuestbookFunctionTypeMap> = {};

// CRUD functions configuration
export type GuestbookModelCrudFunctionsConfig = {
  guestbook: {
    create: CreateGuestbookParams;
    update: {
      subscribeToNotifications: SubscribeToGuestbookNotificationsParams;
    };
  };
  guestbookEntry: {
    update: {
      insert: InsertGuestbookEntryParams;
      like: LikeGuestbookEntryParams;
    };
    delete: GuestbookEntryParams;
  };
};

export const guestbookModelCrudFunctionsConfig:
  ModelFirebaseCrudFunctionConfigMap<
    GuestbookModelCrudFunctionsConfig,
    GuestbookTypes
  > = {
  guestbook: ['create', 'update:subscribeToNotifications'],
  guestbookEntry: ['update:insert,like', 'delete']
};

// Function map factory
export const guestbookFunctionMap = callModelFirebaseFunctionMapFactory(
  guestbookFunctionTypeConfigMap,
  guestbookModelCrudFunctionsConfig
);

// Functions interface for implementation
export abstract class GuestbookFunctions implements
  ModelFirebaseFunctionMap<
    GuestbookFunctionTypeMap,
    GuestbookModelCrudFunctionsConfig
  > {
  abstract guestbook: {
    createGuestbook: ModelFirebaseCreateFunction<CreateGuestbookParams>;
    updateGuestbook: {
      subscribeToNotifications:
        ModelFirebaseCrudFunction<SubscribeToGuestbookNotificationsParams>;
    };
  };
  abstract guestbookEntry: {
    updateGuestbookEntry: {
      insert: ModelFirebaseCrudFunction<InsertGuestbookEntryParams>;
      like: ModelFirebaseCrudFunction<LikeGuestbookEntryParams>;
    };
    deleteGuestbookEntry: ModelFirebaseCrudFunction<GuestbookEntryParams>;
  };
}
```

**Validation decorators:**
- `@Expose()` - Mark field for serialization
- `@IsString()`, `@IsBoolean()`, `@IsNumber()` - Type validation
- `@IsOptional()` - Field is optional
- `@IsNotEmpty()` - Field cannot be empty
- `@MaxLength(n)` - String max length
- `@Min(n)`, `@Max(n)` - Number bounds
- `@IsEmail()`, `@IsUrl()` - Format validation

## 5. Action Types (`[model].action.ts`)

Define backend action type helpers:

```typescript
import {
  type AsyncFirebaseFunctionCreateAction,
  type AsyncFirebaseFunctionUpdateAction,
  type FirebaseFunctionUpdateAction
} from '@dereekb/firebase';
import {
  type GuestbookDocument,
  type GuestbookEntryDocument
} from './guestbook';

export type AsyncGuestbookCreateAction<P extends object> =
  AsyncFirebaseFunctionCreateAction<P, GuestbookDocument>;

export type AsyncGuestbookUpdateAction<P extends object> =
  AsyncFirebaseFunctionUpdateAction<P, GuestbookDocument>;

export type GuestbookEntryUpdateAction<P extends object> =
  FirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;

export type AsyncGuestbookEntryUpdateAction<P extends object> =
  AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;

export type AsyncGuestbookEntryAction<P extends object> =
  AsyncFirebaseFunctionUpdateAction<P, GuestbookEntryDocument>;
```

**Action types:**
- `AsyncFirebaseFunctionCreateAction<P, D>` - Create actions
- `AsyncFirebaseFunctionUpdateAction<P, D>` - Update actions
- `FirebaseFunctionUpdateAction<P, D>` - Synchronous update actions
- Use these in backend function implementations

## Complete File Checklist

- [ ] `[model].id.ts` - ID/key types defined
- [ ] `[model].ts` - Complete model with:
  - [ ] Model identity
  - [ ] Model interface(s)
  - [ ] Role types
  - [ ] Document class(es)
  - [ ] Snapshot converter(s)
  - [ ] Collection reference function(s)
  - [ ] Collection type(s) and factory function(s)
  - [ ] Collection group (if subcollection)
  - [ ] Collections interface
- [ ] `[model].query.ts` - Query constraint functions
- [ ] `[model].api.ts` - DTOs with validation
- [ ] `[model].action.ts` - Backend action types

## Common Patterns

### Parent-Child Relationships

For models with parent-child relationships:
1. Define parent identity first
2. Define child identity with parent: `firestoreModelIdentity(parentIdentity, ...)`
3. Use `AbstractFirestoreDocumentWithParent` for child documents
4. Create collection factory that takes parent document
5. Define collection group for querying across all parents

### User-Related Models

For models that track user information:
1. Implement `UserRelated` and/or `UserRelatedById` interfaces
2. Include `uid` field with `firestoreUID()`
3. Create accessor factory: `copyUserRelatedDataAccessorFactoryFunction<T>()`
4. Pass `accessorFactory` to collection configuration

### Metadata Fields

Common metadata patterns:
- `createdAt` - Use `firestoreDate({ saveDefaultAsNow: true })`
- `updatedAt` - Use `firestoreDate({ saveDefaultAsNow: true })`
- `uid` - Use `firestoreUID()` for user IDs
- `cby` / `uby` - Use `optionalFirestoreString()` for created/updated by user

## Tips

1. **Import Organization**: Group imports by source package
2. **Type Safety**: Use strict types throughout, avoid `any`
3. **Naming Conventions**:
   - PascalCase for classes and interfaces
   - camelCase for functions and variables
   - UPPER_SNAKE_CASE for constants
4. **Comments**: Add JSDoc comments to interfaces and public functions
5. **Testing**: Create corresponding test files for converters and queries
6. **Indexing**: Remember to create Firestore indexes for complex queries

## Related Skills

- `dereekb-firebase-snapshot-fields` - Reference for all available snapshot field types
- `angular-component` - For creating Angular components that use these models
- `angular-signals` - For reactive state management with these models
