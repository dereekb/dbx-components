import { type RunNotificationTaskBotEntryParams, type RunNotificationTaskBotEntryResult, runNotificationTaskBotEntryParamsType, type UpdateNotificationTaskBotEntryParams, type UpdateNotificationTaskBotEntryResult, updateNotificationTaskBotEntryParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

export const notificationTaskBotUpdateEntry: DemoUpdateModelFunction<UpdateNotificationTaskBotEntryParams, UpdateNotificationTaskBotEntryResult> = withApiDetails({
  inputType: updateNotificationTaskBotEntryParamsType,
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
