# Zoho NestJS Configuration

This document describes the environment variables used by `@dereekb/zoho/nestjs` and shows how to wire up the Zoho CRM and Zoho Recruit modules in a NestJS application.

---

## Environment Variables

Configuration is read from a NestJS `ConfigService` (typically backed by process environment variables). Two naming conventions are supported for every credential: a **shared** variable that applies to all services, and a **service-specific** variable that takes precedence when present.

### Variable Naming Convention

The service-specific prefix is `ZOHO_<SERVICE>_`, where `<SERVICE>` is the uppercase `serviceAccessTokenKey` (e.g. `CRM` or `RECRUIT`). For each credential the lookup order is:

1. `ZOHO_<SERVICE>_<KEY>` – service-specific (highest priority)
2. `ZOHO_<KEY>` – shared fallback

### Zoho Accounts (OAuth) Variables

These credentials are shared across all Zoho services and are used to obtain access tokens via the Zoho Accounts API.

| Variable | Service-specific (CRM) | Service-specific (Recruit) | Description |
|---|---|---|---|
| `ZOHO_ACCOUNTS_URL` | `ZOHO_CRM_ACCOUNTS_URL` | `ZOHO_RECRUIT_ACCOUNTS_URL` | Base URL of the Zoho Accounts API (e.g. `https://accounts.zoho.com`) |
| `ZOHO_ACCOUNTS_REFRESH_TOKEN` | `ZOHO_CRM_ACCOUNTS_REFRESH_TOKEN` | `ZOHO_RECRUIT_ACCOUNTS_REFRESH_TOKEN` | OAuth refresh token for the service client |
| `ZOHO_ACCOUNTS_CLIENT_ID` | `ZOHO_CRM_ACCOUNTS_CLIENT_ID` | `ZOHO_RECRUIT_ACCOUNTS_CLIENT_ID` | OAuth client ID for the service client |
| `ZOHO_ACCOUNTS_CLIENT_SECRET` | `ZOHO_CRM_ACCOUNTS_CLIENT_SECRET` | `ZOHO_RECRUIT_ACCOUNTS_CLIENT_SECRET` | OAuth client secret for the service client |

### Zoho API URL Variables

Each service also needs to know the base URL of its own REST API.

| Variable | Description |
|---|---|
| `ZOHO_CRM_API_URL` | Base URL of the Zoho CRM API (e.g. `https://www.zohoapis.com/crm/v2`) |
| `ZOHO_RECRUIT_API_URL` | Base URL of the Zoho Recruit API (e.g. `https://recruit.zoho.com/recruit/v2`) |

> **Note:** The shared fallback `ZOHO_API_URL` can also be used if both services share the same base URL.

---

## Setting Up Zoho CRM

`appZohoCrmModuleMetadata()` generates the NestJS `ModuleMetadata` needed to bootstrap the Zoho CRM integration. It registers `ZohoCrmApi` and `ZohoAccountsApi` as providers and reads credentials from the environment automatically.

### Required environment variables

```
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_ACCOUNTS_REFRESH_TOKEN=<your-refresh-token>
ZOHO_ACCOUNTS_CLIENT_ID=<your-client-id>
ZOHO_ACCOUNTS_CLIENT_SECRET=<your-client-secret>
ZOHO_CRM_API_URL=https://www.zohoapis.com/crm/v2
```

### Example

```typescript
import {
  ZohoAccountsAccessTokenCacheService,
  appZohoCrmModuleMetadata
} from '@dereekb/zoho/nestjs';
import { Module } from '@nestjs/common';

// 1. Create a dependency module that provides ZohoAccountsAccessTokenCacheService.
//    Here we use a simple in-memory cache. For production, consider also layering
//    in a file-based or Redis-backed cache.
@Module({
  providers: [
    {
      provide: ZohoAccountsAccessTokenCacheService,
      useFactory: () => memoryZohoAccountsAccessTokenCacheService()
    }
  ],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class AppZohoCrmDependencyModule {}

// 2. Declare the CRM module using the helper. Pass the dependency module so that
//    ZohoAccountsAccessTokenCacheService is available to the internal providers.
@Module(appZohoCrmModuleMetadata({ dependencyModule: AppZohoCrmDependencyModule }))
export class AppZohoCrmModule {}
```

`ZohoCrmApi` is exported by `AppZohoCrmModule` and can be injected into any service that imports it.

---

## Setting Up Zoho Recruit

`appZohoRecruitModuleMetadata()` mirrors the CRM helper for the Zoho Recruit API.

### Required environment variables

```
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_ACCOUNTS_REFRESH_TOKEN=<your-refresh-token>
ZOHO_ACCOUNTS_CLIENT_ID=<your-client-id>
ZOHO_ACCOUNTS_CLIENT_SECRET=<your-client-secret>
ZOHO_RECRUIT_API_URL=https://recruit.zoho.com/recruit/v2
```

Or, if Recruit uses its own dedicated OAuth client, use the service-specific variables:

```
ZOHO_RECRUIT_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_RECRUIT_ACCOUNTS_REFRESH_TOKEN=<recruit-refresh-token>
ZOHO_RECRUIT_ACCOUNTS_CLIENT_ID=<recruit-client-id>
ZOHO_RECRUIT_ACCOUNTS_CLIENT_SECRET=<recruit-client-secret>
ZOHO_RECRUIT_API_URL=https://recruit.zoho.com/recruit/v2
```

### Example

```typescript
import {
  ZohoAccountsAccessTokenCacheService,
  appZohoRecruitModuleMetadata
} from '@dereekb/zoho/nestjs';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: ZohoAccountsAccessTokenCacheService,
      useFactory: () => memoryZohoAccountsAccessTokenCacheService()
    }
  ],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class AppZohoRecruitDependencyModule {}

@Module(appZohoRecruitModuleMetadata({ dependencyModule: AppZohoRecruitDependencyModule }))
export class AppZohoRecruitModule {}
```

`ZohoRecruitApi` is exported by `AppZohoRecruitModule` and can be injected into any service that imports it.

---

## Using Both CRM and Recruit Together

If your application uses both APIs, you can share or separate the token cache depending on whether the same OAuth client is used:

```typescript
// Shared dependency module (single OAuth client for both services)
@Module({
  providers: [
    {
      provide: ZohoAccountsAccessTokenCacheService,
      useFactory: () => memoryZohoAccountsAccessTokenCacheService()
    }
  ],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class AppZohoDependencyModule {}

@Module(appZohoCrmModuleMetadata({ dependencyModule: AppZohoDependencyModule }))
export class AppZohoCrmModule {}

@Module(appZohoRecruitModuleMetadata({ dependencyModule: AppZohoDependencyModule }))
export class AppZohoRecruitModule {}
```

When different OAuth clients are used for CRM and Recruit, set the service-specific environment variables (e.g. `ZOHO_CRM_ACCOUNTS_CLIENT_ID` vs `ZOHO_RECRUIT_ACCOUNTS_CLIENT_ID`) and use separate dependency modules with their own cache instances.
