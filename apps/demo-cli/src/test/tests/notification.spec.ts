import { deleteApp, getApps } from 'firebase/app';
import { FIRESTORE_SESSION_OIDC_SCOPE, NotificationDeliveryMethod, type NotificationDocument, createNotificationDocument, twoWayFlatFirestoreModelKey } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures; same pattern as `withDemoTestCli`.
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
import { CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE, EXAMPLE_NOTIFICATION_TASK_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, TEST_NOTIFICATIONS_TEMPLATE_TYPE, exampleNotificationTaskTemplate } from 'demo-firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoNotificationContext, demoNotificationUserContext, demoProfileContext } from 'demo-api/test';
import { withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

/**
 * OAuth fixture that explicitly requests `session.firestore`, so `model notification tasks` (direct
 * Firestore only) can open a session. See `firestore-query.spec.ts`.
 */
const demoOAuthSuperTestContextWithFirestoreSessionScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-cli-notification-oauth-context',
  scopes: `openid profile email demo offline_access model.read model.query model.update ${FIRESTORE_SESSION_OIDC_SCOPE}`
});

/**
 * Parses a CLI stdout envelope, failing the assertion with the raw text when it is not JSON.
 *
 * @param stdoutText - Captured stdout.
 * @returns The parsed envelope.
 */
function parseEnvelope(stdoutText: string): any {
  let result: any;

  try {
    result = JSON.parse(stdoutText);
  } catch {
    throw new Error(`stdout was not a JSON envelope: ${stdoutText}`);
  }

  return result;
}

/**
 * Coverage for the notification commands, driven in-process against the emulators:
 *
 * - the auth-free `notification types` / `notification task-types` catalog group, read from the
 *   runtime template type info record and the committed generated manifest;
 * - `model notificationUser settings`, after a `model notificationUser update`;
 * - `model notification task` / `model notification tasks` for an example task created on a profile's
 *   NotificationBox.
 *
 * Reads go `--via api`: the emulator's direct-Firestore session is claimless (see
 * `firestore-query.spec.ts`), so `nb/<box>/nbn` (`allow read: if userClaimsIsSysAdmin()`) is denied
 * there. `model notification tasks` reads Firestore directly, so its emulator coverage is the denial.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  afterEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  demoAuthorizedUserAdminContext({ f }, (u) => {
    demoOAuthSuperTestContextWithFirestoreSessionScope({ f, u }, (oauth) => {
      withDemoTestCli({ f, oauth }, ({ runCli }) => {
        describe('notification types', () => {
          it('lists the user-configurable types', async () => {
            const envelope = parseEnvelope((await runCli(['notification', 'types', '--json'])).stdoutText);
            const types = envelope.data.types.map((x: { readonly type: string }) => x.type);

            expect(envelope.ok).toBe(true);
            expect(types).toContain(GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
            expect(types).not.toContain(TEST_NOTIFICATIONS_TEMPLATE_TYPE);
          });

          it('includes the hidden types with --all', async () => {
            const envelope = parseEnvelope((await runCli(['notification', 'types', '--all', '--json'])).stdoutText);
            const types = envelope.data.types.map((x: { readonly type: string }) => x.type);

            expect(types).toContain(TEST_NOTIFICATIONS_TEMPLATE_TYPE);
          });

          it('lists the forced delivery methods of a type', async () => {
            const envelope = parseEnvelope((await runCli(['notification', 'types', '--json'])).stdoutText);
            const calendarInvite = envelope.data.types.find((x: { readonly type: string }) => x.type === CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE);

            expect(calendarInvite.forcedDeliveryMethods).toEqual([NotificationDeliveryMethod.EMAIL]);
          });
        });

        describe('notification task-types', () => {
          it('shows the checkpoints of a task type from the generated manifest', async () => {
            const result = await runCli(['notification', 'task-types', EXAMPLE_NOTIFICATION_TASK_TYPE, '--expanded']);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText).toContain('part_a');
            expect(result.stdoutText).toContain('part_c');
          });
        });

        describe('model notificationUser settings', () => {
          demoNotificationUserContext({ f, u }, (nu) => {
            it('shows a setting changed with model notificationUser update', async () => {
              const data = { key: nu.documentKey, gc: { configs: [{ type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, se: false }] } };
              const update = await runCli(['model', 'notificationUser', 'update', '--data', JSON.stringify(data)]);
              expect(update.error).toBeUndefined();
              expect(update.exitCode).toBeUndefined();

              const envelope = parseEnvelope((await runCli(['model', 'notificationUser', 'settings', u.uid, '--via', 'api', '--json'])).stdoutText);
              const row = envelope.data.types.find((x: { readonly type: string }) => x.type === GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
              const cell = row.cells[NotificationDeliveryMethod.EMAIL];

              expect(envelope.ok).toBe(true);
              expect(envelope.data.exists).toBe(true);
              expect(cell.value).toBe(false);
              expect(cell.effective).toBe(false);
              expect(cell.source).toBe('explicit');
            });

            it('includes the update payloads with --expanded', async () => {
              const envelope = parseEnvelope((await runCli(['model', 'notificationUser', 'settings', nu.documentKey, '--via', 'api', '--json', '--expanded'])).stdoutText);

              expect(envelope.data.howToChange.command).toContain('model notificationUser update');
              expect(envelope.data.howToChange.examples.length).toBeGreaterThan(0);
            });
          });
        });

        describe('model notification', () => {
          demoProfileContext({ f, u }, (p) => {
            let notificationDocument: NotificationDocument;

            beforeEach(async () => {
              // `context` lets createNotificationDocument() resolve the profile's NotificationBox (nb/pr_<uid>)
              const result = await createNotificationDocument({ context: f.demoFirestoreCollections, template: exampleNotificationTaskTemplate({ profileDocument: p.document }) });
              notificationDocument = result.notificationDocument;
            });

            demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
              it('shows one task with model notification task', async () => {
                const envelope = parseEnvelope((await runCli(['model', 'notification', 'task', nbn.documentKey, '--via', 'api', '--json', '--expanded'])).stdoutText);

                expect(envelope.ok).toBe(true);
                expect(envelope.data.type).toBe(EXAMPLE_NOTIFICATION_TASK_TYPE);
                expect(envelope.data.isTask).toBe(true);
                expect(envelope.data.state).not.toBe('done');
                expect(envelope.data.remainingCheckpoints).toEqual(['part_a', 'part_b', 'part_c']);
                expect(envelope.data.nextCheckpoint).toBe('part_a');
              });

              it('rejects a key that is not a notification key', async () => {
                const result = await runCli(['model', 'notification', 'task', p.documentKey]);

                expect(result.exitCode).toBe(1);
              });

              it('refuses model notification tasks on the claimless emulator session', async () => {
                // the task lives in the profile's box: nb/pr_<uid>
                expect(nbn.documentKey.startsWith(`nb/${twoWayFlatFirestoreModelKey(p.documentKey)}/`)).toBe(true);

                const envelope = parseEnvelope((await runCli(['model', 'notification', 'tasks', p.documentKey, '--json'])).stdoutText);

                expect(envelope.ok).toBe(false);
                expect(envelope.code).toBe('AUTH_FORBIDDEN');
              });
            });
          });
        });
      });
    });
  });
});
