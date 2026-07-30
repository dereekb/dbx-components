import { type NotificationUserHealthCheckParams, type NotificationUserHealthCheckResult, type ResyncNotificationUserParams, type ResyncNotificationUserResult, type UpdateNotificationUserParams, notificationUserHealthCheckParamsType, updateNotificationUserParamsType, resyncNotificationUserParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { type DemoInvokeModelFunction, type DemoUpdateModelFunction } from '../function.context';

export const notificationUserUpdate: DemoUpdateModelFunction<UpdateNotificationUserParams> = withApiDetails({
  inputType: updateNotificationUserParamsType,
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

    const updateNotificationUser = await nest.notificationActions.updateNotificationUser(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateNotificationUser(notificationUserDocument);
  }
});

export const notificationUserResync: DemoUpdateModelFunction<ResyncNotificationUserParams, ResyncNotificationUserResult> = withApiDetails({
  inputType: resyncNotificationUserParamsType,
  mcp: {
    visibility: { requiredRoles: [AUTH_ADMIN_ROLE] }
  },
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

    const resyncNotificationUser = await nest.notificationActions.resyncNotificationUser(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'sync',
      use: (x) => x.document
    });

    return resyncNotificationUser(notificationUserDocument);
  }
});

/**
 * Runs a notification delivery health check for a user, diagnosing why they are or are not receiving
 * notifications on each delivery method.
 *
 * Requires only `read` on the NotificationUser, so a user can diagnose their own delivery without
 * being able to change anything. Dispatching a test message is opt-in via `sendProbe`.
 */
export const notificationUserHealthCheck: DemoInvokeModelFunction<NotificationUserHealthCheckParams, NotificationUserHealthCheckResult> = withApiDetails({
  inputType: notificationUserHealthCheckParamsType,
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

    const notificationUserHealthCheck = await nest.notificationActions.notificationUserHealthCheck(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'read',
      use: (x) => x.document
    });

    return notificationUserHealthCheck(notificationUserDocument);
  }
});
