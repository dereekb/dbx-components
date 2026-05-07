/* eslint-disable */
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
  { model: 'guestbook', verb: 'create', paramsTypeName: 'CreateGuestbookParams', paramsValidator: createGuestbookParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbook', verb: 'update', specifier: 'subscribeToNotifications', paramsTypeName: 'SubscribeToGuestbookNotificationsParams', paramsValidator: subscribeToGuestbookNotificationsParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbookEntry', verb: 'delete', paramsTypeName: 'GuestbookEntryParams', paramsValidator: guestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbookEntry', verb: 'update', specifier: 'insert', paramsTypeName: 'InsertGuestbookEntryParams', paramsValidator: insertGuestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'guestbookEntry', verb: 'update', specifier: 'like', paramsTypeName: 'LikeGuestbookEntryParams', paramsValidator: likeGuestbookEntryParamsType, groupName: 'Guestbook', sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.api.ts' },
  { model: 'notification', verb: 'update', specifier: 'send', paramsTypeName: 'SendNotificationParams', paramsValidator: sendNotificationParamsType, resultTypeName: 'SendNotificationResult', groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'notificationBox', verb: 'update', specifier: '_', paramsTypeName: 'UpdateNotificationBoxParams', paramsValidator: updateNotificationBoxParamsType, groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'notificationBox', verb: 'update', specifier: 'recipient', paramsTypeName: 'UpdateNotificationBoxRecipientParams', paramsValidator: updateNotificationBoxRecipientParamsType, groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'notificationSummary', verb: 'update', specifier: '_', paramsTypeName: 'UpdateNotificationSummaryParams', paramsValidator: updateNotificationSummaryParamsType, groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'notificationUser', verb: 'update', specifier: '_', paramsTypeName: 'UpdateNotificationUserParams', paramsValidator: updateNotificationUserParamsType, groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'notificationUser', verb: 'update', specifier: 'resync', paramsTypeName: 'ResyncNotificationUserParams', paramsValidator: resyncNotificationUserParamsType, resultTypeName: 'ResyncNotificationUserResult', groupName: 'NotificationBox', sourceFile: 'packages/firebase/src/lib/model/notification/notification.api.ts' },
  { model: 'oidcEntry', verb: 'create', specifier: 'client', paramsTypeName: 'CreateOidcClientParams', paramsValidator: createOidcClientParamsType, resultTypeName: 'CreateOidcClientResult', groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts' },
  { model: 'oidcEntry', verb: 'delete', specifier: 'client', paramsTypeName: 'DeleteOidcClientParams', paramsValidator: deleteOidcClientParamsType, groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts' },
  { model: 'oidcEntry', verb: 'update', specifier: 'client', paramsTypeName: 'UpdateOidcClientParams', paramsValidator: updateOidcClientParamsType, groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts' },
  { model: 'oidcEntry', verb: 'update', specifier: 'rotateClientSecret', paramsTypeName: 'RotateOidcClientSecretParams', paramsValidator: rotateOidcClientSecretParamsType, resultTypeName: 'RotateOidcClientSecretResult', groupName: 'Oidc', sourceFile: 'packages/firebase/src/lib/model/oidcmodel/oidcmodel.api.ts' },
  { model: 'profile', verb: 'delete', paramsTypeName: 'UpdateProfileParams', paramsValidator: updateProfileParamsType, groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'read', specifier: 'downloadArchive', paramsTypeName: 'DownloadProfileArchiveParams', paramsValidator: downloadProfileArchiveParamsType, resultTypeName: 'DownloadProfileArchiveResult', groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'update', specifier: '_', paramsTypeName: 'UpdateProfileParams', paramsValidator: updateProfileParamsType, groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'update', specifier: 'createTestNotification', paramsTypeName: 'ProfileCreateTestNotificationParams', paramsValidator: profileCreateTestNotificationParamsType, groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'update', specifier: 'onboard', paramsTypeName: 'FinishOnboardingProfileParams', paramsValidator: finishOnboardingProfileParamsType, resultTypeName: 'boolean', groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'update', specifier: 'resetPassword', paramsTypeName: 'ResetProfilePasswordParams', paramsValidator: resetProfilePasswordParamsType, groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'profile', verb: 'update', specifier: 'username', paramsTypeName: 'SetProfileUsernameParams', paramsValidator: setProfileUsernameParamsType, groupName: 'Profile', sourceFile: 'components/demo-firebase/src/lib/model/profile/profile.api.ts' },
  { model: 'storageFile', verb: 'create', specifier: '_', paramsTypeName: 'CreateStorageFileParams', paramsValidator: createStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'create', specifier: 'allFromUpload', paramsTypeName: 'InitializeAllStorageFilesFromUploadsParams', paramsValidator: initializeAllStorageFilesFromUploadsParamsType, resultTypeName: 'InitializeAllStorageFilesFromUploadsResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'create', specifier: 'fromUpload', paramsTypeName: 'InitializeStorageFileFromUploadParams', paramsValidator: initializeStorageFileFromUploadParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'delete', specifier: '_', paramsTypeName: 'DeleteStorageFileParams', paramsValidator: deleteStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'read', specifier: 'download', paramsTypeName: 'DownloadStorageFileParams', paramsValidator: downloadStorageFileParamsType, resultTypeName: 'DownloadStorageFileResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'read', specifier: 'downloadMultiple', paramsTypeName: 'DownloadMultipleStorageFilesParams', paramsValidator: downloadMultipleStorageFilesParamsType, resultTypeName: 'DownloadMultipleStorageFilesResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'update', specifier: '_', paramsTypeName: 'UpdateStorageFileParams', paramsValidator: updateStorageFileParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'update', specifier: 'process', paramsTypeName: 'ProcessStorageFileParams', paramsValidator: processStorageFileParamsType, resultTypeName: 'ProcessStorageFileResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFile', verb: 'update', specifier: 'syncWithGroups', paramsTypeName: 'SyncStorageFileWithGroupsParams', paramsValidator: syncStorageFileWithGroupsParamsType, resultTypeName: 'SyncStorageFileWithGroupsResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFileGroup', verb: 'update', specifier: '_', paramsTypeName: 'UpdateStorageFileGroupParams', paramsValidator: updateStorageFileGroupParamsType, groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'storageFileGroup', verb: 'update', specifier: 'regenerateContent', paramsTypeName: 'RegenerateStorageFileGroupContentParams', paramsValidator: regenerateStorageFileGroupContentParamsType, resultTypeName: 'RegenerateStorageFileGroupContentResult', groupName: 'StorageFile', sourceFile: 'packages/firebase/src/lib/model/storagefile/storagefile.api.ts' },
  { model: 'systemState', verb: 'read', specifier: 'exampleread', paramsTypeName: 'ExampleReadParams', paramsValidator: exampleReadParamsType, resultTypeName: 'ExampleReadResponse', groupName: 'SystemState', sourceFile: 'components/demo-firebase/src/lib/model/system/system.api.ts' }
];
