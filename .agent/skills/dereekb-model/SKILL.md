---
name: model
description: Data modeling abstractions from @dereekb/model - domain model patterns, data transformation, validation, service layer utilities, and common data types.
---

# @dereekb/model

## Overview

**@dereekb/model** provides domain modeling abstractions, data transformation patterns, validation utilities, and service layer patterns for building type-safe data models.

**Package Location:** `packages/model/`

**Key Features:**
- Common data types (Address, Website)
- Data transformation patterns and utilities
- Validation utilities for common types
- Service layer abstractions (loaders, permissions, sync)
- Type-safe transformation pipelines

**Dependencies:**
- @dereekb/util

**Package Architecture:**
```
@dereekb/util
    ↓
@dereekb/model
    ↓
Used by: @dereekb/firebase, @dereekb/dbx-core
```

## Module Organization (4 modules)

### Data
Common data types and domain models.

**Location:** `packages/model/src/lib/data/`

**Key Concepts:**
- Standard data types used across applications
- Address and location data
- Website and URL data

**Key Exports:**

**Address Types:**
- `Address` interface - Physical address structure
- `AddressData` - Raw address data
- `FullAddress` - Complete address with all fields
- `PartialAddress` - Optional address fields
- `addressString(address)` - Format address as string
- `parseAddress(string)` - Parse address from string

**Website Types:**
- `Website` interface - Website data structure
- `websiteFromUrl(url)` - Create website from URL
- `websiteUrl(website)` - Get URL from website

**Common Patterns:**
```typescript
import { Address, addressString, Website } from '@dereekb/model';

// Work with addresses
const address: Address = {
  street: '123 Main St',
  city: 'San Francisco',
  state: 'CA',
  zip: '94102',
  country: 'US'
};

const formatted = addressString(address);
// "123 Main St, San Francisco, CA 94102"

// Work with websites
const site: Website = websiteFromUrl('https://example.com');
```

**Use Cases:**
- User profiles with addresses
- Business locations
- Contact information
- Website references

### Transform
Data transformation patterns and type conversion utilities.

**Location:** `packages/model/src/lib/transform/`

**Key Concepts:**
- Type transformations between layers (API ↔ Domain ↔ View)
- Transformation pipelines
- Annotation-based transformations
- Result types for transformation outcomes

**Key Exports:**

**Core Transform Types:**
- `TransformFunction<I, O>` - Function that transforms input to output
- `TransformFunctionPair<A, B>` - Bidirectional transformation
- `TransformMap<I, O>` - Map of named transformations
- `Transformer<I, O>` interface - Transformer with transform() method

**Transform Utilities:**
- `transformFunction<I, O>(fn)` - Create transform function
- `chainTransforms<I, M, O>(fn1, fn2)` - Chain transformations
- `invertTransform<A, B>(pair)` - Invert bidirectional transform
- `mapTransform<I, O>(map, key)` - Get transform from map

**Type Annotations:**
- `TypeAnnotation` - Type metadata for runtime type info
- `typeAnnotation(name, description)` - Create type annotation
- `annotateType<T>(type, annotation)` - Add annotation to type

**Transform Results:**
- `TransformResult<T>` - Success/failure result of transformation
- `successfulTransform<T>(value)` - Successful result
- `failedTransform(errors)` - Failed result with errors
- `isSuccessfulTransform(result)` - Type guard for success

**Common Patterns:**
```typescript
import {
  TransformFunction,
  transformFunction,
  chainTransforms,
  TransformResult,
  successfulTransform
} from '@dereekb/model';

// Simple transformation
const toUpperCase: TransformFunction<string, string> =
  transformFunction((input) => input.toUpperCase());

// Chained transformations
const parseAndFormat = chainTransforms(
  parseInput,   // string → ParsedData
  formatOutput  // ParsedData → FormattedData
);

// Transformation with results
function validateAndTransform(input: string): TransformResult<number> {
  const num = parseInt(input);
  if (isNaN(num)) {
    return failedTransform(['Invalid number']);
  }
  return successfulTransform(num);
}

// Bidirectional transform
const userTransform: TransformFunctionPair<UserApi, User> = {
  to: (api) => ({ id: api.uid, name: api.displayName }),
  from: (user) => ({ uid: user.id, displayName: user.name })
};
```

**Use Cases:**
- API ↔ Domain model conversion
- Form data ↔ Model transformation
- Data validation pipelines
- Type-safe data mapping
- Import/export transformations

### Service
Service layer abstractions for data loading, permissions, and synchronization.

**Location:** `packages/model/src/lib/service/`

**Key Concepts:**
- Loader patterns for data fetching
- Permission checking utilities
- Synchronization patterns
- Service abstractions

**Key Exports:**

**Loader Patterns:**
- `Loader<T>` interface - Data loader abstraction
- `LoaderFunction<T>` - Function-based loader
- `loaderFunction<T>(fn)` - Create loader from function
- `CachedLoader<T>` - Loader with caching
- `cachedLoader<T>(loader)` - Add caching to loader

**Permission Utilities:**
- `Permission` type - Permission identifier
- `PermissionCheck` - Permission check function
- `hasPermission(user, permission)` - Check user permission
- `requirePermission(permission)` - Assert permission exists

**Sync Patterns:**
- `SyncFunction<T>` - Synchronization function
- `syncFunction<T>(fn)` - Create sync function
- `SyncResult<T>` - Sync operation result
- `syncWithRetry<T>(fn, config)` - Retry sync on failure

**Common Patterns:**
```typescript
import {
  loaderFunction,
  cachedLoader,
  hasPermission,
  syncFunction
} from '@dereekb/model';

// Create data loader
const userLoader = loaderFunction(async (userId: string) => {
  return await api.getUser(userId);
});

// Add caching
const cachedUserLoader = cachedLoader(userLoader);

// Permission checking
if (hasPermission(currentUser, 'admin')) {
  // Allow admin actions
}

// Sync function
const syncData = syncFunction(async (data: LocalData) => {
  const result = await api.sync(data);
  return { success: true, data: result };
});
```

**Use Cases:**
- Data loading abstractions
- Cache management
- Permission-based access control
- Data synchronization
- Service layer patterns

### Validator
Validation utilities for common data types.

**Location:** `packages/model/src/lib/validator/`

**Key Concepts:**
- Validation functions for standard types
- Error message generation
- Type-specific validators
- Reusable validation patterns

**Key Exports:**

**Date Validators:**
- `isValidDate(value)` - Check if valid date
- `dateValidator(config)` - Create date validator
- `isAfterDate(date, after)` - Check if date is after another
- `isBeforeDate(date, before)` - Check if date is before another
- `dateRangeValidator(min, max)` - Validate date in range

**Number Validators:**
- `isValidNumber(value)` - Check if valid number
- `numberValidator(config)` - Create number validator
- `minNumber(value, min)` - Check minimum value
- `maxNumber(value, max)` - Check maximum value
- `rangeValidator(min, max)` - Validate number in range
- `integerValidator()` - Validate integer values

**Phone Validators:**
- `isValidPhoneNumber(phone)` - Check if valid phone
- `phoneValidator(config)` - Create phone validator
- `normalizePhoneForValidation(phone)` - Normalize before validation
- `phoneNumberFormat(phone)` - Format phone number

**URL Validators:**
- `isValidUrl(url)` - Check if valid URL
- `urlValidator(config)` - Create URL validator
- `httpUrlValidator()` - Validate HTTP/HTTPS URLs
- `domainValidator()` - Validate domain names

**Unique Validators:**
- `uniqueValidator<T>(items)` - Check for unique values
- `uniqueByKey<T>(items, key)` - Check unique by property
- `hasDuplicates<T>(items)` - Check for duplicates

**Common Patterns:**
```typescript
import {
  dateValidator,
  rangeValidator,
  isValidPhoneNumber,
  isValidUrl,
  uniqueByKey
} from '@dereekb/model';

// Date validation
const birthDateValidator = dateValidator({
  min: new Date('1900-01-01'),
  max: new Date()
});

if (!birthDateValidator(userBirthDate)) {
  errors.push('Invalid birth date');
}

// Number validation
const ageValidator = rangeValidator(0, 150);
if (!ageValidator(age)) {
  errors.push('Age must be between 0 and 150');
}

// Phone validation
if (!isValidPhoneNumber(phone)) {
  errors.push('Invalid phone number');
}

// URL validation
if (!isValidUrl(website)) {
  errors.push('Invalid website URL');
}

// Unique validation
if (!uniqueByKey(users, 'email')) {
  errors.push('Duplicate email addresses found');
}
```

**Use Cases:**
- Form validation
- API input validation
- Data integrity checks
- User input sanitization
- Import validation

## Common Patterns

### Domain Model with Transformation
```typescript
import { TransformFunctionPair, Address, addressString } from '@dereekb/model';

// API type
interface UserApi {
  uid: string;
  email: string;
  address: {
    street: string;
    city: string;
  };
}

// Domain type
interface User {
  id: string;
  email: string;
  address: Address;
}

// Bidirectional transform
const userTransform: TransformFunctionPair<UserApi, User> = {
  to: (api) => ({
    id: api.uid,
    email: api.email,
    address: {
      street: api.address.street,
      city: api.address.city,
      state: '',
      zip: '',
      country: 'US'
    }
  }),
  from: (user) => ({
    uid: user.id,
    email: user.email,
    address: {
      street: user.address.street,
      city: user.address.city
    }
  })
};
```

### Validated Data Loading
```typescript
import { loaderFunction, rangeValidator, isValidUrl } from '@dereekb/model';

const productLoader = loaderFunction(async (productId: string) => {
  const product = await api.getProduct(productId);

  // Validate loaded data
  const priceValidator = rangeValidator(0, 1000000);
  if (!priceValidator(product.price)) {
    throw new Error('Invalid product price');
  }

  if (!isValidUrl(product.imageUrl)) {
    throw new Error('Invalid product image URL');
  }

  return product;
});
```

### Service Layer with Permissions
```typescript
import {
  loaderFunction,
  hasPermission,
  syncFunction,
  TransformResult
} from '@dereekb/model';

class UserService {
  // Load with permission check
  loadUser = loaderFunction(async (userId: string) => {
    if (!hasPermission(this.currentUser, 'read:users')) {
      throw new Error('Permission denied');
    }
    return await this.api.getUser(userId);
  });

  // Update with validation and sync
  updateUser = syncFunction(async (user: User): TransformResult<User> => {
    if (!hasPermission(this.currentUser, 'write:users')) {
      return failedTransform(['Permission denied']);
    }

    // Validate
    if (!isValidUrl(user.website)) {
      return failedTransform(['Invalid website URL']);
    }

    // Sync
    const updated = await this.api.updateUser(user);
    return successfulTransform(updated);
  });
}
```

## Best Practices

### DO:
- **Use TransformFunctionPair** for bidirectional conversions (API ↔ Domain)
- **Validate at boundaries** - API inputs, user inputs, external data
- **Use common data types** (Address, Website) for consistency
- **Cache loaders** for frequently accessed data
- **Chain transformations** for complex multi-step conversions
- **Return TransformResult** for operations that can fail

### DON'T:
- **Don't skip validation** - Always validate external data
- **Don't mix transformation and business logic** - Keep transforms pure
- **Don't create ad-hoc validators** - Use provided validators
- **Don't ignore TransformResult errors** - Handle transformation failures
- **Don't bypass permission checks** - Always verify access

### Type Safety:
- Use TypeScript's type system with transformation functions
- TransformResult provides type-safe error handling
- Type annotations preserve type information at runtime
- Generic types ensure input/output type correctness

## Integration with Other Packages

### @dereekb/firebase
```typescript
import { TransformFunctionPair } from '@dereekb/model';
import { firestoreModelConverter } from '@dereekb/firebase';

// Transform between Firestore and domain models
const userConverter = firestoreModelConverter<UserData, User>({
  convert: userTransform.to,
  convertToData: userTransform.from
});
```

### @dereekb/util
```typescript
import { Maybe } from '@dereekb/util';
import { TransformFunction } from '@dereekb/model';

// Combine util types with model transformations
const maybeTransform: TransformFunction<Maybe<string>, string> =
  transformFunction((input) => input ?? 'default');
```

### @dereekb/dbx-core
```typescript
import { Address, addressString } from '@dereekb/model';
import { DbxValuePipe } from '@dereekb/dbx-core';

// Use model types in Angular components
@Component({
  template: `{{ address | getValue:addressString }}`
})
export class AddressComponent {
  address: Address;
  addressString = addressString;
}
```

## Related Packages

### Direct Dependencies:
- **[@dereekb/util](../../../packages/util/)** - Foundational utilities
  - Use for: Array/object manipulation, promise handling, type utilities
  - Model uses util for core operations

### Packages that Depend on @dereekb/model:
- **[@dereekb/firebase](../../../packages/firebase/)** - Firebase utilities
  - Uses: Transform patterns for Firestore converters
- **[@dereekb/dbx-core](../../../packages/dbx-core/)** - Angular utilities
  - Uses: Data types, validators in forms

### When to Use Other Packages:
- **Need Firebase-specific models?** → Use @dereekb/firebase (extends model patterns)
- **Need validation in Angular forms?** → Use @dereekb/dbx-form (uses validators)
- **Need basic utilities?** → Use @dereekb/util (model builds on util)

## Quick Module Finder

**I need to...**
- Define address/location data → `data` module (Address types)
- Transform between data types → `transform` module
- Validate user input → `validator` module
- Load data with caching → `service` module (loaders)
- Check permissions → `service` module (permissions)
- Sync data → `service` module (sync patterns)

## Additional Resources

- **Package Catalog:** [.agent/PACKAGES.md](../../PACKAGES.md)
- **Firebase Model Patterns:** [wiki/Models.md](../../../wiki/Models.md) for Firestore-specific patterns
- **Source Code:** [packages/model/src/lib/](../../../packages/model/src/lib/)
- **Changelog:** [packages/model/CHANGELOG.md](../../../packages/model/CHANGELOG.md)

## Package Stats

- **Modules:** 4 modules (data, service, transform, validator)
- **Dependencies:** @dereekb/util
- **Used By:** @dereekb/firebase, @dereekb/dbx-core, @dereekb/nestjs
- **Key Patterns:** TransformFunctionPair, Loader, Validator
