// Public API for `@dereekb/dbx-cli/firestore-indexes`.
//
// Internal helpers (`firestore-model-identity-resolver`,
// `firestore-query-helpers`, `model-firebase-index-analyze`) are not
// re-exported — they are part of the build/extract pipeline and are
// consumed via relative imports from the other modules in this package.

export * from './firestore-indexes-generate';
export * from './generate-firestore-indexes-cli';
export * from './model-firebase-index-build-manifest';
export * from './model-firebase-index-extract';
export * from './model-firebase-index-runtime';
export * from './model-firebase-index-scan-config-schema';
export * from './model-firebase-index-schema';
