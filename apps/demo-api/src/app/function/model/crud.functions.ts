import { systemStateExampleRead } from './../system/systemstate.read';
import { guestbookCreate } from '../guestbook/guestbook.create';
import { profileUpdate, profileUpdateCreateTestCalendarEvent, profileUpdateCreateTestNotification, profileUpdateResetPassword, profileUpdateUsername, profileUpdateOnboard } from '../profile/profile.update';
import { guestbookEntryInsert, guestbookEntryLike } from '../guestbook/guestbookentry.update';
import { guestbookEntryDelete } from '../guestbook/guestbookentry.delete';
import { onCallCreateModel, onCallDeleteModel, onCallUpdateModel, onCallQueryModel, onCallSpecifierHandler, onCallReadModel, onCallInvokeModel, onCallModel, type OnCallModelMap } from '@dereekb/firebase-server';
import { type DemoOnCallCreateModelMap, type DemoOnCallDeleteModelMap, type DemoOnCallReadModelMap, type DemoOnCallUpdateModelMap, type DemoOnCallQueryModelMap, type DemoOnCallInvokeModelMap, onCallWithDemoNestContext } from '../function.context';
import { notificationUserUpdate, notificationUserResync, notificationUserHealthCheck } from '../notification/notificationuser.update';
import { notificationBoxUpdate, notificationBoxRecipient } from '../notification/notificationbox.update';
import { notificationSummaryUpdate } from '../notification/notificationsummary.update';
import { guestbookSubscribeToNotifications, guestbookPublish } from '../guestbook/guestbook.update';
import { profileCreate } from '../profile/profile.create';
import { profileDelete } from '../profile/profile.delete';
import { notificationCreate } from '../notification/notification.create';
import { notificationSend } from '../notification/notification.update';
import { storageFileUpdate, storageFileProcess, storageFileSyncWithGroups } from '../storagefile/storagefile.update';
import { storageFileCreate, storageFileCreateSignedUploadUrl, storageFileFromUpload, storageFileAllFromUpload } from '../storagefile/storagefile.create';
import { storageFileDelete } from '../storagefile/storagefile.delete';
import { formSpaceCreate } from '../formspace/formspace.create';
import { formSpaceUpdate, formSpaceSubmit, formSpaceReopen, formSpaceLock, formSpaceRemoveFile } from '../formspace/formspace.update';
import { formSpaceDelete } from '../formspace/formspace.delete';
import { storageFileDownload, storageFileDownloadMultiple, storageFileReadMetadata, storageFileReadMetadataMultiple } from '../storagefile/storagefile.read';
import { storageFileGroupRegenerateContent, storageFileGroupUpdate } from '../storagefile/storagefilegroup.update';
import { guestbookEntryAllPublishedEntries, guestbookEntryEntryDetails } from '../guestbook/guestbookentry.invoke';
import { profileDownloadArchive } from '../profile/profile.read';
import { oidcEntryCreateClient } from '../oidc/oidcclient.create';
import { oidcEntryUpdateClient, oidcEntryRotateClientSecret } from '../oidc/oidcclient.update';
import { oidcEntryDeleteClient } from '../oidc/oidcclient.delete';
import { oidcEntryDeleteToken } from '../oidc/oidcentry.delete';
import { userExternalConnectionUpdateDisconnect } from '../userexternalconnection/userexternalconnection.update';
import { userExternalConnectionReadAuthorizeState } from '../userexternalconnection/userexternalconnection.read';
import { userExternalConnectionCreate } from '../userexternalconnection/userexternalconnection.create';
import { openRouterPromptUpdate } from '../openrouter/openrouterprompt.update';
import { openRouterPromptQuery } from '../openrouter/openrouterprompt.query';
import { openRouterPromptVersionCreate } from '../openrouter/openrouterpromptversion.create';
import { openRouterPromptVersionUpdate } from '../openrouter/openrouterpromptversion.update';
import { guestbookQuery } from '../guestbook/guestbook.query';
import { guestbookEntryQuery, guestbookEntryEntriesQuery } from '../guestbook/guestbookentry.query';
import { calendarUpdateRotateIcs } from '../calendar/calendar.update';

// MARK: Create
export const DEMO_CREATE_MODEL_MAP: DemoOnCallCreateModelMap = {
  guestbook: guestbookCreate,
  //
  // Without Auth Examples
  // These are just to show how to create functions that do not assert auth.
  profile: profileCreate,
  notification: onCallSpecifierHandler({
    _: notificationCreate
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileCreate,
    fromUpload: storageFileFromUpload,
    allFromUpload: storageFileAllFromUpload,
    signedUploadUrl: storageFileCreateSignedUploadUrl
  }),
  formSpace: onCallSpecifierHandler({
    _: formSpaceCreate
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryCreateClient
  }),
  userExternalConnection: userExternalConnectionCreate,
  // Publishing a prompt version is a create on the version model: it writes a new document,
  // and there is no Angular screen for prompt authoring, so callModel and its MCP are the only way in.
  openRouterPromptVersion: openRouterPromptVersionCreate
};

// MARK: Read
export const DEMO_READ_MODEL_MAP: DemoOnCallReadModelMap = {
  systemState: onCallSpecifierHandler({
    exampleread: systemStateExampleRead
  }),
  storageFile: onCallSpecifierHandler({
    download: storageFileDownload,
    downloadMultiple: storageFileDownloadMultiple,
    metadata: storageFileReadMetadata,
    metadataMultiple: storageFileReadMetadataMultiple
  }),
  profile: onCallSpecifierHandler({
    downloadArchive: profileDownloadArchive
  }),
  userExternalConnection: onCallSpecifierHandler({
    authorizeState: userExternalConnectionReadAuthorizeState
  })
};

// MARK: Update
export const DEMO_UPDATE_MODEL_MAP: DemoOnCallUpdateModelMap = {
  guestbook: onCallSpecifierHandler({
    subscribeToNotifications: guestbookSubscribeToNotifications,
    publish: guestbookPublish
  }),
  guestbookEntry: onCallSpecifierHandler({
    insert: guestbookEntryInsert,
    like: guestbookEntryLike
  }),
  profile: onCallSpecifierHandler({
    _: profileUpdate,
    username: profileUpdateUsername,
    onboard: profileUpdateOnboard,
    createTestNotification: profileUpdateCreateTestNotification,
    createTestCalendarEvent: profileUpdateCreateTestCalendarEvent,
    resetPassword: profileUpdateResetPassword
  }),
  calendar: onCallSpecifierHandler({
    rotateIcs: calendarUpdateRotateIcs
  }),
  notificationUser: onCallSpecifierHandler({
    _: notificationUserUpdate,
    resync: notificationUserResync
  }),
  notificationBox: onCallSpecifierHandler({
    _: notificationBoxUpdate,
    recipient: notificationBoxRecipient
  }),
  notificationSummary: onCallSpecifierHandler({
    _: notificationSummaryUpdate
  }),
  notification: onCallSpecifierHandler({
    send: notificationSend
  }),
  storageFile: onCallSpecifierHandler({
    _: storageFileUpdate,
    process: storageFileProcess,
    syncWithGroups: storageFileSyncWithGroups
  }),
  storageFileGroup: onCallSpecifierHandler({
    _: storageFileGroupUpdate,
    regenerateContent: storageFileGroupRegenerateContent
  }),
  formSpace: onCallSpecifierHandler({
    _: formSpaceUpdate,
    submit: formSpaceSubmit,
    reopen: formSpaceReopen,
    lock: formSpaceLock,
    removeFile: formSpaceRemoveFile
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryUpdateClient,
    rotateClientSecret: oidcEntryRotateClientSecret
  }),
  userExternalConnection: onCallSpecifierHandler({
    disconnect: userExternalConnectionUpdateDisconnect
  }),
  openRouterPrompt: openRouterPromptUpdate,
  // Edits the head version in place. The action refuses a version that a newer one has locked.
  openRouterPromptVersion: openRouterPromptVersionUpdate
};

// MARK: Delete
export const DEMO_DELETE_MODEL_MAP: DemoOnCallDeleteModelMap = {
  guestbookEntry: guestbookEntryDelete,
  profile: profileDelete,
  storageFile: onCallSpecifierHandler({
    _: storageFileDelete
  }),
  formSpace: onCallSpecifierHandler({
    _: formSpaceDelete
  }),
  oidcEntry: onCallSpecifierHandler({
    client: oidcEntryDeleteClient,
    token: oidcEntryDeleteToken
  })
};

// MARK: Query
export const DEMO_QUERY_MODEL_MAP: DemoOnCallQueryModelMap = {
  guestbook: guestbookQuery,
  guestbookEntry: onCallSpecifierHandler({
    _: guestbookEntryQuery,
    entries: guestbookEntryEntriesQuery
  }),
  // A prompt is written over the model API and read back off it too: there is no Angular screen for
  // prompt authoring, so the query is what makes the collection enumerable over callModel and its MCP.
  openRouterPrompt: openRouterPromptQuery
};

// MARK: Invoke
export const DEMO_INVOKE_MODEL_MAP: DemoOnCallInvokeModelMap = {
  guestbookEntry: onCallSpecifierHandler({
    allPublishedEntries: guestbookEntryAllPublishedEntries,
    entryDetails: guestbookEntryEntryDetails
  }),
  notificationUser: onCallSpecifierHandler({
    healthCheck: notificationUserHealthCheck
  })
};

// MARK: Call
export const DEMO_CALL_MODEL_MAP: OnCallModelMap = {
  create: onCallCreateModel(DEMO_CREATE_MODEL_MAP),
  read: onCallReadModel(DEMO_READ_MODEL_MAP),
  update: onCallUpdateModel(DEMO_UPDATE_MODEL_MAP),
  delete: onCallDeleteModel(DEMO_DELETE_MODEL_MAP),
  query: onCallQueryModel(DEMO_QUERY_MODEL_MAP),
  invoke: onCallInvokeModel(DEMO_INVOKE_MODEL_MAP)
};

/**
 * The raw onCallModel dispatch function with _apiDetails attached.
 *
 * Used by the Model API and MCP controllers to dispatch requests
 * and introspect the handler metadata tree.
 *
 * OIDC scope enforcement for callModel is applied at the model-api layer
 * (`ModelApiDispatchConfig` in `server/model/model.module.ts`), which gates every
 * OIDC-bearer call path (dispatch, `/get` direct reads, and MCP) before invoking
 * this function — so no per-function scope pre-assert is wired here.
 */
export const demoCallModelFn = onCallModel(DEMO_CALL_MODEL_MAP);

export const demoCallModel = onCallWithDemoNestContext(demoCallModelFn);
