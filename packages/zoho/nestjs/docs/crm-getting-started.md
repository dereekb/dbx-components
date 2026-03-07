# Zoho CRM - Getting Started with NestJS

This guide walks through setting up Zoho CRM in a new NestJS project using `@dereekb/zoho` and `@dereekb/zoho-nestjs`.

## 1. Install Dependencies

```bash
npm install @dereekb/zoho @dereekb/zoho-nestjs
```

## 2. Module & Authentication Setup

The NestJS integration wires up OAuth authentication, token caching, rate limiting, and the CRM client in a single module declaration. All you need to provide is:

- Environment variables for OAuth credentials and API URLs
- A `ZohoAccountsAccessTokenCacheService` implementation for token persistence

### Environment Variables

```env
# OAuth credentials (shared across all Zoho services)
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_ACCOUNTS_REFRESH_TOKEN=<your-refresh-token>
ZOHO_ACCOUNTS_CLIENT_ID=<your-client-id>
ZOHO_ACCOUNTS_CLIENT_SECRET=<your-client-secret>

# CRM API endpoint
ZOHO_API_URL=https://www.zohoapis.com
```

> You can also use CRM-specific env vars (e.g. `ZOHO_CRM_ACCOUNTS_REFRESH_TOKEN`) to override the shared values. This is useful when your app integrates multiple Zoho services (CRM, Recruit, Sign) with different credentials.

### Token Cache

You must provide a `ZohoAccountsAccessTokenCacheService` that persists OAuth access tokens. The library includes three built-in implementations:

```typescript
import {
  memoryZohoAccountsAccessTokenCacheService,
  fileZohoAccountsAccessTokenCacheService,
  mergeZohoAccountsAccessTokenCacheServices
} from '@dereekb/zoho-nestjs';

// In-memory only (good for testing)
const cacheService = memoryZohoAccountsAccessTokenCacheService();

// File-based (good for local development, persists across restarts)
const cacheService = fileZohoAccountsAccessTokenCacheService('.tmp/zoho-tokens.json');

// Merged (fault-tolerant, tries multiple sources in sequence)
const cacheService = mergeZohoAccountsAccessTokenCacheServices([cacheA, cacheB]);
```

### Module Declaration

Create a dependency module that provides the token cache, then use `appZohoCrmModuleMetadata()` to wire everything together:

```typescript
import { Module } from '@nestjs/common';
import {
  ZohoAccountsAccessTokenCacheService,
  ZohoCrmApi,
  appZohoCrmModuleMetadata,
  fileZohoAccountsAccessTokenCacheService
} from '@dereekb/zoho-nestjs';

@Module({
  providers: [
    {
      provide: ZohoAccountsAccessTokenCacheService,
      useValue: fileZohoAccountsAccessTokenCacheService()
    }
  ],
  exports: [ZohoAccountsAccessTokenCacheService]
})
export class ZohoCrmDependencyModule {}

@Module(appZohoCrmModuleMetadata({ dependencyModule: ZohoCrmDependencyModule }))
export class AppZohoCrmModule {}
```

`appZohoCrmModuleMetadata()` automatically registers:
- `ZohoAccountsServiceConfig` (reads OAuth env vars via `ConfigService`)
- `ZohoAccountsApi` (manages token refresh and caching)
- `ZohoCrmServiceConfig` (reads CRM API URL from env vars)
- `ZohoCrmApi` (the injectable service you'll use everywhere)

Import `AppZohoCrmModule` in your app module and inject `ZohoCrmApi` wherever needed.

### Non-NestJS Setup

If you're not using NestJS, create the accounts context and CRM client manually:

```typescript
import { zohoAccountsFactory, zohoCrmFactory } from '@dereekb/zoho';

const accounts = zohoAccountsFactory({})({
  apiUrl: 'us',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  refreshToken: 'your-refresh-token',
  accessTokenCache: myOptionalCache
});

const crm = zohoCrmFactory({
  accountsContext: accounts.accountsContext
})({
  apiUrl: 'production' // or 'sandbox'
});

const { crmContext } = crm;
// Pass crmContext to all zohoCrmXxx() functions
```

## 3. CRUD Operations

`ZohoCrmApi` exposes all CRM operations as getter properties. Each returns a pre-bound async function.

```typescript
import { Injectable } from '@nestjs/common';
import { ZohoCrmApi } from '@dereekb/zoho-nestjs';

@Injectable()
export class ContactsService {
  constructor(private readonly zohoCrmApi: ZohoCrmApi) {}

  async createContact() {
    return this.zohoCrmApi.insertRecord({
      module: 'Contacts',
      data: { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' }
    });
  }

  async getContact(id: string) {
    return this.zohoCrmApi.getRecordById({ module: 'Contacts', id });
  }

  async updateContact(id: string, lastName: string) {
    return this.zohoCrmApi.updateRecord({
      module: 'Contacts',
      data: { id, Last_Name: lastName }
    });
  }

  async deleteContact(id: string) {
    return this.zohoCrmApi.deleteRecord({ module: 'Contacts', ids: id });
  }
}
```

When passing a **single record**, the function returns the result directly or throws on error. When passing an **array** (up to 100 records), it returns `{ successItems, errorItems }`.

## 4. Search with Criteria

```typescript
// Simple criteria (all AND-joined):
const results = await this.zohoCrmApi.searchRecords({
  module: 'Contacts',
  criteria: [
    { field: 'Last_Name', filter: 'starts_with', value: 'Sm' },
    { field: 'Email', filter: 'contains', value: 'example.com' }
  ]
});

// OR logic using a criteria tree:
const results = await this.zohoCrmApi.searchRecords({
  module: 'Contacts',
  criteria: {
    or: [
      [{ field: 'Status', filter: 'equals', value: 'Active' }],
      [{ field: 'Status', filter: 'equals', value: 'Pending' }]
    ]
  }
});
```

Filter operators: `equals`, `starts_with`, `contains`. Maximum 10 criteria entries per search.

## 5. Pagination

All list/search results return `{ data, info: { more_records, page, per_page } }`. Use page factories for automatic chaining:

```typescript
const fetchPage = this.zohoCrmApi.searchRecordsPageFactory({
  module: 'Contacts',
  criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'A' }]
});

const page1 = await fetchPage.fetchNext();
const page2 = await page1.fetchNext(); // auto-follows pagination
```

## 6. Notes, Tags, and Attachments

### Notes

```typescript
// Create notes for a record
await this.zohoCrmApi.createNotesForRecord({
  module: 'Contacts',
  id: contactId,
  notes: [{ Note_Title: 'Call Log', Note_Content: 'Left voicemail' }]
});

// Get notes (paginated)
const notes = await this.zohoCrmApi.getNotesForRecord({
  module: 'Contacts',
  id: contactId,
  fields: 'Note_Title,Note_Content'
});

// Delete notes
await this.zohoCrmApi.deleteNotes({ ids: [noteId1, noteId2] });
```

### Tags

```typescript
// Create tags for a module
await this.zohoCrmApi.createTagsForModule({
  module: 'Contacts',
  tags: [{ name: 'VIP' }, { name: 'Hot Lead', color_code: '#FF0000' }]
});

// Add/remove tags on records
await this.zohoCrmApi.addTagsToRecords({
  module: 'Contacts',
  ids: [contactId],
  tag_names: ['VIP']
});

await this.zohoCrmApi.removeTagsFromRecords({
  module: 'Contacts',
  ids: [contactId],
  tag_names: ['VIP']
});
```

### Attachments

```typescript
// Upload (max 20MB)
await this.zohoCrmApi.uploadAttachmentForRecord({
  module: 'Contacts',
  id: contactId,
  file: myFile,
  attachmentCategoryName: 'Resume'
});

// List attachments
const attachments = await this.zohoCrmApi.getAttachmentsForRecord({
  module: 'Contacts',
  id: contactId
});

// Download
const fileResponse = await this.zohoCrmApi.downloadAttachmentForRecord({
  module: 'Contacts',
  id: contactId,
  attachment_id: attachmentId
});

// Delete
await this.zohoCrmApi.deleteAttachmentFromRecord({
  module: 'Contacts',
  id: contactId,
  attachment_id: attachmentId
});
```

## 7. Serverless Functions

Call Zoho CRM serverless functions via REST API:

```typescript
// OAuth-authenticated call
const result = await this.zohoCrmApi.executeRestApiFunction({
  functionName: 'my_custom_function',
  params: { contact_id: '123' }
});

// API key-authenticated call (cross-environment)
const result = await this.zohoCrmApi.executeRestApiFunction({
  functionName: 'my_custom_function',
  apiKey: 'your-zapikey',
  apiUrl: 'production'
});
```

## Key Design Details

- **Rate limiting** is built-in (default 100 req/min), auto-adjusts from `X-RATELIMIT-LIMIT` response headers, and retries on HTTP 429.
- **Token refresh** is automatic. On `ZohoInvalidTokenError`, the token is cleared and re-fetched transparently.
- **Error classes** are specific and catchable: `ZohoCrmRecordNoContentError`, `ZohoCrmRecordCrudDuplicateDataError`, `ZohoCrmRecordCrudMandatoryFieldNotFoundError`, etc.
- **Module constants** are provided for common modules: `ZOHO_CRM_LEADS_MODULE`, `ZOHO_CRM_CONTACTS_MODULE`, `ZOHO_CRM_TASKS_MODULE`, etc.
- Uses the **Zoho CRM v8 API**.