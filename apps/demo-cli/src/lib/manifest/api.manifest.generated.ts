/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run `pnpm nx run demo-cli:generate-api-manifest` to refresh.

import {
  createOidcClientParamsType,
  createStorageFileParamsType,
  createStorageFileSignedUploadUrlParamsType,
  deleteOidcClientParamsType,
  deleteOidcTokenParamsType,
  deleteStorageFileParamsType,
  downloadMultipleStorageFilesParamsType,
  downloadStorageFileParamsType,
  initializeAllStorageFilesFromUploadsParamsType,
  initializeStorageFileFromUploadParamsType,
  processStorageFileParamsType,
  readMultipleStorageFilesMetadataParamsType,
  readStorageFileMetadataParamsType,
  regenerateStorageFileGroupContentParamsType,
  resyncNotificationUserParamsType,
  rotateOidcClientSecretParamsType,
  sendNotificationParamsType,
  syncStorageFileWithGroupsParamsType,
  updateNotificationBoxParamsType,
  updateNotificationBoxRecipientParamsType,
  updateNotificationSummaryParamsType,
  updateNotificationUserParamsType,
  updateOidcClientParamsType,
  updateStorageFileGroupParamsType,
  updateStorageFileParamsType
} from '@dereekb/firebase';
import {
  allPublishedGuestbookEntriesParamsType,
  createGuestbookParamsType,
  downloadProfileArchiveParamsType,
  entryDetailsGuestbookEntryParamsType,
  exampleReadParamsType,
  finishOnboardingProfileParamsType,
  guestbookEntryParamsType,
  insertGuestbookEntryParamsType,
  likeGuestbookEntryParamsType,
  profileCreateTestNotificationParamsType,
  publishGuestbookParamsType,
  resetProfilePasswordParamsType,
  setProfileUsernameParamsType,
  subscribeToGuestbookNotificationsParamsType,
  updateProfileParamsType
} from 'demo-firebase';
import { type CliApiManifest, type CliModelManifest, type CliEnumManifest } from '@dereekb/dbx-cli';

export const DEMO_CLI_API_MANIFEST: CliApiManifest = [
  {
    model: 'guestbook',
    verb: 'create',
    paramsTypeName: 'CreateGuestbookParams',
    paramsValidator: createGuestbookParamsType,
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsFields: [
      { name: 'name', typeText: 'string' },
      { name: 'published', typeText: 'Maybe<boolean>' },
      { name: 'cby', typeText: 'Maybe<ProfileId>' }
    ]
  },
  { model: 'guestbook', verb: 'query', paramsTypeName: 'QueryGuestbooksParams', resultTypeName: 'OnCallQueryModelResult', groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts', paramsTypeDescription: 'Query parameters for searching guestbooks.', paramsFields: [{ name: 'published', typeText: 'boolean', description: 'Filter by published status. When omitted, returns all guestbooks.' }] },
  { model: 'guestbook', verb: 'update', specifier: 'publish', paramsTypeName: 'PublishGuestbookParams', paramsValidator: publishGuestbookParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts', paramsTypeDescription: 'Parameters for the `guestbook / update / publish` call. One-way publish of the targeted guestbook.' },
  { model: 'guestbook', verb: 'update', specifier: 'subscribeToNotifications', paramsTypeName: 'SubscribeToGuestbookNotificationsParams', paramsValidator: subscribeToGuestbookNotificationsParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbookEntry', verb: 'delete', paramsTypeName: 'GuestbookEntryParams', paramsValidator: guestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts', paramsFields: [{ name: 'guestbook', typeText: 'string' }] },
  {
    model: 'guestbookEntry',
    verb: 'invoke',
    specifier: 'allPublishedEntries',
    paramsTypeName: 'AllPublishedGuestbookEntriesParams',
    paramsValidator: allPublishedGuestbookEntriesParamsType,
    resultTypeName: 'AllPublishedGuestbookEntriesResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsTypeDescription: 'Parameters for the `guestbookEntry / invoke / allPublishedEntries` RPC.\n\nServer-side equivalent of the client-side\n{@link QUERY_ALL_PUBLISHED_GUESTBOOK_ENTRIES_ACTION} composition — paginates\nthe cross-guestbook query internally and returns one aggregate response. Use\nthis when the caller wants a single round trip instead of driving pagination.',
    paramsFields: [{ name: 'limit', typeText: 'Maybe<number>', description: 'Cap the number of entries returned. The server enforces an additional hard upper bound.' }],
    resultTypeDescription: 'Result of an all-published-entries invoke.',
    resultFields: [
      { name: 'count', typeText: 'number' },
      { name: 'entries', typeText: 'ReadonlyArray<GuestbookEntry>' },
      { name: 'hitLimit', typeText: 'boolean' }
    ],
    mcpResultTypeName: 'AllPublishedGuestbookEntriesMcpResult',
    mcpResultTypeDescription: "MCP-mapped projection of {@link AllPublishedGuestbookEntriesResult}.\n\nReturned to MCP clients via the handler's `mapSuccessfulResult` mapper — drops the potentially\nlarge `entries` array (an LLM rarely needs every full entry document) down to the aggregate\ncounts, demonstrating how MCP access can strip unhelpful information from a callModel result.",
    mcpResultFields: [
      { name: 'count', typeText: 'number', description: 'Number of published entries gathered.' },
      { name: 'hitLimit', typeText: 'boolean', description: 'Whether the server-side hard cap was hit before the collection group was exhausted.' }
    ]
  },
  {
    model: 'guestbookEntry',
    verb: 'invoke',
    specifier: 'entryDetails',
    paramsTypeName: 'EntryDetailsGuestbookEntryParams',
    paramsValidator: entryDetailsGuestbookEntryParamsType,
    resultTypeName: 'EntryDetailsGuestbookEntryResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsTypeDescription: "Parameters for the `guestbookEntry / invoke / entryDetails` RPC.\n\nTargets a single GuestbookEntry by key (the store's current document) and\nreturns a computed summary. Exists primarily as a keyed-invoke example\nexercising {@link firebaseDocumentStoreInvokeFunction}.",
    resultTypeDescription: 'Result of an entry-details invoke — a small computed projection of the targeted GuestbookEntry.',
    resultFields: [
      { name: 'key', typeText: 'FirestoreModelKey' },
      { name: 'messageLength', typeText: 'number' },
      { name: 'signedLength', typeText: 'number' },
      { name: 'published', typeText: 'boolean' },
      { name: 'likes', typeText: 'number' },
      { name: 'ageMs', typeText: 'Milliseconds' }
    ]
  },
  {
    model: 'guestbookEntry',
    verb: 'query',
    specifier: '_',
    paramsTypeName: 'QueryGuestbookEntriesParams',
    resultTypeName: 'OnCallQueryModelResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsTypeDescription: 'Query parameters for searching guestbook entries for one guestbook.\n\nUsed with the default `guestbookEntry.query._` specifier — for cross-guestbook\ncollection-group queries, see {@link QueryAllGuestbookEntriesParams}.',
    paramsFields: [
      { name: 'guestbook', typeText: 'GuestbookKey', description: 'Key of the parent guestbook to query entries from. Required.' },
      { name: 'published', typeText: 'boolean', description: 'Filter by published status. When omitted, returns all entries.' }
    ]
  },
  {
    model: 'guestbookEntry',
    verb: 'query',
    specifier: 'entries',
    paramsTypeName: 'QueryAllGuestbookEntriesParams',
    resultTypeName: 'OnCallQueryModelResult',
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsTypeDescription: 'Query parameters for searching GuestbookEntry across all guestbooks via the collection group.\n\nUsed with the `guestbookEntry.query.entries` specifier — unlike\n{@link QueryGuestbookEntriesParams}, the parent guestbook key is NOT required.',
    paramsFields: [{ name: 'published', typeText: 'boolean', description: 'Filter by published status. When omitted, returns all entries the caller is allowed to see\n(server-side admin gate may restrict non-admins to `published: true`).' }]
  },
  {
    model: 'guestbookEntry',
    verb: 'update',
    specifier: 'insert',
    paramsTypeName: 'InsertGuestbookEntryParams',
    paramsValidator: insertGuestbookEntryParamsType,
    groupName: 'Guestbook',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts',
    paramsFields: [
      { name: 'message', typeText: 'string' },
      { name: 'signed', typeText: 'string' },
      { name: 'published', typeText: 'boolean' }
    ]
  },
  { model: 'guestbookEntry', verb: 'update', specifier: 'like', paramsTypeName: 'LikeGuestbookEntryParams', paramsValidator: likeGuestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  {
    model: 'notification',
    verb: 'update',
    specifier: 'send',
    paramsTypeName: 'SendNotificationParams',
    paramsValidator: sendNotificationParamsType,
    resultTypeName: 'SendNotificationResult',
    groupName: 'NotificationBox',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts',
    paramsTypeDescription: 'Used for sending the notification immediately, if it has not already been sent.',
    paramsFields: [
      { name: 'ignoreSendAtThrottle', typeText: 'Maybe<boolean>' },
      { name: 'throwErrorIfSent', typeText: 'Maybe<boolean>' }
    ],
    resultTypeDescription: 'Detailed result returned by the `sendNotification` function, describing the outcome of sending a single notification.',
    resultFields: [
      { name: 'notificationTemplateType', typeText: 'Maybe<NotificationTemplateType>' },
      { name: 'isKnownTemplateType', typeText: 'Maybe<boolean>' },
      { name: 'isNotificationTask', typeText: 'boolean' },
      { name: 'isLoggedEvent', typeText: 'boolean', description: 'True if the notification was a logged-event record (`st === LOGGED_EVENT`). Logged events bypass\nthe send pipeline entirely; the factory short-circuits and returns immediately when one is loaded.' },
      { name: 'isUniqueNotificationTask', typeText: 'boolean' },
      { name: 'uniqueNotificationTaskConflict', typeText: 'boolean' },
      { name: 'isConfiguredTemplateType', typeText: 'Maybe<boolean>' },
      { name: 'throttled', typeText: 'boolean' },
      { name: 'success', typeText: 'boolean' },
      { name: 'notificationTaskCompletionType', typeText: 'Maybe<NotificationTaskServiceTaskHandlerCompletionType>' },
      { name: 'notificationTaskPartsRunCount', typeText: 'Maybe<number>' },
      { name: 'notificationTaskLoopingProtectionTriggered', typeText: 'Maybe<boolean>' },
      { name: 'notificationMarkedDone', typeText: 'boolean' },
      { name: 'createdBox', typeText: 'boolean' },
      { name: 'notificationBoxNeedsInitialization', typeText: 'boolean' },
      { name: 'deletedNotification', typeText: 'boolean' },
      { name: 'exists', typeText: 'boolean' },
      { name: 'boxExists', typeText: 'boolean' },
      { name: 'tryRun', typeText: 'boolean' },
      { name: 'sendEmailsResult', typeText: 'Maybe<NotificationSendEmailMessagesResult>' },
      { name: 'sendTextsResult', typeText: 'Maybe<NotificationSendTextMessagesResult>' },
      { name: 'sendNotificationSummaryResult', typeText: 'Maybe<NotificationSendNotificationSummaryMessagesResult>' },
      { name: 'loadMessageFunctionFailure', typeText: 'boolean' },
      { name: 'buildMessageFailure', typeText: 'boolean' },
      { name: 'onSendAttemptedResult', typeText: 'Maybe<SendNotificationResultOnSendCompleteResult>' },
      { name: 'onSendSuccessResult', typeText: 'Maybe<SendNotificationResultOnSendCompleteResult>' }
    ]
  },
  { model: 'notificationBox', verb: 'update', specifier: '_', paramsTypeName: 'UpdateNotificationBoxParams', paramsValidator: updateNotificationBoxParamsType, groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts', paramsTypeDescription: 'Used for updating the NotificationBox.' },
  {
    model: 'notificationBox',
    verb: 'update',
    specifier: 'recipient',
    paramsTypeName: 'UpdateNotificationBoxRecipientParams',
    paramsValidator: updateNotificationBoxRecipientParamsType,
    groupName: 'NotificationBox',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts',
    paramsTypeDescription: 'Used to create/update a notification box recipient.',
    paramsFields: [
      { name: 'key', typeText: 'FirestoreModelKey' },
      { name: 'i', typeText: 'Maybe<IndexNumber>' },
      { name: 'uid', typeText: 'Maybe<FirebaseAuthUserId>' },
      { name: 'insert', typeText: 'Maybe<boolean>' },
      { name: 'enabled', typeText: 'Maybe<boolean>' },
      { name: 'remove', typeText: 'Maybe<boolean>' },
      { name: 'setExclusion', typeText: 'Maybe<boolean>' }
    ]
  },
  {
    model: 'notificationSummary',
    verb: 'update',
    specifier: '_',
    paramsTypeName: 'UpdateNotificationSummaryParams',
    paramsValidator: updateNotificationSummaryParamsType,
    groupName: 'NotificationBox',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts',
    paramsTypeDescription: 'Used for updating the NotificationSummary.',
    paramsFields: [
      { name: 'flagAllRead', typeText: 'Maybe<boolean>' },
      { name: 'setReadAtTime', typeText: 'Maybe<Date>' }
    ]
  },
  {
    model: 'notificationUser',
    verb: 'update',
    specifier: '_',
    paramsTypeName: 'UpdateNotificationUserParams',
    paramsValidator: updateNotificationUserParamsType,
    groupName: 'NotificationBox',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts',
    paramsTypeDescription: 'Used for updating the NotificationUser.',
    paramsFields: [
      { name: 'gc', typeText: 'Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>' },
      { name: 'dc', typeText: 'Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>' },
      { name: 'bc', typeText: 'Maybe<UpdateNotificationUserNotificationBoxRecipientParams[]>' }
    ]
  },
  { model: 'notificationUser', verb: 'update', specifier: 'resync', paramsTypeName: 'ResyncNotificationUserParams', paramsValidator: resyncNotificationUserParamsType, resultTypeName: 'ResyncNotificationUserResult', groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts', resultFields: [{ name: 'notificationBoxesUpdated', typeText: 'number' }] },
  {
    model: 'oidcEntry',
    verb: 'create',
    specifier: 'client',
    paramsTypeName: 'CreateOidcClientParams',
    paramsValidator: createOidcClientParamsType,
    resultTypeName: 'CreateOidcClientResult',
    groupName: 'Oidc',
    sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts',
    paramsTypeDescription: 'Parameters for registering a new OAuth client for the target entity.\n\nIf no target model is provided, assumes the current user.\n\nThe server generates `client_id` and `client_secret` and creates the adapter entry.\n\nExtends {@link UpdateOidcClientFieldParams} with `token_endpoint_auth_method` which is immutable after creation.',
    paramsFields: [
      { name: 'token_endpoint_auth_method', typeText: 'OidcTokenEndpointAuthMethod' },
      { name: 'jwks_uri', typeText: 'WebsiteUrlWithPrefix', description: "URL where the client's public JSON Web Key Set can be fetched.\n\nUsed with `private_key_jwt` authentication so the provider can retrieve\nthe client's public keys to verify `client_assertion` JWTs.\nThe client manages key rotation at this URL independently." }
    ],
    resultTypeDescription: 'Result of creating a new OAuth client.\n\nIncludes the generated `client_secret` in plaintext — this is the only time\nit is returned to the caller.',
    resultFields: [
      { name: 'client_id', typeText: 'OidcEntryClientId' },
      { name: 'client_secret', typeText: 'string', description: 'The generated client secret in plaintext. Only returned for auth methods that require a secret\n(e.g., `client_secret_basic`, `client_secret_post`, `client_secret_jwt`). Undefined for the\nsecret-less methods `private_key_jwt` and `none` (public PKCE client) — those clients never\nhave a secret to return.' }
    ]
  },
  { model: 'oidcEntry', verb: 'delete', specifier: 'client', paramsTypeName: 'DeleteOidcClientParams', paramsValidator: deleteOidcClientParamsType, groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts', paramsTypeDescription: 'Parameters for revoking/deleting an OAuth client.' },
  {
    model: 'oidcEntry',
    verb: 'delete',
    specifier: 'token',
    paramsTypeName: 'DeleteOidcTokenParams',
    paramsValidator: deleteOidcTokenParamsType,
    groupName: 'Oidc',
    sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts',
    paramsTypeDescription: "Parameters for revoking a user's own OIDC token entry.\n\nThe target {@link OidcEntry} must be of type `Grant` and have its `uid`\nmatching the authenticated user. Revoking a grant cascades through\noidc-provider's grantable models (`AccessToken`, `RefreshToken`,\n`AuthorizationCode`, `DeviceCode`, `BackchannelAuthenticationRequest`),\ndeleting all entries that share the grant id."
  },
  { model: 'oidcEntry', verb: 'update', specifier: 'client', paramsTypeName: 'UpdateOidcClientParams', paramsValidator: updateOidcClientParamsType, groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts', paramsTypeDescription: 'Parameters for updating an existing OAuth client.\n\nUses {@link UpdateOidcClientFieldParams} — `token_endpoint_auth_method` is immutable.' },
  { model: 'oidcEntry', verb: 'update', specifier: 'rotateClientSecret', paramsTypeName: 'RotateOidcClientSecretParams', paramsValidator: rotateOidcClientSecretParamsType, resultTypeName: 'RotateOidcClientSecretResult', groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts' },
  {
    model: 'profile',
    verb: 'delete',
    paramsTypeName: 'UpdateProfileParams',
    paramsValidator: updateProfileParamsType,
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: "Deletes the current user's profile and associated private data.\n\nCurrently aliased to `UpdateProfileParams` for the params shape — only\nthe inferred target key is consumed.",
    paramsTypeDescription: "Params for updating the editable fields on the current user's profile.\n\nOnly fields explicitly provided are updated (merge-set). Pass `null` to\nclear an optional field.",
    paramsFields: [{ name: 'bio', typeText: 'Maybe<string>', description: 'Free-form profile bio, capped at 200 characters. Pass `null` to clear.' }]
  },
  {
    model: 'profile',
    verb: 'read',
    specifier: 'downloadArchive',
    paramsTypeName: 'DownloadProfileArchiveParams',
    paramsValidator: downloadProfileArchiveParamsType,
    resultTypeName: 'DownloadProfileArchiveResult',
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: "Generates and returns a signed URL for downloading a ZIP archive of\nthe current user's profile data. The archive is generated on demand\nand the URL expires after a short window."
  },
  {
    model: 'profile',
    verb: 'update',
    specifier: '_',
    paramsTypeName: 'UpdateProfileParams',
    paramsValidator: updateProfileParamsType,
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: "Updates editable fields on the current user's profile (currently `bio`).\n\nPerforms a merge-set so only the provided fields are overwritten.\nPass `null` for an optional field to clear it.",
    paramsTypeDescription: "Params for updating the editable fields on the current user's profile.\n\nOnly fields explicitly provided are updated (merge-set). Pass `null` to\nclear an optional field.",
    paramsFields: [{ name: 'bio', typeText: 'Maybe<string>', description: 'Free-form profile bio, capped at 200 characters. Pass `null` to clear.' }]
  },
  {
    model: 'profile',
    verb: 'update',
    specifier: 'createTestNotification',
    paramsTypeName: 'ProfileCreateTestNotificationParams',
    paramsValidator: profileCreateTestNotificationParamsType,
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: "Creates a test notification on the current user's profile to exercise\nthe notification pipeline.\n\nCaps the number of test notifications per profile at 6 (throws when\nexceeded). Honors `skipSend` to persist without enqueuing, and\n`expediteSend` to dispatch immediately via the expedite service.",
    paramsTypeDescription: "Params for creating a test notification on the current user's profile.\n\nUsed by the demo to exercise the notification pipeline end-to-end without\ntriggering a real notification trigger.",
    paramsFields: [
      { name: 'skipSend', typeText: 'Maybe<boolean>', description: 'When true, the notification is created in the database but not enqueued\nfor sending. Useful for inspecting the persisted record without consuming\na delivery slot.' },
      { name: 'expediteSend', typeText: 'Maybe<boolean>', description: 'When true, the notification is sent immediately via the expedite service\nrather than waiting for the regular send window.' }
    ]
  },
  { model: 'profile', verb: 'update', specifier: 'onboard', paramsTypeName: 'FinishOnboardingProfileParams', paramsValidator: finishOnboardingProfileParamsType, resultTypeName: 'boolean', groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts', description: 'Marks onboarding complete for the current user.\n\nInitializes the profile document if it does not exist, then grants the\n`onboarded` and `tos-signed` auth roles. Returns `true` on success.' },
  {
    model: 'profile',
    verb: 'update',
    specifier: 'resetPassword',
    paramsTypeName: 'ResetProfilePasswordParams',
    paramsValidator: resetProfilePasswordParamsType,
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: 'Initiates or completes a password reset for the current user.\n\nSet `requestReset: true` to start a new reset (generates a temporary\ncode and sends an email). Provide `oobCode` + `newPassword` to\ncomplete the reset by verifying the code and setting the new password.',
    paramsTypeDescription: "Params for initiating or completing a password reset for the current user's profile.\n\nSet `requestReset: true` to initiate a new password reset (generates a temporary code and sends an email).\nProvide `oobCode` and `newPassword` to complete the reset by verifying the code and setting the new password.",
    paramsFields: [
      { name: 'requestReset', typeText: 'Maybe<boolean>', description: 'When true, initiates a new password reset and sends the reset email.' },
      { name: 'email', typeText: 'Maybe<string>', description: "Email address identifying the target user for a logged-out forgot-password request.\nOnly consulted when the caller has no authenticated user context; an authenticated\ncaller's `auth.uid` always takes precedence." },
      { name: 'oobCode', typeText: 'Maybe<string>', description: 'The full oob token from the recovery email — includes the embedded uid; do not split or mutate.\nThe server decodes the token to resolve the target user, so this single value is sufficient\neven for a logged-out forgot-password flow.' },
      { name: 'newPassword', typeText: 'Maybe<string>', description: 'The new password to set. Required to complete the reset.' }
    ]
  },
  {
    model: 'profile',
    verb: 'update',
    specifier: 'username',
    paramsTypeName: 'SetProfileUsernameParams',
    paramsValidator: setProfileUsernameParamsType,
    groupName: 'Profile',
    sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts',
    description: "Sets the current user's profile username.\n\nNormalizes to lowercase, checks for conflicts with existing profiles,\nand updates the private data's `usernameSetAt` timestamp when the\nvalue actually changed. Throws `usernameAlreadyTaken` when the\nrequested username belongs to another profile.",
    paramsTypeDescription: "Params for changing the current user's profile username.\n\nUsernames are normalized to lowercase server-side and must be unique across\nall profiles.",
    paramsFields: [{ name: 'username', typeText: 'string', description: 'Desired username. 1-30 characters; case-insensitive and unique. The server\nlowercases the value before persisting and rejects collisions with the\n`usernameAlreadyTaken` error.' }]
  },
  { model: 'storageFile', verb: 'create', specifier: '_', paramsTypeName: 'CreateStorageFileParams', paramsValidator: createStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts', paramsTypeDescription: 'Parameters for directly creating a new StorageFile document (no upload initialization).\n\nTypically used server-side or for testing. Validated with {@link createStorageFileParamsType}.' },
  {
    model: 'storageFile',
    verb: 'create',
    specifier: 'allFromUpload',
    paramsTypeName: 'InitializeAllStorageFilesFromUploadsParams',
    paramsValidator: initializeAllStorageFilesFromUploadsParamsType,
    resultTypeName: 'InitializeAllStorageFilesFromUploadsResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for batch-initializing all files found in the uploads folder.\n\nScans the uploads folder (or a custom path) and runs the upload determination/initialization\npipeline for each file found. Validated with {@link initializeAllStorageFilesFromUploadsParamsType}.',
    paramsFields: [
      { name: 'maxFilesToInitialize', typeText: 'Maybe<number>' },
      { name: 'folderPath', typeText: 'Maybe<StorageSlashPath>' },
      { name: 'overrideUploadsFolderPath', typeText: 'Maybe<StorageSlashPath>' }
    ],
    resultTypeDescription: 'Result of batch upload initialization, reporting visit and success/failure counts.',
    resultFields: [
      { name: 'filesVisited', typeText: 'number' },
      { name: 'initializationsSuccessCount', typeText: 'number' },
      { name: 'initializationsFailureCount', typeText: 'number' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'create',
    specifier: 'fromUpload',
    paramsTypeName: 'InitializeStorageFileFromUploadParams',
    paramsValidator: initializeStorageFileFromUploadParamsType,
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for initializing a single StorageFile from an uploaded file at a specific storage path.\n\nThe file is run through the upload type determination pipeline and, if matched,\ncreates a corresponding StorageFile document. Validated with {@link initializeStorageFileFromUploadParamsType}.',
    paramsFields: [
      { name: 'bucketId', typeText: 'Maybe<StorageBucketId>' },
      { name: 'pathString', typeText: 'StorageSlashPath' },
      { name: 'expediteProcessing', typeText: 'Maybe<boolean>' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'create',
    specifier: 'signedUploadUrl',
    paramsTypeName: 'CreateStorageFileSignedUploadUrlParams',
    paramsValidator: createStorageFileSignedUploadUrlParamsType,
    resultTypeName: 'CreateStorageFileSignedUploadUrlResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: "Parameters for creating a short-lived signed PUT URL for a StorageFile upload.\n\nThe resulting URL is restricted to a specific {@link StorageFilePurpose}, MIME\ntype, and file size and lands the bytes inside the authenticated caller's\n`/uploads/u/{uid}/...` namespace. Once uploaded, the existing\n`StorageFileInitializeFromUploadService` flow picks the file up and creates\nthe matching `StorageFile` document.",
    paramsFields: [
      { name: 'purpose', typeText: 'StorageFilePurpose', description: "The {@link StorageFilePurpose} to upload as. Must be supported by the\napp's signed-upload-url policy registry. The chosen policy decides where\nthe file lands and which content-types/sizes are allowed." },
      { name: 'contentType', typeText: 'ContentTypeMimeType', description: "The MIME type the client intends to PUT. Validated against the policy's\n`allowedMimeTypes` and signed into the URL so GCS rejects any PUT with a\ndifferent `Content-Type`." },
      { name: 'filename', typeText: 'Maybe<SlashPathFile>', description: "Filename to place inside the policy's upload folder. Required when the\npolicy has `requiresFilenameInput: true`. Sanitized server-side — must not\ncontain `/`, `..`, or NUL bytes; capped at\n{@link CREATE_STORAGE_FILE_SIGNED_UPLOAD_URL_MAX_FILENAME_LENGTH} chars." },
      { name: 'fileSizeBytes', typeText: 'number', description: "Client-declared size in bytes for the upload. Validated against the\npolicy's `maxFileSizeBytes` cap. The storage rules independently enforce\nthe same cap via `request.resource.size`." },
      { name: 'expiresInMs', typeText: 'Maybe<Milliseconds>', description: 'Lifetime of the signed URL in milliseconds. Clamped to\n[{@link CREATE_STORAGE_FILE_SIGNED_UPLOAD_URL_MIN_EXPIRES_IN_MS},\n{@link CREATE_STORAGE_FILE_SIGNED_UPLOAD_URL_MAX_EXPIRES_IN_MS}].\nDefaults to {@link DEFAULT_CREATE_STORAGE_FILE_SIGNED_UPLOAD_URL_EXPIRES_IN_MS}\nwhen omitted.' }
    ],
    resultTypeDescription: 'Result of creating a signed upload URL.\n\nThe caller PUTs the file bytes to {@link uploadUrl} with the headers in\n{@link requiredHeaders}. The existing initializer flow then picks the file\nup from {@link uploadPath} and creates the StorageFile document.\n\n`modelKeys` is intentionally empty — minting the URL does not create a\nStorageFile document; the document is created later by the upload-complete\npipeline.',
    resultFields: [
      { name: 'modelKeys', typeText: '[]' },
      { name: 'uploadUrl', typeText: 'string', description: 'Short-lived, content-type-pinned PUT URL.' },
      { name: 'uploadPath', typeText: 'SlashPath', description: 'The full storage path the URL writes to (inside `/uploads/u/{uid}/...`).\nReturned so the caller can confirm where the file landed.' },
      { name: 'expiresAt', typeText: 'UnixDateTimeMillisecondsNumber', description: 'Unix millisecond timestamp at which the URL expires.' },
      { name: 'requiredHeaders', typeText: 'Readonly<Record<string, string>>', description: 'Headers the caller MUST send on the PUT for the signature to validate.\nAt minimum, the `content-type` matches the signed value.' },
      { name: 'maxFileSizeBytes', typeText: 'number', description: "Echo of the policy's `maxFileSizeBytes` cap, for caller-side validation." },
      { name: 'purpose', typeText: 'StorageFilePurpose', description: 'The resolved {@link StorageFilePurpose}.' }
    ]
  },
  { model: 'storageFile', verb: 'delete', specifier: '_', paramsTypeName: 'DeleteStorageFileParams', paramsValidator: deleteStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts', paramsFields: [{ name: 'force', typeText: 'Maybe<boolean>' }] },
  {
    model: 'storageFile',
    verb: 'read',
    specifier: 'download',
    paramsTypeName: 'DownloadStorageFileParams',
    paramsValidator: downloadStorageFileParamsType,
    resultTypeName: 'DownloadStorageFileResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for generating a signed download URL for a single StorageFile.\n\nExtends {@link DownloadStorageFileOptions} with target model key.\nValidated with {@link downloadStorageFileParamsType}.',
    resultTypeDescription: 'Result of downloading a StorageFile.',
    resultFields: [
      { name: 'url', typeText: 'StorageFileSignedDownloadUrl' },
      { name: 'fileName', typeText: 'Maybe<string>' },
      { name: 'mimeType', typeText: 'Maybe<ContentTypeMimeType>' },
      { name: 'expiresAt', typeText: 'Maybe<UnixDateTimeSecondsNumber>' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'read',
    specifier: 'downloadMultiple',
    paramsTypeName: 'DownloadMultipleStorageFilesParams',
    paramsValidator: downloadMultipleStorageFilesParamsType,
    resultTypeName: 'DownloadMultipleStorageFilesResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for batch-downloading multiple StorageFiles.\n\nTop-level {@link DownloadStorageFileOptions} serve as defaults for all files.\nEach item in `files` can override per-file options (except `asAdmin`, which is root-level only).\nValidated with {@link downloadMultipleStorageFilesParamsType}.',
    paramsFields: [
      { name: 'files', typeText: 'DownloadMultipleStorageFilesFileParams[]' },
      { name: 'throwOnFirstError', typeText: 'Maybe<boolean>', description: 'When true, throws on the first download failure instead of collecting it in the errors array.' }
    ],
    resultTypeDescription: 'Result of a batch StorageFile download.\n\nContains separate arrays for successful downloads and failures.\nIndividual download errors do not fail the entire batch.',
    resultFields: [
      { name: 'success', typeText: 'DownloadMultipleStorageFileSuccessItem[]' },
      { name: 'errors', typeText: 'DownloadMultipleStorageFileErrorItem[]' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'read',
    specifier: 'metadata',
    paramsTypeName: 'ReadStorageFileMetadataParams',
    paramsValidator: readStorageFileMetadataParamsType,
    resultTypeName: 'ReadStorageFileMetadataResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: "Parameters for reading the underlying Cloud Storage object metadata of a single StorageFile.\n\nUnlike {@link DownloadStorageFileParams}, no signed URL is minted — only the object's\n{@link StorageMetadata} (size, md5Hash, generation, content headers, custom metadata, etc.) is returned.\n`asAdmin` only selects the read role used for permission gating. Validated with {@link readStorageFileMetadataParamsType}.",
    paramsFields: [{ name: 'asAdmin', typeText: 'Maybe<boolean>' }],
    resultTypeDescription: "Result of reading a StorageFile's underlying Cloud Storage object metadata.\n\nWhen the underlying object does not exist, `exists` is false and `metadata` is omitted\ninstead of the call throwing — useful for polling whether an upload has landed.",
    resultFields: [
      { name: 'exists', typeText: 'boolean' },
      { name: 'metadata', typeText: 'Maybe<StorageMetadata>' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'read',
    specifier: 'metadataMultiple',
    paramsTypeName: 'ReadMultipleStorageFilesMetadataParams',
    paramsValidator: readMultipleStorageFilesMetadataParamsType,
    resultTypeName: 'ReadMultipleStorageFilesMetadataResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for batch-reading the Cloud Storage metadata of multiple StorageFiles.\n\n`asAdmin` selects the read role for the whole batch. Validated with {@link readMultipleStorageFilesMetadataParamsType}.',
    paramsFields: [
      { name: 'files', typeText: 'ReadMultipleStorageFilesMetadataFileParams[]' },
      { name: 'asAdmin', typeText: 'Maybe<boolean>' },
      { name: 'throwOnFirstError', typeText: 'Maybe<boolean>', description: 'When true, throws on the first failure instead of collecting it in the errors array.' }
    ],
    resultTypeDescription: 'Result of a batch StorageFile metadata read.\n\nContains separate arrays for successful reads and failures.\nIndividual read errors do not fail the entire batch.',
    resultFields: [
      { name: 'success', typeText: 'ReadMultipleStorageFileMetadataSuccessItem[]' },
      { name: 'errors', typeText: 'ReadMultipleStorageFileMetadataErrorItem[]' }
    ]
  },
  { model: 'storageFile', verb: 'update', specifier: '_', paramsTypeName: 'UpdateStorageFileParams', paramsValidator: updateStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts', paramsFields: [{ name: 'sdat', typeText: 'Maybe<Date>' }] },
  {
    model: 'storageFile',
    verb: 'update',
    specifier: 'process',
    paramsTypeName: 'ProcessStorageFileParams',
    paramsValidator: processStorageFileParamsType,
    resultTypeName: 'ProcessStorageFileResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsTypeDescription: 'Parameters for triggering processing of a specific StorageFile.\n\nSupports various modes: immediate processing, retry checking, force restart,\nand reprocessing already-successful files. Validated with {@link processStorageFileParamsType}.',
    paramsFields: [
      { name: 'runImmediately', typeText: 'Maybe<boolean>' },
      { name: 'checkRetryProcessing', typeText: 'Maybe<boolean>' },
      { name: 'forceRestartProcessing', typeText: 'Maybe<boolean>' },
      { name: 'processAgainIfSuccessful', typeText: 'Maybe<boolean>' }
    ],
    resultFields: [
      { name: 'runImmediately', typeText: 'boolean' },
      { name: 'expediteResult', typeText: 'Maybe<SendNotificationResult>' }
    ]
  },
  {
    model: 'storageFile',
    verb: 'update',
    specifier: 'syncWithGroups',
    paramsTypeName: 'SyncStorageFileWithGroupsParams',
    paramsValidator: syncStorageFileWithGroupsParamsType,
    resultTypeName: 'SyncStorageFileWithGroupsResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsFields: [{ name: 'force', typeText: 'Maybe<boolean>' }],
    resultFields: [
      { name: 'storageFilesGroupsCreated', typeText: 'number' },
      { name: 'storageFilesGroupsUpdated', typeText: 'number' }
    ]
  },
  { model: 'storageFileGroup', verb: 'update', specifier: '_', paramsTypeName: 'UpdateStorageFileGroupParams', paramsValidator: updateStorageFileGroupParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts', paramsFields: [{ name: 'entries', typeText: 'Maybe<UpdateStorageFileGroupEntryParams[]>' }] },
  {
    model: 'storageFileGroup',
    verb: 'update',
    specifier: 'regenerateContent',
    paramsTypeName: 'RegenerateStorageFileGroupContentParams',
    paramsValidator: regenerateStorageFileGroupContentParamsType,
    resultTypeName: 'RegenerateStorageFileGroupContentResult',
    groupName: 'StorageFile',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts',
    paramsFields: [{ name: 'force', typeText: 'Maybe<boolean>' }],
    resultFields: [{ name: 'contentStorageFilesFlaggedForProcessing', typeText: 'number' }]
  },
  {
    model: 'systemState',
    verb: 'read',
    specifier: 'exampleread',
    paramsTypeName: 'ExampleReadParams',
    paramsValidator: exampleReadParamsType,
    resultTypeName: 'ExampleReadResponse',
    groupName: 'SystemState',
    sourceFile: 'components/demo-firebase/src/lib/model/system/system.api.ts',
    paramsFields: [{ name: 'message', typeText: 'string' }],
    resultFields: [
      { name: 'read', typeText: 'boolean' },
      { name: 'message', typeText: 'string' }
    ]
  }
];

export const DEMO_CLI_MODEL_MANIFEST: CliModelManifest = [
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    modelGroup: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    description: 'A guestbook record that owns a list of {@link GuestbookEntry} signatures.',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [
      { name: 'published', longName: 'published', tsType: 'boolean', optional: false, description: 'Whether or not this guestbook should show up in the list.' },
      { name: 'name', longName: 'name', tsType: 'string', optional: false, description: 'Guestbook name.' },
      { name: 'locked', longName: 'locked', tsType: 'boolean', optional: false, description: "Whether or not this guestbook and it's entries can still be edited." },
      { name: 'lockedAt', longName: 'lockedAt', tsType: 'Maybe<Date>', optional: true, description: 'Date the guestbook was locked at.' },
      { name: 'cby', longName: 'createdBy', tsType: 'Maybe<ProfileId>', optional: true, description: 'User who created the guestbook.' }
    ],
    read: 'permissions',
    serviceFactory: { exportName: 'guestbookFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'guestbookEntry',
    modelName: 'GuestbookEntry',
    modelGroup: 'Guestbook',
    identityConst: 'guestbookEntryIdentity',
    collectionPrefix: 'gbe',
    parentIdentityConst: 'guestbookIdentity',
    description: 'A signed entry in a {@link Guestbook}.',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [
      { name: 'uid', longName: 'uid', optional: false },
      { name: 'message', longName: 'message', tsType: 'string', optional: false, description: 'Guestbook message.' },
      { name: 'signed', longName: 'signed', tsType: 'string', optional: false, description: 'Arbitrary string for signature.' },
      { name: 'updatedAt', longName: 'updatedAt', tsType: 'Date', optional: false, description: 'Date the entry was last updated at.' },
      { name: 'createdAt', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Date the entry was originally created at.' },
      { name: 'published', longName: 'published', tsType: 'boolean', optional: false, description: 'Whether or not the entry has been published. It can be unpublished at any time by the user.' },
      { name: 'likes', longName: 'likes', tsType: 'number', optional: false, description: 'The number of likes the entry has recieved from users.' }
    ],
    read: 'owner',
    serviceFactory: { exportName: 'guestbookEntryFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notification',
    modelName: 'Notification',
    identityConst: 'notificationIdentity',
    collectionPrefix: 'nbn',
    parentIdentityConst: 'notificationBoxIdentity',
    description: 'Individual notification document, stored as a subcollection of {@link NotificationBox}.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [
      { name: 'cat', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Creation timestamp.' },
      { name: 'st', longName: 'sendType', tsType: 'NotificationSendType', optional: false, description: 'Send type controlling how this notification interacts with its parent NotificationBox.', enumRef: 'NotificationSendType' },
      { name: 'rf', longName: 'recipientSendFlag', tsType: 'Maybe<NotificationRecipientSendFlag>', optional: true, description: 'Recipient send flag controlling who receives this notification and whether it should be archived to {@link NotificationWeek} after delivery.', enumRef: 'NotificationRecipientSendFlag' },
      { name: 'ts', longName: 'textSendState', tsType: 'NotificationSendState', optional: false, description: 'Text/SMS send state.', enumRef: 'NotificationSendState' },
      { name: 'es', longName: 'emailSendState', tsType: 'NotificationSendState', optional: false, description: 'Email send state.', enumRef: 'NotificationSendState' },
      { name: 'ps', longName: 'pushSendState', tsType: 'NotificationSendState', optional: false, description: 'Push notification send state.', enumRef: 'NotificationSendState' },
      { name: 'ns', longName: 'summarySendState', tsType: 'NotificationSendState', optional: false, description: 'In-app notification summary send state (delivery to {@link NotificationSummary}).', enumRef: 'NotificationSendState' },
      { name: 'n', longName: 'notificationItem', tsType: 'NotificationItem', optional: false, description: 'Embedded notification content (subject, message, template type, metadata).' },
      {
        name: 'r',
        longName: 'recipients',
        tsType: 'NotificationRecipientWithConfig[]',
        optional: false,
        description: 'Additional per-notification recipients with inline config overrides.',
        nestedFields: [
          { name: 'uid', longName: 'uid', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: "Firebase auth UID. When set, contact info is resolved from the user's profile and push notification tokens." },
          { name: 'n', longName: 'n', tsType: 'Maybe<string>', optional: true, description: "Display name override. Takes precedence over the user's profile name." },
          { name: 'e', longName: 'e', tsType: 'Maybe<EmailAddress>', optional: true, description: "Email address override. Takes precedence over the user's profile email." },
          { name: 't', longName: 't', tsType: 'Maybe<E164PhoneNumber>', optional: true, description: "Phone number override (E.164 format). Takes precedence over the user's profile phone." },
          { name: 's', longName: 's', tsType: 'Maybe<NotificationSummaryId>', optional: true, description: 'Notification summary ID for in-app delivery. Automatically cleared when `uid` is set.' },
          { name: 'sd', longName: 'sd', tsType: 'Maybe<boolean>', optional: true, description: "Master toggle. When set, acts as the default for all channels that aren't individually configured." },
          { name: 'se', longName: 'se', tsType: 'Maybe<boolean>', optional: true, description: 'Email channel enabled/disabled.' },
          { name: 'st', longName: 'st', tsType: 'Maybe<boolean>', optional: true, description: 'Text/SMS channel enabled/disabled.' },
          { name: 'sp', longName: 'sp', tsType: 'Maybe<boolean>', optional: true, description: 'Push notification channel enabled/disabled.' },
          { name: 'sn', longName: 'sn', tsType: 'Maybe<boolean>', optional: true, description: 'In-app notification summary channel enabled/disabled.' }
        ],
        nestedIsArray: true
      },
      { name: 'ois', longName: 'optInSendOnly', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Explicit opt-in send only. When true, only sends to users who have explicitly opted in for each channel.' },
      { name: 'ots', longName: 'optInTextSend', tsType: 'Maybe<SavedToFirestoreIfFalse>', optional: true, description: "Opt-in text/SMS override. When false, sends text/SMS to all users even if they haven't explicitly opted in (still respects explicit opt-outs)." },
      { name: 'sat', longName: 'sendAt', tsType: 'Date', optional: false, description: 'Scheduled send time. The notification is guaranteed to be sent only after this time.' },
      { name: 'a', longName: 'attempts', tsType: 'number', optional: false, description: 'Total error attempt count. Incremented only when sending encounters an error (not on success).' },
      { name: 'at', longName: 'taskAttempts', tsType: 'Maybe<number>', optional: true, description: 'Current task attempt count for the active checkpoint. Incremented on delay or failure responses.' },
      { name: 'd', longName: 'done', tsType: 'boolean', optional: false, description: 'Delivery complete flag. When true, content has been delivered and is ready to archive to {@link NotificationWeek}.' },
      { name: 'tsr', longName: 'textRecipients', tsType: 'E164PhoneNumber[]', optional: false, description: 'Phone numbers that have already received the text/SMS for this notification.' },
      { name: 'esr', longName: 'emailRecipients', tsType: 'EmailAddress[]', optional: false, description: 'Email addresses that have already received the email for this notification.' },
      { name: 'tpr', longName: 'taskCheckpoints', tsType: 'NotificationTaskCheckpointString[]', optional: false, description: 'Completed checkpoint strings for multi-step task notifications.' },
      { name: 'ut', longName: 'uniqueTask', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Unique task flag. Only used for task-type notifications.' }
    ],
    read: 'system',
    serviceFactory: { exportName: 'notificationFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notificationBox',
    modelName: 'NotificationBox',
    identityConst: 'notificationBoxIdentity',
    collectionPrefix: 'nb',
    description: 'Root notification container for a model. The document ID is the two-way flat key of the model it represents (see {@link notificationBoxIdForModel} in `notification.id.ts`).',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [
      { name: 'cat', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Creation date of this NotificationBox document.' },
      { name: 'm', longName: 'modelKey', tsType: 'FirestoreModelKey', optional: false, description: "Model key of the model this box is assigned to (e.g., `'project/abc123'`)." },
      { name: 'o', longName: 'ownerKey', tsType: 'FirestoreModelKey', optional: false, description: 'Owner model key. Set to a dummy value on creation and populated during server-side initialization.' },
      {
        name: 'r',
        longName: 'recipients',
        tsType: 'NotificationBoxRecipient[]',
        optional: false,
        description: 'Embedded recipient entries. Each entry represents a user who can receive notifications from this box.',
        nestedFields: [
          { name: 'i', longName: 'i', optional: false },
          { name: 'uid', longName: 'uid', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: "Firebase auth UID. When set, contact info is resolved from the user's profile and push notification tokens." },
          { name: 'n', longName: 'n', tsType: 'Maybe<string>', optional: true, description: "Display name override. Takes precedence over the user's profile name." },
          { name: 't', longName: 't', tsType: 'Maybe<E164PhoneNumber>', optional: true, description: "Phone number override (E.164 format). Takes precedence over the user's profile phone." },
          { name: 'e', longName: 'e', tsType: 'Maybe<EmailAddress>', optional: true, description: "Email address override. Takes precedence over the user's profile email." },
          { name: 's', longName: 's', tsType: 'Maybe<NotificationSummaryId>', optional: true, description: 'Notification summary ID for in-app delivery. Automatically cleared when `uid` is set.' },
          { name: 'f', longName: 'f', tsType: 'Maybe<NotificationBoxRecipientFlag>', optional: true, description: 'Opt-in/opt-out flag. Non-zero values prevent notification delivery to this recipient.' },
          { name: 'c', longName: 'c', tsType: 'NotificationBoxRecipientTemplateConfigRecord', optional: false, description: 'Per-template channel configuration. Keys are {@link NotificationTemplateType} values.' },
          { name: 'lk', longName: 'lk', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: "Locked flag. When true, the box cannot modify this recipient's config — only the user can update via their {@link NotificationUser}." },
          { name: 'x', longName: 'x', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: "Excluded flag. Set when the recipient is excluded via a {@link NotificationBoxSendExclusion} on their {@link NotificationUser}. Can only be cleared by removing the exclusion from the user's exclusion list." }
        ],
        nestedIsArray: true
      },
      { name: 'w', longName: 'latestWeek', tsType: 'YearWeekCode', optional: false, description: 'Year-week code of the latest {@link NotificationWeek} subcollection document.' },
      { name: 's', longName: 'needsSync', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: 'Whether this box needs server-side sync/initialization with its source model. Cleared when `fi` is set true (flagged invalid).' },
      { name: 'fi', longName: 'flaggedInvalid', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Flagged invalid — set when the box cannot be properly initialized (e.g., source model deleted).' }
    ],
    read: 'system',
    serviceFactory: { exportName: 'notificationBoxFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notificationLoggedEventDay',
    modelName: 'NotificationLoggedEventDay',
    identityConst: 'notificationLoggedEventDayIdentity',
    collectionPrefix: 'nbnle',
    parentIdentityConst: 'notificationBoxIdentity',
    description: "Day-keyed wrapper document for a single day's worth of archived logged-event notifications under a {@link NotificationBox}.",
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [{ name: 'd', longName: 'day', tsType: 'string', optional: false, description: 'ISO 8601 day string identifying this day. Matches the document ID.' }],
    read: 'system',
    serviceFactory: { exportName: 'notificationLoggedEventDayFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notificationSummary',
    modelName: 'NotificationSummary',
    identityConst: 'notificationSummaryIdentity',
    collectionPrefix: 'ns',
    description: 'Aggregated notification feed for a specific model. Holds embedded {@link NotificationItem} entries that summarize recent notifications, similar to an activity feed.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [
      { name: 'cat', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Creation date of this summary document.' },
      { name: 'm', longName: 'modelKey', tsType: 'FirestoreModelKey', optional: false, description: "Model key of the model this summary represents (e.g., `'project/abc123'`)." },
      { name: 'o', longName: 'ownerKey', tsType: 'FirestoreModelKey', optional: false, description: 'Owner model key. Set to a dummy value on creation and populated during server-side initialization.' },
      {
        name: 'n',
        longName: 'notifications',
        tsType: 'NotificationItem[]',
        optional: false,
        description: 'Embedded notification items, sorted ascending by date (newest at end).',
        nestedFields: [
          { name: 'id', longName: 'id', tsType: 'NotificationId', optional: false, description: 'Unique notification item identifier.' },
          { name: 'cat', longName: 'cat', tsType: 'Date', optional: false, description: 'Creation timestamp of this notification item.' },
          { name: 'cb', longName: 'cb', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: 'UID of the user who triggered this notification, if applicable.' },
          { name: 't', longName: 't', tsType: 'NotificationTemplateType | NotificationTaskType', optional: false, description: 'Template type (for standard notifications) or task type (for task notifications). Determines how the notification is rendered and which handler processes it.' },
          { name: 'm', longName: 'm', tsType: 'Maybe<FirestoreModelKey>', optional: true, description: 'Model key of the target object this notification relates to.' },
          { name: 's', longName: 's', tsType: 'Maybe<string>', optional: true, description: "Subject text override. Replaces the template's default subject when present." },
          { name: 'g', longName: 'g', tsType: 'Maybe<string>', optional: true, description: "Message text override. Replaces the template's default message when present." },
          { name: 'd', longName: 'd', tsType: 'Maybe<D>', optional: true, description: 'Arbitrary metadata payload. Stored directly in Firestore — keep values serializable and small.' },
          { name: 'v', longName: 'v', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Read/viewed flag. True if the recipient has seen this notification item.' }
        ],
        nestedIsArray: true
      },
      { name: 'lat', longName: 'lastNotificationAt', tsType: 'Maybe<Date>', optional: true, description: 'Timestamp of the most recently added notification item.' },
      { name: 'rat', longName: 'lastReadAt', tsType: 'Maybe<Date>', optional: true, description: 'Timestamp of when the user last read this summary. Items with dates after this are considered unread.' },
      { name: 's', longName: 'needsSync', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: 'Whether this summary needs server-side sync/initialization with its source model.' },
      { name: 'fi', longName: 'flaggedInvalid', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'True if this model has been flagged invalid.' }
    ],
    read: 'system',
    serviceFactory: { exportName: 'notificationSummaryFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notificationUser',
    modelName: 'NotificationUser',
    identityConst: 'notificationUserIdentity',
    collectionPrefix: 'nu',
    description: 'A global notification user profile that tracks notification preferences and box subscriptions.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [
      { name: 'uid', longName: 'uid', optional: false },
      { name: 'b', longName: 'boxes', tsType: 'NotificationBoxId[]', optional: false, description: 'Notification box IDs this user is subscribed to. Managed by the server — not directly editable by clients.' },
      { name: 'x', longName: 'boxExclusions', tsType: 'NotificationBoxSendExclusionList', optional: false, description: 'Box exclusion list. Entries cause the user to be excluded from receiving notifications from matching boxes.' },
      { name: 'dc', longName: 'defaultConfig', tsType: 'NotificationUserDefaultNotificationBoxRecipientConfig', optional: false, description: "Direct/default config. Used when a recipient is added ad-hoc (by uid) to a notification that isn't associated with any of their subscribed boxes." },
      { name: 'gc', longName: 'globalConfig', tsType: 'NotificationUserDefaultNotificationBoxRecipientConfig', optional: false, description: 'Global config override. Overrides all other configs (both per-box `bc` and direct/default `dc`) at send time.' },
      {
        name: 'bc',
        longName: 'boxConfigs',
        tsType: 'NotificationUserNotificationBoxRecipientConfig[]',
        optional: false,
        description: "Per-box recipient configurations. Each entry corresponds to one of the user's subscribed notification boxes.",
        nestedFields: [
          { name: 'nb', longName: 'nb', tsType: 'NotificationBoxId', optional: false, description: 'ID of the {@link NotificationBox} this config mirrors. The related model key can be inferred via {@link inferNotificationBoxRelatedModelKey}.' },
          { name: 'rm', longName: 'rm', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Self-removal flag. When set, the user has removed themselves from this box.' },
          { name: 'ns', longName: 'ns', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: 'Whether this config needs to be synced with the corresponding {@link NotificationBox} recipient entry.' },
          { name: 'lk', longName: 'lk', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: "Locked flag. Prevents the box from modifying this user's recipient config." },
          { name: 'bk', longName: 'bk', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Blocked flag. Prevents the box from re-adding this user as a recipient.' },
          { name: 'i', longName: 'i', optional: false },
          { name: 'x', longName: 'x', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: "Excluded flag. Set when the recipient is excluded via a {@link NotificationBoxSendExclusion} on their {@link NotificationUser}. Can only be cleared by removing the exclusion from the user's exclusion list." },
          { name: 'n', longName: 'n', tsType: 'Maybe<string>', optional: true, description: "Display name override. Takes precedence over the user's profile name." },
          { name: 't', longName: 't', tsType: 'Maybe<E164PhoneNumber>', optional: true, description: "Phone number override (E.164 format). Takes precedence over the user's profile phone." },
          { name: 'e', longName: 'e', tsType: 'Maybe<EmailAddress>', optional: true, description: "Email address override. Takes precedence over the user's profile email." },
          { name: 's', longName: 's', tsType: 'Maybe<NotificationSummaryId>', optional: true, description: 'Notification summary ID for in-app delivery. Automatically cleared when `uid` is set.' },
          { name: 'f', longName: 'f', tsType: 'Maybe<NotificationBoxRecipientFlag>', optional: true, description: 'Opt-in/opt-out flag. Non-zero values prevent notification delivery to this recipient.' },
          { name: 'c', longName: 'c', tsType: 'NotificationBoxRecipientTemplateConfigRecord', optional: false, description: 'Per-template channel configuration. Keys are {@link NotificationTemplateType} values.' }
        ],
        nestedIsArray: true
      },
      { name: 'ns', longName: 'needsConfigSync', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: 'Whether one or more configs need to be synced to their corresponding NotificationBox recipients.' }
    ],
    read: 'system',
    serviceFactory: { exportName: 'notificationUserFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'notificationWeek',
    modelName: 'NotificationWeek',
    identityConst: 'notificationWeekIdentity',
    collectionPrefix: 'nbnw',
    parentIdentityConst: 'notificationBoxIdentity',
    description: 'Weekly archive of delivered notification items within a {@link NotificationBox}.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
    fields: [
      { name: 'w', longName: 'yearWeek', tsType: 'YearWeekCode', optional: false, description: 'Year-week code identifying this week. Matches the document ID.' },
      {
        name: 'n',
        longName: 'notifications',
        tsType: 'NotificationItem[]',
        optional: false,
        description: 'Archived notification items delivered during this week.',
        nestedFields: [
          { name: 'id', longName: 'id', tsType: 'NotificationId', optional: false, description: 'Unique notification item identifier.' },
          { name: 'cat', longName: 'cat', tsType: 'Date', optional: false, description: 'Creation timestamp of this notification item.' },
          { name: 'cb', longName: 'cb', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: 'UID of the user who triggered this notification, if applicable.' },
          { name: 't', longName: 't', tsType: 'NotificationTemplateType | NotificationTaskType', optional: false, description: 'Template type (for standard notifications) or task type (for task notifications). Determines how the notification is rendered and which handler processes it.' },
          { name: 'm', longName: 'm', tsType: 'Maybe<FirestoreModelKey>', optional: true, description: 'Model key of the target object this notification relates to.' },
          { name: 's', longName: 's', tsType: 'Maybe<string>', optional: true, description: "Subject text override. Replaces the template's default subject when present." },
          { name: 'g', longName: 'g', tsType: 'Maybe<string>', optional: true, description: "Message text override. Replaces the template's default message when present." },
          { name: 'd', longName: 'd', tsType: 'Maybe<D>', optional: true, description: 'Arbitrary metadata payload. Stored directly in Firestore — keep values serializable and small.' },
          { name: 'v', longName: 'v', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'Read/viewed flag. True if the recipient has seen this notification item.' }
        ],
        nestedIsArray: true
      }
    ],
    read: 'system',
    serviceFactory: { exportName: 'notificationWeekFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'oidcEntry',
    modelName: 'OidcEntry',
    identityConst: 'oidcEntryIdentity',
    collectionPrefix: 'oidc_e',
    description: 'oidc-provider adapter entry stored in Firestore.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.ts',
    fields: [
      { name: 'type', longName: 'type', tsType: 'OidcEntryType', optional: false, description: "The oidc-provider model type (e.g., 'Session', 'AccessToken', 'Client')." },
      { name: 'payload', longName: 'payload', tsType: 'JsonSerializableObject', optional: false, description: 'Serialized JSON of the full oidc-provider AdapterPayload.' },
      { name: 'o', longName: 'ownerKey', tsType: 'Maybe<FirebaseAuthOwnershipKey>', optional: true, description: 'Ownership key for Firestore security rules.' },
      { name: 'uid', longName: 'uid', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: 'User identifier. Extracted from the payload for indexed queries.' },
      { name: 'grantId', longName: 'grantId', tsType: 'Maybe<string>', optional: true, description: 'Grant identifier for revocation support. Extracted from the payload for indexed queries.' },
      { name: 'clientId', longName: 'clientId', tsType: 'Maybe<string>', optional: true, description: 'OAuth client identifier. Extracted from the payload for indexed queries (e.g. listing or revoking every grant/token issued to a particular client).' },
      { name: 'userCode', longName: 'userCode', tsType: 'Maybe<string>', optional: true, description: 'User code for device flow. Extracted from the payload for indexed queries.' },
      { name: 'consumed', longName: 'consumedAt', tsType: 'Maybe<number>', optional: true, description: 'Epoch timestamp when this entry was consumed. Extracted from the payload for indexed queries.' },
      { name: 'createdAt', longName: 'createdAt', tsType: 'Maybe<Date>', optional: true, description: 'When this entry was created. Derived from `payload.iat` on grantable tokens (AccessToken, RefreshToken, AuthorizationCode, Grant, etc.) and from `payload.created_at` on Client entries.' },
      { name: 'expiresAt', longName: 'expiresAt', tsType: 'Maybe<Date>', optional: true, description: 'When this entry expires.' }
    ],
    read: 'permissions',
    serviceFactory: { exportName: 'oidcEntryFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'storageFile',
    modelName: 'StorageFile',
    identityConst: 'storageFileIdentity',
    collectionPrefix: 'sf',
    description: 'A StorageFile Firestore document that references a file in Google Cloud Storage.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.ts',
    fields: [
      { name: 'bucketId', longName: 'bucketId', optional: false },
      { name: 'pathString', longName: 'pathString', optional: false },
      { name: 'n', longName: 'displayName', tsType: 'Maybe<StorageFileDisplayName>', optional: true, description: 'Arbitrary display name for the file.' },
      { name: 'cat', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Created at date.' },
      { name: 'ct', longName: 'creationType', tsType: 'Maybe<StorageFileCreationType>', optional: true, description: 'Type of creation.', enumRef: 'StorageFileCreationType' },
      { name: 'fs', longName: 'fileState', tsType: 'StorageFileState', optional: false, description: 'State of the storage file.', enumRef: 'StorageFileState' },
      { name: 'ps', longName: 'processingState', tsType: 'StorageFileProcessingState', optional: false, description: 'Processing state of the storage file.', enumRef: 'StorageFileProcessingState' },
      { name: 'pn', longName: 'processingNotificationKey', tsType: 'Maybe<NotificationKey>', optional: true, description: 'The NotificationTask key for this storage file.' },
      { name: 'pat', longName: 'processingAt', tsType: 'Maybe<Date>', optional: true, description: 'The date that state was last updated to PROCESSING.' },
      { name: 'pcat', longName: 'processingCleanupAt', tsType: 'Maybe<Date>', optional: true, description: 'The date that the cleanup step of the processing task was run, and the notification ended.' },
      { name: 'u', longName: 'userId', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: 'User this file is associated with, if applicable.' },
      { name: 'uby', longName: 'uploadedBy', tsType: 'Maybe<FirebaseAuthUserId>', optional: true, description: 'User who uploaded this file, if applicable.' },
      { name: 'o', longName: 'ownerKey', tsType: 'Maybe<FirebaseAuthOwnershipKey>', optional: true, description: 'Ownership key, if applicable.' },
      { name: 'p', longName: 'purpose', tsType: 'Maybe<StorageFilePurpose>', optional: true, description: 'Purpose of the file, if applicable.' },
      { name: 'pg', longName: 'purposeSubgroup', tsType: 'Maybe<StorageFilePurposeSubgroup>', optional: true, description: 'Subgroup of the purpose of the file, if applicable.' },
      { name: 'd', longName: 'data', tsType: 'Maybe<M>', optional: true, description: 'Arbitrary metadata attached to the StorageFile.' },
      { name: 'sdat', longName: 'scheduledDeleteAt', tsType: 'Maybe<Date>', optional: true, description: 'Scheduled delete at date. The StorageFile cannot be deleted before this set time.' },
      { name: 'g', longName: 'groupIds', tsType: 'StorageFileGroupId[]', optional: false, description: 'StorageFileGroup id(s) that this StorageFile should be associated with.' },
      { name: 'gs', longName: 'groupsNeedSync', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: 'If true, this file should be re-synced with each StorageFileGroup that it references.' }
    ],
    read: 'permissions',
    serviceFactory: { exportName: 'storageFileFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'storageFileGroup',
    modelName: 'StorageFileGroup',
    identityConst: 'storageFileGroupIdentity',
    collectionPrefix: 'sfg',
    description: 'A group of {@link StorageFile}s aggregated around a related model or common identifier.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.ts',
    fields: [
      {
        name: 'f',
        longName: 'files',
        tsType: 'StorageFileGroupEmbeddedFile[]',
        optional: false,
        description: 'List of embedded files in this group currently.',
        nestedFields: [
          { name: 's', longName: 'storageFileId', tsType: 'StorageFileId', optional: false, description: 'StorageFile id.' },
          { name: 'n', longName: 'displayName', tsType: 'Maybe<StorageFileDisplayName>', optional: true, description: 'Overrides the display name for this file within the group when generating a composite file (zip, etc.).' },
          { name: 'sat', longName: 'addedAt', tsType: 'Date', optional: false, description: 'The time number it was added to the group.' },
          { name: 'zat', longName: 'zippedAt', tsType: 'Maybe<Date>', optional: true, description: "The first time the StorageFile's file was added to the zip, if applicable." }
        ],
        nestedIsArray: true
      },
      { name: 'cat', longName: 'createdAt', tsType: 'Date', optional: false, description: 'Created at date.' },
      { name: 'o', longName: 'ownerKey', tsType: 'Maybe<FirebaseAuthOwnershipKey>', optional: true, description: 'Ownership key, if applicable.' },
      { name: 'z', longName: 'shouldZip', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'True if a zip file should be generated for this group.' },
      { name: 'zsf', longName: 'zipStorageFileId', tsType: 'Maybe<StorageFileId>', optional: true, description: 'StorageFile that contains the zip file for this group.' },
      { name: 'zat', longName: 'zippedAt', tsType: 'Maybe<Date>', optional: true, description: 'The last date the zip file was regenerated for this group.' },
      { name: 's', longName: 'needsSync', tsType: 'Maybe<NeedsSyncBoolean>', optional: true, description: "True if this model needs to be sync'd/initialized with the original model." },
      { name: 'fi', longName: 'flaggedInvalid', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'True if this model has been flagged invalid.' },
      { name: 're', longName: 'shouldRegenerate', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'True if this StorageFileGroup should flag regeneration of output StorageFiles/content.' },
      { name: 'c', longName: 'shouldCleanup', tsType: 'Maybe<SavedToFirestoreIfTrue>', optional: true, description: 'True if this StorageFileGroup should clean up file references.' }
    ],
    read: 'admin-only',
    serviceFactory: { exportName: 'storageFileGroupFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  },
  {
    modelType: 'systemState',
    modelName: 'SystemState',
    identityConst: 'systemStateIdentity',
    collectionPrefix: 'sys',
    description: 'A singleton Firestore document storing the current state of a system subcomponent.',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'packages/firebase/src/lib/model/system/system.ts',
    fields: [{ name: 'data', longName: 'data', tsType: 'T', optional: false, description: 'Arbitrary persisted data for this system state singleton.' }],
    read: 'system',
    serviceFactory: { exportName: 'systemStateFirebaseModelServiceFactory', sourceFile: 'components/demo-firebase/src/lib/model/service.ts' }
  }
];

export const DEMO_CLI_ENUM_MANIFEST: CliEnumManifest = {
  NotificationRecipientSendFlag: {
    name: 'NotificationRecipientSendFlag',
    values: [
      { name: 'NORMAL', value: 0, description: 'Will send to all recipients.' },
      { name: 'SKIP_NOTIFICATION_BOX_RECIPIENTS', value: 1, description: 'Will not send to any of the configured notification box recipients. Will only to the globally configured message recpients or the notification specified recipients.' },
      { name: 'SKIP_GLOBAL_RECIPIENTS', value: 2, description: 'Will not send to any of the globally configured message recpients. Will only send to the notification specified recipients or the notification box recipients.' },
      { name: 'ONLY_EXPLICIT_RECIPIENTS', value: 3, description: 'Will only sent to recipients that are configured in this notification. Will not send to globally configured message recipients or notification box recipients.' },
      { name: 'ONLY_GLOBAL_RECIPIENTS', value: 4, description: 'Will only sent to globally configured message recipients.' }
    ],
    description: 'Notification recipient send flags.'
  },
  NotificationSendState: {
    name: 'NotificationSendState',
    values: [
      { name: 'NONE', value: -1, description: 'Notification will not be sent.' },
      { name: 'QUEUED', value: 0, description: 'Notification is queued up.' },
      { name: 'SENT', value: 1, description: 'Notification has been sent/complete. Will still show as sent even if there were no messages/recipients to send for this medium.' },
      { name: 'SENT_PARTIAL', value: 2, description: 'Some of the notifications have been sent, but some failed.' },
      { name: 'SKIPPED', value: 3, description: "Notification has been skipped due to the box's settings." },
      { name: 'NO_TRY', value: 4, description: 'Notification is flagged as being skipped and should not be reattempetd' },
      { name: 'SEND_ERROR', value: 5, description: 'Notification encountered an error while sending and could not be sent.' },
      { name: 'BUILD_ERROR', value: 6, description: 'Notification encountered an error while building and could not be sent.' },
      { name: 'CONFIG_ERROR', value: 7, description: 'Notification encountered an error due to the system not being configured properly.' }
    ],
    description: 'Lifecycle state of a notification delivery channel (text, email, push, or summary).'
  },
  NotificationSendType: {
    name: 'NotificationSendType',
    values: [
      { name: 'SEND_IF_BOX_EXISTS', value: 0, description: 'Sends only if the NotificationBox exists.' },
      { name: 'INIT_BOX_AND_SEND', value: 1, description: "Creates a NotificationBox if it doesn't exist, and then sends the Notification." },
      { name: 'SEND_WITHOUT_CREATING_BOX', value: 2, description: 'Sends the notification even if the NotificationBox does not exist.' },
      { name: 'TASK_NOTIFICATION', value: 3, description: 'A task notification.' },
      { name: 'LOGGED_EVENT', value: 4, description: 'A write-only logged event notification.' }
    ],
    description: 'Controls how a {@link Notification} interacts with its parent {@link NotificationBox} during delivery.'
  },
  StorageFileCreationType: {
    name: 'StorageFileCreationType',
    values: [
      { name: 'NONE', value: 0, description: 'No info about how this file was created.' },
      { name: 'DIRECTLY_CREATED', value: 1, description: 'The StorageFile was directly created.' },
      { name: 'INIT_FROM_UPLOAD', value: 2, description: 'The StorageFile was initialized from an uploaded file.' },
      { name: 'FOR_STORAGE_FILE_GROUP', value: 3, description: 'This StorageFile was created by/for a StorageFileGroup.' }
    ],
    description: 'How a StorageFile was created, which affects document ID generation and initialization behavior.'
  },
  StorageFileProcessingState: {
    name: 'StorageFileProcessingState',
    values: [
      { name: 'INIT_OR_NONE', value: 0, description: 'The StorageFile has no processing state or is just being initialized.' },
      { name: 'QUEUED_FOR_PROCESSING', value: 1, description: 'The StorageFile is flagged for processing, which will create a NotificationTask for it.' },
      { name: 'PROCESSING', value: 2, description: 'The StorageFile has an associated NotificationTask for it.' },
      { name: 'FAILED', value: 3, description: 'The StorageFile has encountered an error during processing.' },
      { name: 'SUCCESS', value: 4, description: 'The StorageFile has been processed or required no processing and is done.' },
      { name: 'ARCHIVED', value: 5, description: 'The StorageFile has been archived.' },
      { name: 'DO_NOT_PROCESS', value: 6, description: "The StorageFile shouldn't be processed." }
    ],
    description: 'Processing lifecycle state for a StorageFile.'
  },
  StorageFileState: {
    name: 'StorageFileState',
    values: [
      { name: 'INIT', value: 0, description: 'The StorageFile has no state, or is just being initialized.' },
      { name: 'INVALID', value: 1, description: 'The StorageFile failed to initialize properly and is considered invalid.' },
      { name: 'OK', value: 2, description: 'The StorageFile has been initialized and is ok.' },
      { name: 'QUEUED_FOR_DELETE', value: 3, description: 'A previously OK file that is now queued for deletion.' }
    ],
    description: 'Lifecycle state of a StorageFile document.'
  }
};
