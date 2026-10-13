import {
  type NotificationUserHealthCheckAutofixParams,
  type NotificationUserHealthCheckAutofixResult,
  type NotificationUserHealthCheckParams,
  type NotificationUserHealthCheckResult,
  type ResyncNotificationUserParams,
  type ResyncNotificationUserResult,
  type UpdateNotificationUserParams,
  notificationUserHealthCheckAutofixParamsType,
  notificationUserHealthCheckParamsType,
  updateNotificationUserParamsType,
  resyncNotificationUserParamsType
} from '@dereekb/firebase';
import { assertIsAdminInRequest, isAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
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
    // Additive: re-syncs derived recipient data.
    destructive: false,
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
 *
 * Deliberately declared `mcp: { readOnly: false }`: every run persists the result to the user's `hc`
 * field (and spends the user's run allowance), and `sendProbe` dispatches a real test message. It stays
 * a write method, so an agent never reaches it through the auto-approvable read tool. A plain run is
 * additive (`destructive: false`) and goes through `demo_mcp_write`; a run that sets `sendProbe` is
 * open-world and goes through `demo_mcp_destructive`.
 */
export const notificationUserHealthCheck: DemoInvokeModelFunction<NotificationUserHealthCheckParams, NotificationUserHealthCheckResult> = withApiDetails({
  inputType: notificationUserHealthCheckParamsType,
  mcp: {
    // A write: each run persists its result to the user's `hc` field, and `sendProbe` sends a real test message.
    readOnly: false,
    // Additive: a plain run only reads the providers and records the result.
    destructive: false,
    // A real test message reaches outside the app, so a probe run goes through demo_mcp_destructive.
    escalatingParams: { sendProbe: { openWorld: true } }
  },
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

    // `force` skips the throttle windows that stop a user from hammering the delivery providers and
    // their own inbox, so it is admin-only. The action cannot see who is calling, which makes clearing
    // it here the enforcement — not a convenience.
    const params: NotificationUserHealthCheckParams = isAdminInRequest(request) ? data : { ...data, force: undefined };

    const notificationUserHealthCheck = await nest.notificationActions.notificationUserHealthCheck(params);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'read',
      use: (x) => x.document
    });

    return notificationUserHealthCheck(notificationUserDocument);
  }
});

/**
 * Fixes notification delivery issues the user's stored health check marked as fixable, such as an address
 * on the email provider's unsubscribe list, then checks that delivery method again.
 *
 * Admin only. A fix changes state at the delivery provider and can override a choice the recipient made,
 * and the action cannot see who is calling, so this is where it is enforced.
 */
export const notificationUserHealthCheckAutofix: DemoInvokeModelFunction<NotificationUserHealthCheckAutofixParams, NotificationUserHealthCheckAutofixResult> = withApiDetails({
  inputType: notificationUserHealthCheckAutofixParamsType,
  mcp: {
    // Open-world: a fix changes Mailgun suppression state, which can override a recipient's choice.
    openWorld: true,
    // A write: a fix changes state at the delivery provider, and the re-check persists its result to `hc`.
    readOnly: false,
    visibility: { requiredRoles: [AUTH_ADMIN_ROLE] }
  },
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const notificationUserHealthCheckAutofix = await nest.notificationActions.notificationUserHealthCheckAutofix(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'read',
      use: (x) => x.document
    });

    return notificationUserHealthCheckAutofix(notificationUserDocument);
  }
});
