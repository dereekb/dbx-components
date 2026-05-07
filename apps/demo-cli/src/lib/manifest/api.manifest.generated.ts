/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run `pnpm nx run demo-cli:generate-api-manifest` to refresh.

import {
  createOidcClientParamsType,
  createStorageFileParamsType,
  deleteOidcClientParamsType,
  deleteStorageFileParamsType,
  downloadMultipleStorageFilesParamsType,
  downloadStorageFileParamsType,
  initializeAllStorageFilesFromUploadsParamsType,
  initializeStorageFileFromUploadParamsType,
  processStorageFileParamsType,
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
import { createGuestbookParamsType, downloadProfileArchiveParamsType, exampleReadParamsType, finishOnboardingProfileParamsType, guestbookEntryParamsType, insertGuestbookEntryParamsType, likeGuestbookEntryParamsType, profileCreateTestNotificationParamsType, resetProfilePasswordParamsType, setProfileUsernameParamsType, subscribeToGuestbookNotificationsParamsType, updateProfileParamsType } from 'demo-firebase';
import { type CliApiManifest } from '@dereekb/dbx-cli';

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
      { name: 'published', typeText: 'Maybe<boolean>' }
    ]
  },
  { model: 'guestbook', verb: 'update', specifier: 'subscribeToNotifications', paramsTypeName: 'SubscribeToGuestbookNotificationsParams', paramsValidator: subscribeToGuestbookNotificationsParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbookEntry', verb: 'delete', paramsTypeName: 'GuestbookEntryParams', paramsValidator: guestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts', paramsFields: [{ name: 'guestbook', typeText: 'string' }] },
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
      { name: 'client_secret', typeText: 'string', description: 'The generated client secret in plaintext. Only returned for auth methods that require a secret\n(e.g., `client_secret_basic`, `client_secret_post`). Undefined for `private_key_jwt`.' }
    ]
  },
  { model: 'oidcEntry', verb: 'delete', specifier: 'client', paramsTypeName: 'DeleteOidcClientParams', paramsValidator: deleteOidcClientParamsType, groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts', paramsTypeDescription: 'Parameters for revoking/deleting an OAuth client.' },
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
    description: 'Initiates or completes a password reset for the current user.\n\nSet `requestReset: true` to start a new reset (generates a temporary\ncode and sends an email). Provide `resetPassword` + `newPassword` to\ncomplete the reset by verifying the code and setting the new password.',
    paramsTypeDescription: "Params for initiating or completing a password reset for the current user's profile.\n\nSet `requestReset: true` to initiate a new password reset (generates a temporary code and sends an email).\nProvide `resetPassword` and `newPassword` to complete the reset by verifying the code and setting the new password.",
    paramsFields: [
      { name: 'requestReset', typeText: 'Maybe<boolean>', description: 'When true, initiates a new password reset and sends the reset email.' },
      { name: 'resetPassword', typeText: 'Maybe<string>', description: 'The temporary reset code received via email. Required to complete the reset.' },
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
