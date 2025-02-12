import { expectFail, itShouldFail } from '@dereekb/util/test';
import { FirebaseAuthUserId, NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE, NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE, NotificationBoxRecipient, NotificationUser, NotificationUserNotificationBoxRecipientConfig, firestoreDummyKey } from '@dereekb/firebase';
import { updateNotificationUserNotificationBoxRecipientConfig } from './notification.util';
import { jestExpectFailAssertHttpErrorServerErrorCode } from '../../../../test/src/lib/firebase/firebase.jest';

// more utils are tested in demo-api/.../notification.util.spec.ts so that it has access to authService and other configured services.

const EXAMPLE_TEST_TEMPLATE_TYPE = 'test';
const ADDED_EXAMPLE_TEST_TEMPLATE_TYPE = 'test_added';

describe('updateNotificationUserNotificationBoxRecipientConfig()', () => {
  const uid: FirebaseAuthUserId = '0';
  const nb = '111';
  const m = firestoreDummyKey();
  const otherNb = '222';

  describe('recipient exists in notification box config', () => {
    const i = 0;

    const notificationBoxRecipient: NotificationBoxRecipient = {
      i,
      uid,
      c: {
        [EXAMPLE_TEST_TEMPLATE_TYPE]: {
          sn: true
        }
      }
    };

    describe('box config exists in associated NotificationUser', () => {
      const bc = [
        {
          nb,
          m,
          ...notificationBoxRecipient
        },
        {
          nb: otherNb,
          m,
          ...notificationBoxRecipient
        }
      ];

      const notificationUser: NotificationUser = {
        b: [],
        bc,
        uid,
        dc: { c: {} },
        gc: { c: {} }
      };

      const nextNotificationBoxRecipient: NotificationBoxRecipient = {
        ...notificationBoxRecipient,
        c: {
          [ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]: {
            sn: true,
            se: true,
            sp: false,
            st: false
          }
        }
      };

      describe('insert', () => {
        it('should update the example template type config', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: nextNotificationBoxRecipient,
            // not inserting or removing
            insertingRecipientIntoNotificationBox: true,
            removeRecipientFromNotificationBox: false
          });

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedNotificationBoxRecipient).toBeDefined();

          const updatedBc = result.updatedBc?.[0] as NotificationUserNotificationBoxRecipientConfig;
          const updatedNotificationBoxRecipient = result.updatedNotificationBoxRecipient as NotificationBoxRecipient;

          expect(updatedBc.i).toBe(i);
          expect(Object.keys(updatedBc.c)).toHaveLength(2);

          expect(updatedBc.c[EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
          expect(updatedBc.c[EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(notificationBoxRecipient.c[EXAMPLE_TEST_TEMPLATE_TYPE].sn); // unchanged

          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined(); // added
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st);

          expect(updatedNotificationBoxRecipient.i).toBe(i);
          expect(Object.keys(updatedNotificationBoxRecipient.c)).toHaveLength(2);

          expect(updatedNotificationBoxRecipient.c[EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
          expect(updatedNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
        });

        describe('notificationUser is blocked from adding', () => {
          itShouldFail('to insert the user', () => {
            expectFail(
              () =>
                updateNotificationUserNotificationBoxRecipientConfig({
                  notificationBoxId: nb,
                  notificationBoxAssociatedModelKey: m,
                  notificationUserId: uid,
                  notificationUser: {
                    ...notificationUser,
                    bc: [
                      {
                        nb,
                        m,
                        ...notificationBoxRecipient,
                        bk: true // is blocked
                      }
                    ]
                  },
                  notificationBoxRecipient: nextNotificationBoxRecipient,
                  // inserting
                  insertingRecipientIntoNotificationBox: true,
                  removeRecipientFromNotificationBox: false
                }),
              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE)
            );
          });
        });
      });

      describe('update', () => {
        it('should update the example template type config', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: nextNotificationBoxRecipient,
            // not inserting or removing
            insertingRecipientIntoNotificationBox: false,
            removeRecipientFromNotificationBox: false
          });

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedNotificationBoxRecipient).toBeDefined();

          const updatedBc = result.updatedBc?.[0] as NotificationUserNotificationBoxRecipientConfig;
          const updatedNotificationBoxRecipient = result.updatedNotificationBoxRecipient as NotificationBoxRecipient;

          expect(updatedBc.i).toBe(i);
          expect(Object.keys(updatedBc.c)).toHaveLength(2);

          expect(updatedBc.c[EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
          expect(updatedBc.c[EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(notificationBoxRecipient.c[EXAMPLE_TEST_TEMPLATE_TYPE].sn); // unchanged

          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined(); // added
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st);

          expect(updatedNotificationBoxRecipient.i).toBe(i);
          expect(Object.keys(updatedNotificationBoxRecipient.c)).toHaveLength(2);

          expect(updatedNotificationBoxRecipient.c[EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
          expect(updatedNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
        });

        it('should update any index changes', () => {
          const expectedI = 2;
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: {
              ...nextNotificationBoxRecipient,
              i: expectedI
            },
            // not inserting or removing
            insertingRecipientIntoNotificationBox: false,
            removeRecipientFromNotificationBox: false
          });

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedNotificationBoxRecipient).toBeDefined();

          const updatedBc = result.updatedBc?.[0] as NotificationUserNotificationBoxRecipientConfig;
          const updatedNotificationBoxRecipient = result.updatedNotificationBoxRecipient as NotificationBoxRecipient;

          expect(updatedBc.i).toBe(expectedI);
          expect(updatedNotificationBoxRecipient.i).toBe(expectedI);
        });

        describe('notificationUser is locked', () => {
          itShouldFail('to update the locked field', () => {
            expectFail(
              () =>
                updateNotificationUserNotificationBoxRecipientConfig({
                  notificationBoxId: nb,
                  notificationBoxAssociatedModelKey: m,
                  notificationUserId: uid,
                  notificationUser: {
                    ...notificationUser,
                    bc: [
                      {
                        nb,
                        m,
                        ...notificationBoxRecipient,
                        lk: true // is locked
                      }
                    ]
                  },
                  notificationBoxRecipient: nextNotificationBoxRecipient,
                  // not inserting or removing
                  insertingRecipientIntoNotificationBox: false,
                  removeRecipientFromNotificationBox: false
                }),
              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE)
            );
          });
        });
      });

      describe('remove', () => {
        it('should flag as removed in updatedBc', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: undefined,
            // removing
            insertingRecipientIntoNotificationBox: false,
            removeRecipientFromNotificationBox: true
          });

          expect(result.updatedNotificationBoxRecipient).toBeUndefined(); // is being removed

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedBc?.[0]?.nb).toBe(nb);
          expect(result.updatedBc?.[0]?.rm).toBe(true);
        });
      });
    });

    describe('box config does not exist in associated NotificationUser', () => {
      const notificationUser: NotificationUser = {
        b: [],
        bc: [],
        uid,
        dc: { c: {} },
        gc: { c: {} }
      };

      const nextNotificationBoxRecipient: NotificationBoxRecipient = {
        ...notificationBoxRecipient,
        c: {
          [ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]: {
            sn: true,
            se: true,
            sp: false,
            st: false
          }
        }
      };

      describe('insert', () => {
        it('should insert the example template type config into bc', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: nextNotificationBoxRecipient,
            // inserting
            insertingRecipientIntoNotificationBox: true,
            removeRecipientFromNotificationBox: false
          });

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedNotificationBoxRecipient).toBeDefined();

          const updatedBc = result.updatedBc?.[0] as NotificationUserNotificationBoxRecipientConfig;
          const updatedNotificationBoxRecipient = result.updatedNotificationBoxRecipient as NotificationBoxRecipient;

          expect(updatedBc.i).toBe(i);
          expect(Object.keys(updatedBc.c)).toHaveLength(1);

          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined(); // added
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st);

          expect(updatedNotificationBoxRecipient.i).toBe(i);
          expect(Object.keys(updatedNotificationBoxRecipient.c)).toHaveLength(1);

          expect(updatedNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
        });
      });

      describe('update', () => {
        it('should insert the example template type config into bc', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: nextNotificationBoxRecipient,
            // not inserting or removing
            insertingRecipientIntoNotificationBox: false,
            removeRecipientFromNotificationBox: false
          });

          expect(result.updatedBc).toBeDefined();
          expect(result.updatedNotificationBoxRecipient).toBeDefined();

          const updatedBc = result.updatedBc?.[0] as NotificationUserNotificationBoxRecipientConfig;
          const updatedNotificationBoxRecipient = result.updatedNotificationBoxRecipient as NotificationBoxRecipient;

          expect(updatedBc.i).toBe(i);
          expect(Object.keys(updatedBc.c)).toHaveLength(1);

          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined(); // added
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sn);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].se);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].sp);
          expect(updatedBc.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st).toBe(nextNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE].st);

          expect(updatedNotificationBoxRecipient.i).toBe(i);
          expect(Object.keys(updatedNotificationBoxRecipient.c)).toHaveLength(1);

          expect(updatedNotificationBoxRecipient.c[ADDED_EXAMPLE_TEST_TEMPLATE_TYPE]).toBeDefined();
        });
      });

      describe('remove', () => {
        it('should return updatedBc as undefined and updatedNotificationBoxRecipient as undefined', () => {
          const result = updateNotificationUserNotificationBoxRecipientConfig({
            notificationBoxId: nb,
            notificationBoxAssociatedModelKey: m,
            notificationUserId: uid,
            notificationUser,
            notificationBoxRecipient: nextNotificationBoxRecipient,
            // removing
            insertingRecipientIntoNotificationBox: false,
            removeRecipientFromNotificationBox: true
          });

          expect(result.updatedBc).toBeUndefined();
          expect(result.updatedNotificationBoxRecipient).toBeUndefined();
        });
      });
    });
  });
});
