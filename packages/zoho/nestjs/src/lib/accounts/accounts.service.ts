// COMPAT: the access token cache helpers moved out of the NestJS entry so NestJS-free consumers (zoho-cli, which ships as
// a self-contained bundle) can use them without @nestjs/common. The abstract service and the memory/merge helpers live in the
// browser-safe @dereekb/zoho root, and the file cache in the node-only @dereekb/zoho/node entry. They are re-exported here
// unchanged (the same bindings), so importing them from @dereekb/zoho/nestjs stays fully supported and the
// ZohoAccountsAccessTokenCacheService injection token is the same class object.
// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade: @dereekb/zoho/nestjs keeps exporting the cache helpers that moved to the nest-free entries
export { ZohoAccountsAccessTokenCacheService, type ZohoAccountsAccessTokenCacheRecord, type LogMergeZohoAccountsAccessTokenCacheServiceErrorFunction, logMergeZohoAccountsAccessTokenCacheServiceErrorFunction, mergeZohoAccountsAccessTokenCacheServices, memoryZohoAccountsAccessTokenCacheService } from '@dereekb/zoho';
// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade: @dereekb/zoho/nestjs keeps exporting the cache helpers that moved to the nest-free entries
export { type FileSystemZohoAccountsAccessTokenCacheService, DEFAULT_FILE_ZOHO_ACCOUNTS_ACCESS_TOKEN_CACHE_SERVICE_PATH, fileZohoAccountsAccessTokenCacheService } from '@dereekb/zoho/node';
