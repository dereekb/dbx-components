import {
  type NotificationTaskBotOptOutsResult,
  type ReadNotificationTaskBotOptOutsParams,
  readNotificationTaskBotOptOutsParamsType,
  type RunNotificationTaskBotEntryParams,
  type RunNotificationTaskBotEntryResult,
  runNotificationTaskBotEntryParamsType,
  type UpdateNotificationTaskBotEntryParams,
  type UpdateNotificationTaskBotEntryResult,
  updateNotificationTaskBotEntryParamsType,
  type UpdateNotificationTaskBotOptOutParams,
  updateNotificationTaskBotOptOutParamsType
} from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { type DemoReadModelFunction, type DemoUpdateModelFunction } from '../function.context';

export const notificationTaskBotUpdateEntry: DemoUpdateModelFunction<UpdateNotificationTaskBotEntryParams, UpdateNotificationTaskBotEntryResult> = withApiDetails({
  inputType: updateNotificationTaskBotEntryParamsType,
  mcp: {
    visibility: { requiredRoles: [AUTH_ADMIN_ROLE] }
  },
  fn: async (request) => {
    const { nest, data } = request;

    const updateNotificationTaskBotEntry = await nest.notificationActions.updateNotificationTaskBotEntry(data);
    const notificationTaskBotDocument = await nest.useModel('notificationTaskBot', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    return updateNotificationTaskBotEntry(notificationTaskBotDocument);
  }
});

export const notificationTaskBotUpdateRun: DemoUpdateModelFunction<RunNotificationTaskBotEntryParams, RunNotificationTaskBotEntryResult> = withApiDetails({
  inputType: runNotificationTaskBotEntryParamsType,
  mcp: {
    // Open-world: runs the ping script now by default.
    openWorld: true,
    visibility: { requiredRoles: [AUTH_ADMIN_ROLE] }
  },
  fn: async (request) => {
    const { nest, data } = request;

    const runNotificationTaskBotEntry = await nest.notificationActions.runNotificationTaskBotEntry(data);
    const notificationTaskBotDocument = await nest.useModel('notificationTaskBot', {
      request,
      key: data.key,
      roles: 'run',
      use: (x) => x.document
    });

    return runNotificationTaskBotEntry(notificationTaskBotDocument);
  }
});

export const notificationTaskBotReadOptOuts: DemoReadModelFunction<ReadNotificationTaskBotOptOutsParams, NotificationTaskBotOptOutsResult> = withApiDetails({
  inputType: readNotificationTaskBotOptOutsParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const readNotificationTaskBotOptOuts = await nest.notificationActions.readNotificationTaskBotOptOuts(data);

    // the action takes the roles reader itself, so it reads the already-loaded bot instead of reading it again
    return nest.useModel('notificationTaskBot', {
      request,
      key: data.key,
      roles: 'optOut',
      use: (x) => readNotificationTaskBotOptOuts(x)
    });
  }
});

export const notificationTaskBotUpdateOptOut: DemoUpdateModelFunction<UpdateNotificationTaskBotOptOutParams, NotificationTaskBotOptOutsResult> = withApiDetails({
  inputType: updateNotificationTaskBotOptOutParamsType,
  mcp: {
    // Additive: the owner's reversible preference.
    destructive: false
  },
  fn: async (request) => {
    const { nest, data } = request;

    const updateNotificationTaskBotOptOut = await nest.notificationActions.updateNotificationTaskBotOptOut(data);

    // the action takes the roles reader rather than the document, so it can require an explicit owner grant of `optOut`
    return nest.useModel('notificationTaskBot', {
      request,
      key: data.key,
      roles: 'optOut',
      use: (x) => updateNotificationTaskBotOptOut(x)
    });
  }
});
