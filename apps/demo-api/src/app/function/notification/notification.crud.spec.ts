import { demoCallModel } from './../model/crud.functions';
import { addMinutes, isFuture } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoGuestbookContext, demoNotificationBoxContext, demoNotificationContext, demoNotificationSummaryContext, demoNotificationSummaryContextFactory, demoNotificationUserContext, demoProfileContext } from '../../../test/fixture';
import { describeCloudFunctionTest, jestExpectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import {
  DocumentDataWithIdAndKey,
  NotificationBox,
  Notification,
  NotificationDocument,
  NotificationItem,
  NotificationMessage,
  NotificationMessageFunctionFactoryConfig,
  NotificationMessageInputContext,
  NotificationSendState,
  NotificationSendType,
  NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE,
  UpdateNotificationUserParams,
  notificationUserIdentity,
  onCallUpdateModelParams,
  NotificationUserNotificationBoxRecipientConfig,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  ResyncNotificationUserParams,
  ResyncNotificationUserResult,
  UpdateNotificationBoxRecipientParams,
  notificationBoxIdentity,
  NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE,
  NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE,
  createNotificationDocument,
  CreateNotificationTemplate,
  NotificationBoxRecipientFlag
} from '@dereekb/firebase';
import { demoNotificationTestFactory } from '../../common/model/notification/notification.factory';
import { EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, TEST_NOTIFICATIONS_TEMPLATE_TYPE, exampleNotificationTemplate } from '@dereekb/demo-firebase';
import { UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from '../../common/model/notification/notification.send.mailgun.service';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { UNSET_INDEX_NUMBER } from '@dereekb/util';

demoApiFunctionContextFactory((f) => {
  describeCloudFunctionTest('notification.crud', { f, fns: { demoCallModel } }, ({ demoCallModelCloudFn }) => {
    // TODO: Before each, replace the notification sender config, or reference a specific test type that can "test send" things.

    afterEach(() => {
      // f.mailgunService.mailgunApi.config.messages.sendTestEmails = false; // reset to prevent sending test emails by accident
    });

    describe('utils', () => {
      describe('buildNotificationMailgunTemplateEmailRequest()', () => {
        it('should build a template request for a known/registered template type', async () => {
          const testNotificationFactory = demoNotificationTestFactory(f.serverActionsContext);

          const item: NotificationItem = {
            id: 'test',
            cat: new Date(),
            t: TEST_NOTIFICATIONS_TEMPLATE_TYPE
          };

          // the test factory does not use these, but they are required for the config usually
          const notificationBox: DocumentDataWithIdAndKey<NotificationBox> = {} as any;
          const notification: DocumentDataWithIdAndKey<Notification> = {} as any;

          const config: NotificationMessageFunctionFactoryConfig = {
            item,
            notification,
            notificationBox
          };

          const inputContext: NotificationMessageInputContext = {
            recipient: {
              n: 'tester',
              e: 'test.sender@dereekb.com'
            }
          };

          const testFactory = await testNotificationFactory.factory(config);
          const notificationMessage = await testFactory(inputContext);

          const mailgunService = f.mailgunService;
          expect(mailgunService).toBeDefined();
          expect(mailgunService.mailgunApi).toBeDefined();

          const messages: NotificationMessage<{}>[] = [notificationMessage];

          const sendService = demoNotificationMailgunSendService(f.mailgunService);
          const send = await sendService.buildSendInstanceForEmailNotificationMessages(messages);

          expect(send).toBeDefined();
        });

        // TODO: it should fail
      });
    });

    describe('model', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        // use profile as the primary notification model target
        demoProfileContext({ f, u }, (p) => {
          describe('Notification User', () => {
            demoNotificationUserContext({ f, u }, (nu) => {
              describe('updates', () => {
                const e = 'test@components.dereekb.com';
                const t = '+1208888888';

                describe('global config', () => {
                  it('should update the global config', async () => {
                    const params: UpdateNotificationUserParams = {
                      key: nu.documentKey,
                      gc: {
                        bk: true,
                        lk: true,
                        e,
                        t,
                        configs: [
                          {
                            type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
                            se: true,
                            st: false // no text
                          }
                        ]
                      }
                    };

                    await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                    const notificationUser = await assertSnapshotData(nu.document);

                    expect(notificationUser.ns).toBeFalsy(); // not associated with any NotificationBoxes to sync

                    expect(notificationUser.gc.bk).toBe(true);
                    expect(notificationUser.gc.lk).toBe(true);
                    expect(notificationUser.gc.e).toBe(e);
                    expect(notificationUser.gc.t).toBe(t);
                    expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                    expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(true);
                    expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(false);
                  });
                });

                describe('default config', () => {
                  it('should update the default config', async () => {
                    const params: UpdateNotificationUserParams = {
                      key: nu.documentKey,
                      dc: {
                        bk: true,
                        lk: true,
                        e,
                        t,
                        configs: [
                          {
                            type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
                            se: true,
                            st: false // texting turned off
                          }
                        ]
                      }
                    };

                    await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                    const notificationUser = await assertSnapshotData(nu.document);

                    expect(notificationUser.ns).toBeFalsy(); // should not have changed sync

                    expect(notificationUser.dc.bk).toBe(true);
                    expect(notificationUser.dc.lk).toBe(true);
                    expect(notificationUser.dc.e).toBe(e);
                    expect(notificationUser.dc.t).toBe(t);
                    expect(notificationUser.dc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                    expect(notificationUser.dc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(true);
                    expect(notificationUser.dc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(false);
                  });
                });

                describe('notification box config', () => {
                  it('should ignore any updates to NotificationBox configs that do not exist on the NotificationUser', async () => {
                    const params: UpdateNotificationUserParams = {
                      key: nu.documentKey,
                      bc: [{ nb: 'test', configs: [{ type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, se: true, st: false }] }]
                    };

                    await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                    const notificationUser = await assertSnapshotData(nu.document);

                    expect(notificationUser.ns).toBeFalsy(); // should not have changed sync
                    expect(notificationUser.bc).toHaveLength(0);
                  });
                });
              });

              describe('associated with NotificationBox', () => {
                demoNotificationBoxContext(
                  {
                    f,
                    for: p, // NotificationBox is for the profile
                    createIfNeeded: true,
                    initIfNeeded: true
                  },
                  (nb_p) => {
                    demoGuestbookContext({ f }, (g) => {
                      demoNotificationBoxContext(
                        {
                          f,
                          for: g, // NotificationBox is for the guestbook too
                          createIfNeeded: true,
                          initIfNeeded: true
                        },
                        (nb_g) => {
                          beforeEach(async () => {
                            // associate with both notification boxes

                            const updateProfileNotificationBoxRecipient = await f.notificationServerActions.updateNotificationBoxRecipient({
                              key: nb_p.documentKey,
                              uid: u.uid,
                              insert: true,
                              configs: [
                                {
                                  type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                  se: true,
                                  st: false // no text
                                }
                              ]
                            });

                            await updateProfileNotificationBoxRecipient(nb_p.document);

                            const updateGuestbookNotificationBoxRecipient = await f.notificationServerActions.updateNotificationBoxRecipient({
                              key: g.documentKey,
                              uid: u.uid,
                              insert: true,
                              configs: []
                            });

                            await updateGuestbookNotificationBoxRecipient(nb_g.document);
                          });

                          describe('updates', () => {
                            describe('global config', () => {
                              it('should update the global config for a specific configuration but ignore unknown types', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const UNKNOWN_TYPE = 'UNKNOWN_TYPE';
                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  gc: {
                                    configs: [
                                      {
                                        type: UNKNOWN_TYPE,
                                        se: false, // opt-out of emails
                                        st: true // opt-into texts
                                      },
                                      {
                                        type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                        se: false, // opt-out of emails
                                        st: true // opt-into texts
                                      }
                                    ]
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.gc.c[UNKNOWN_TYPE]).toBeUndefined();
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(false);
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(true);
                              });

                              it('should update the global config for a specific configuration', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  gc: {
                                    configs: [
                                      {
                                        type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                        se: false, // opt-out of emails
                                        st: true // opt-into texts
                                      }
                                    ]
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(false);
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(true);
                              });

                              it('should update the default config for a specific configuration', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  dc: {
                                    configs: [
                                      {
                                        type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                        se: false, // opt-out of emails
                                        st: true // opt-into texts
                                      }
                                    ]
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.dc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                expect(notificationUser.dc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(false);
                                expect(notificationUser.dc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(true);
                              });

                              it('should update the default config to opt-out by default', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  dc: {
                                    f: NotificationBoxRecipientFlag.OPT_OUT
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.dc.f).toBe(NotificationBoxRecipientFlag.OPT_OUT);
                              });

                              it('should update the global config for a specific configuration to opt out of all notifications for a specific type', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  gc: {
                                    configs: [
                                      {
                                        type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
                                        sd: false // opt out of all
                                      }
                                    ]
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE].sd).toBe(false);
                              });

                              it('updating the text or email on the global config should flag all notification box configs on NotificationUser for sync', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const e = 'test@components.dereekb.com';
                                const t = '+1208888888';

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  gc: {
                                    e,
                                    t
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.ns).toBe(true); // should sync with the notification box

                                const profileNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(profileNotificationBoxConfig.ns).toBe(true);

                                const guestbookNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_g.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(guestbookNotificationBoxConfig.ns).toBe(true);

                                expect(notificationUser.bc[0].ns).toBe(true);
                                expect(notificationUser.gc.e).toBe(e);
                                expect(notificationUser.gc.t).toBe(t);
                              });

                              it('updating the global config should flag a sync on the relevant guestbooks', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);

                                const e = 'test@components.dereekb.com';
                                const t = '+1208888888';

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  gc: {
                                    configs: [
                                      {
                                        type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, // should trigger all associated guestbook model NotificationBoxes
                                        se: true,
                                        st: false // no text
                                      }
                                    ]
                                  }
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.ns).toBe(true); // should sync with the notification box

                                const profileNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(profileNotificationBoxConfig.ns).toBeFalsy(); // updated config is not for profile

                                const guestbookNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_g.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(guestbookNotificationBoxConfig.ns).toBe(true); // updated config is for guestbook

                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(true);
                                expect(notificationUser.gc.c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(false);
                              });

                              describe('global config updated', () => {
                                beforeEach(async () => {
                                  const params: UpdateNotificationUserParams = {
                                    key: nu.documentKey,
                                    gc: {
                                      configs: [
                                        {
                                          type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
                                          se: true,
                                          st: false // no text
                                        }
                                      ]
                                    }
                                  };

                                  await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                });

                                it('should sync the global config to only the relevant NotificationBoxes', async () => {
                                  let notificationBox = await assertSnapshotData(nb_g.document);

                                  expect(notificationBox.r[0].c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE]).not.toBeDefined();

                                  const params: ResyncNotificationUserParams = {
                                    key: nu.documentKey
                                  };

                                  const result = (await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params, 'resync'))) as ResyncNotificationUserResult;
                                  expect(result.notificationBoxesUpdated).toBe(1);

                                  notificationBox = await assertSnapshotData(nb_g.document);

                                  expect(notificationBox.r[0].c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE]).toBeDefined();
                                  expect(notificationBox.r[0].c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].se).toBe(true);
                                  expect(notificationBox.r[0].c[GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE].st).toBe(false);
                                });
                              });
                            });

                            describe('notification box config', () => {
                              it('should update the config on the NotificationUser and flag for sync if the config values change', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: nb_p.documentId,
                                      configs: [
                                        {
                                          type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                          se: false,
                                          st: false,
                                          sn: false,
                                          sp: false
                                        }
                                      ]
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBe(true);

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBe(true);

                                const exampleTemplateConfig = relatedNotificationBoxConfig.c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE];

                                expect(exampleTemplateConfig.se).toBe(false);
                                expect(exampleTemplateConfig.st).toBe(false);
                                expect(exampleTemplateConfig.sn).toBe(false);
                                expect(exampleTemplateConfig.sp).toBe(false);
                              });

                              it('should update the config on the NotificationUser and flag for sync if the email value changes', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const e = 'test@components.dereekb.com';

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: nb_p.documentId,
                                      e
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBe(true);

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBe(true);
                                expect(relatedNotificationBoxConfig.e).toBe(e);
                              });

                              it('should update the config on the NotificationUser and flag for sync if rm is set true', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: nb_p.documentId,
                                      rm: true
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBe(true);

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBe(true); // flagged for resync
                                expect(relatedNotificationBoxConfig.rm).toBe(true);
                                expect(relatedNotificationBoxConfig.i).not.toBe(UNSET_INDEX_NUMBER); // i is retained until resync occurs
                              });

                              it('should not flag for sync if the config has no changes', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const notificationBoxConfig = notificationUser.bc[0];

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: notificationBoxConfig.nb
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();
                              });

                              it('should filter out any notification types that are not known from changes', async () => {
                                const type = 'UNKNOWN_TYPE';

                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const allKnownTemplateTypesForProfileModel = f.serverActionsContext.appNotificationTemplateTypeInfoRecordService.getTemplateTypesForNotificationModel(inferKeyFromTwoWayFlatFirestoreModelKey(nb_p.documentId));
                                expect(allKnownTemplateTypesForProfileModel.findIndex((x) => x === type)).toBe(-1);

                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: nb_p.documentId,
                                      configs: [
                                        {
                                          type: 'UNKNOWN_TYPE',
                                          se: true,
                                          st: false
                                        }
                                      ]
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                notificationUser = await assertSnapshotData(nu.document);

                                expect(notificationUser.ns).toBeFalsy(); // nothing to sync since no new types should have been added
                                expect(notificationUser.bc).toHaveLength(2); // still associated with two notification boxes

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBeFalsy(); // nothing to sync as no changes occured

                                expect(relatedNotificationBoxConfig.c['UNKNOWN_TYPE']).toBeUndefined();
                              });
                            });

                            describe('updating NotificationBox recipient', () => {
                              it('should allow the NotificationBox to update the user', async () => {
                                let notificationBox = await assertSnapshotData(nb_p.document);
                                expect(notificationBox.r).toHaveLength(1);

                                const params: UpdateNotificationBoxRecipientParams = {
                                  key: nb_p.documentKey,
                                  uid: u.uid,
                                  configs: [
                                    {
                                      type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                      se: true,
                                      sn: true,
                                      sp: false
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient'));

                                notificationBox = await assertSnapshotData(nb_p.document);
                                expect(notificationBox.r).toHaveLength(1);

                                const notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.bc[0].nb).toBe(nb_p.documentId);
                                expect(notificationUser.bc[0].i).toBe(0);
                                expect(notificationUser.bc[0].c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE].se).toBe(true);
                                expect(notificationUser.bc[0].c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE].sn).toBe(true);
                                expect(notificationUser.bc[0].c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE].sp).toBe(false);
                                expect(notificationUser.bc[0].c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE].st).toBeUndefined();
                              });

                              describe('NotificationUser locks themselves from additional updates via global config', () => {
                                beforeEach(async () => {
                                  const params: UpdateNotificationUserParams = {
                                    key: nu.documentKey,
                                    gc: {
                                      lk: true
                                    }
                                  };

                                  await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                });

                                itShouldFail('to update the user', async () => {
                                  const notificationUser = await assertSnapshotData(nu.document);
                                  expect(notificationUser.gc.lk).toBe(true);

                                  const params: UpdateNotificationBoxRecipientParams = {
                                    key: nb_p.documentKey,
                                    uid: u.uid,
                                    configs: [
                                      {
                                        type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                        se: true,
                                        st: true
                                      }
                                    ]
                                  };

                                  await expectFail(() => u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient')), jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE));
                                });
                              });

                              describe('NotificationUser locks themselves from additional updates via box config', () => {
                                beforeEach(async () => {
                                  const params: UpdateNotificationUserParams = {
                                    key: nu.documentKey,
                                    bc: [
                                      {
                                        nb: nb_p.documentId,
                                        lk: true
                                      }
                                    ]
                                  };

                                  await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                });

                                itShouldFail('to update the user', async () => {
                                  const notificationUser = await assertSnapshotData(nu.document);
                                  expect(notificationUser.bc[0].lk).toBe(true);

                                  const params: UpdateNotificationBoxRecipientParams = {
                                    key: nb_p.documentKey,
                                    uid: u.uid,
                                    configs: [
                                      {
                                        type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                        se: true,
                                        st: true
                                      }
                                    ]
                                  };

                                  await expectFail(() => u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient')), jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_LOCKED_CONFIG_FROM_BEING_UPDATED_ERROR_CODE));
                                });
                              });
                            });
                          });

                          describe('resync', () => {
                            describe('nothing to resync', () => {
                              it('should not be resynced when resyncAllNotificationUsers() is called', async () => {
                                const notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const result = await f.notificationServerActions.resyncAllNotificationUsers();
                                expect(result.notificationUsersResynced).toBe(0);
                              });
                            });

                            describe('flagged for resync', () => {
                              beforeEach(async () => {
                                const params: UpdateNotificationUserParams = {
                                  key: nu.documentKey,
                                  bc: [
                                    {
                                      nb: nb_p.documentId,
                                      configs: [
                                        {
                                          type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                                          se: false,
                                          st: false,
                                          sn: false,
                                          sp: false
                                        }
                                      ]
                                    }
                                  ]
                                };

                                await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                              });

                              it('should resync the user when resync is called by an admin', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBe(true);

                                const params: ResyncNotificationUserParams = {
                                  key: nu.documentKey
                                };

                                const result = (await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params, 'resync'))) as ResyncNotificationUserResult;
                                expect(result.notificationBoxesUpdated).toBe(1);

                                // notification user should now be marked synced
                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBeFalsy(); // should by synced now
                                expect(relatedNotificationBoxConfig.i).toBe(0); // index should still be set
                                expect(relatedNotificationBoxConfig.rm).toBeFalsy(); // was not marked for removal

                                const notificationBox = await assertSnapshotData(nb_p.document);
                                const relatedRecipient = notificationBox.r[0];

                                expect(relatedRecipient.uid).toBe(u.uid);

                                // check was synced to the notification box
                                const exampleTemplateConfig = relatedRecipient.c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE];

                                expect(exampleTemplateConfig.se).toBe(false);
                                expect(exampleTemplateConfig.st).toBe(false);
                                expect(exampleTemplateConfig.sn).toBe(false);
                                expect(exampleTemplateConfig.sp).toBe(false);
                              });

                              it('should be resynced when resyncAllNotificationUsers() is called', async () => {
                                let notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBe(true);

                                const result = await f.notificationServerActions.resyncAllNotificationUsers();
                                expect(result.notificationUsersResynced).toBe(1);
                                expect(result.notificationBoxesUpdated).toBe(1);

                                // notification user should now be marked synced
                                notificationUser = await assertSnapshotData(nu.document);
                                expect(notificationUser.ns).toBeFalsy();

                                const relatedNotificationBoxConfig = notificationUser.bc.find((x) => x.nb === nb_p.documentId) as NotificationUserNotificationBoxRecipientConfig;
                                expect(relatedNotificationBoxConfig.ns).toBeFalsy(); // should by synced now
                                expect(relatedNotificationBoxConfig.i).toBe(0); // index should still be set
                                expect(relatedNotificationBoxConfig.rm).toBeFalsy(); // was not marked for removal

                                const notificationBox = await assertSnapshotData(nb_p.document);
                                const relatedRecipient = notificationBox.r[0];

                                expect(relatedRecipient.uid).toBe(u.uid);

                                // check was synced to the notification box
                                const exampleTemplateConfig = relatedRecipient.c[EXAMPLE_NOTIFICATION_TEMPLATE_TYPE];

                                expect(exampleTemplateConfig.se).toBe(false);
                                expect(exampleTemplateConfig.st).toBe(false);
                                expect(exampleTemplateConfig.sn).toBe(false);
                                expect(exampleTemplateConfig.sp).toBe(false);
                              });

                              describe('flagged for remove from NotificationBox', () => {
                                beforeEach(async () => {
                                  const params: UpdateNotificationUserParams = {
                                    key: nu.documentKey,
                                    bc: [
                                      {
                                        nb: nb_p.documentId,
                                        rm: true
                                      }
                                    ]
                                  };

                                  await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                });

                                it('should remove the user from the NotificationBox on the next resync', async () => {
                                  let notificationBox = await assertSnapshotData(nb_p.document);
                                  expect(notificationBox.r).toHaveLength(1);

                                  let notificationUser = await assertSnapshotData(nu.document);
                                  expect(notificationUser.bc[0].nb).toBe(nb_p.documentId);
                                  expect(notificationUser.bc[0].rm).toBe(true);
                                  expect(notificationUser.bc[0].i).toBe(0);

                                  const result = await f.notificationServerActions.resyncAllNotificationUsers();
                                  expect(result.notificationUsersResynced).toBe(1);
                                  expect(result.notificationBoxesUpdated).toBe(1);

                                  notificationBox = await assertSnapshotData(nb_p.document);
                                  expect(notificationBox.r).toHaveLength(0);

                                  notificationUser = await assertSnapshotData(nu.document);
                                  expect(notificationUser.bc[0].nb).toBe(nb_p.documentId);
                                  expect(notificationUser.bc[0].rm).toBe(true);
                                  expect(notificationUser.bc[0].i).toBe(UNSET_INDEX_NUMBER);
                                });

                                describe('user removed from NotificationBox', () => {
                                  beforeEach(async () => {
                                    await f.notificationServerActions.resyncAllNotificationUsers();
                                  });

                                  it('should allow the user to remove the NotificationBox config from the NotificationUser', async () => {
                                    const params: UpdateNotificationUserParams = {
                                      key: nu.documentKey,
                                      bc: [
                                        {
                                          nb: nb_p.documentId,
                                          deleteRemovedConfig: true
                                        }
                                      ]
                                    };

                                    await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));

                                    const notificationUser = await assertSnapshotData(nu.document);
                                    expect(notificationUser.bc).toHaveLength(0);
                                  });

                                  it('should allow the NotificationBox restore the user', async () => {
                                    let notificationBox = await assertSnapshotData(nb_p.document);
                                    expect(notificationBox.r).toHaveLength(0);

                                    let notificationUser = await assertSnapshotData(nu.document);
                                    expect(notificationUser.bc[0].nb).toBe(nb_p.documentId);
                                    expect(notificationUser.bc[0].rm).toBe(true);
                                    expect(notificationUser.bc[0].i).toBe(UNSET_INDEX_NUMBER);

                                    const params: UpdateNotificationBoxRecipientParams = {
                                      key: nb_p.documentKey,
                                      uid: u.uid,
                                      insert: true
                                    };

                                    await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient'));

                                    notificationBox = await assertSnapshotData(nb_p.document);
                                    expect(notificationBox.r).toHaveLength(1);

                                    notificationUser = await assertSnapshotData(nu.document);
                                    expect(notificationUser.bc[0].nb).toBe(nb_p.documentId);
                                    expect(notificationUser.bc[0].rm).toBeFalsy();
                                    expect(notificationUser.bc[0].i).toBe(0);
                                  });

                                  describe('user blocks self from being added by specific NotificationBox', () => {
                                    beforeEach(async () => {
                                      const params: UpdateNotificationUserParams = {
                                        key: nu.documentKey,
                                        bc: [
                                          {
                                            nb: nb_p.documentId,
                                            bk: true
                                          }
                                        ]
                                      };

                                      await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                    });

                                    itShouldFail('to allow the user to be added to the NotificationBox', async () => {
                                      const notificationUser = await assertSnapshotData(nu.document);
                                      expect(notificationUser.bc[0].bk).toBe(true);

                                      const params: UpdateNotificationBoxRecipientParams = {
                                        key: nb_p.documentKey,
                                        uid: u.uid,
                                        insert: true
                                      };

                                      await expectFail(() => u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient')), jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE));
                                    });
                                  });

                                  describe('user blocks self from being added by specific NotificationBox', () => {
                                    beforeEach(async () => {
                                      const params: UpdateNotificationUserParams = {
                                        key: nu.documentKey,
                                        bc: [
                                          {
                                            nb: nb_p.documentId,
                                            bk: true
                                          }
                                        ]
                                      };

                                      await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                    });

                                    itShouldFail('to allow the user to be added to the NotificationBox', async () => {
                                      const notificationUser = await assertSnapshotData(nu.document);
                                      expect(notificationUser.bc[0].bk).toBe(true);

                                      const params: UpdateNotificationBoxRecipientParams = {
                                        key: nb_p.documentKey,
                                        uid: u.uid,
                                        insert: true
                                      };

                                      await expectFail(() => u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient')), jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE));
                                    });
                                  });

                                  describe('user blocks self from being added by all NotificationBoxes', () => {
                                    beforeEach(async () => {
                                      const params: UpdateNotificationUserParams = {
                                        key: nu.documentKey,
                                        gc: {
                                          bk: true // blocked from being added by anything
                                        }
                                      };

                                      await u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationUserIdentity, params));
                                    });

                                    itShouldFail('to allow the user to be added to the NotificationBox', async () => {
                                      const notificationUser = await assertSnapshotData(nu.document);
                                      expect(notificationUser.gc.bk).toBe(true);

                                      const params: UpdateNotificationBoxRecipientParams = {
                                        key: nb_p.documentKey,
                                        uid: u.uid,
                                        insert: true
                                      };

                                      await expectFail(() => u.callCloudFunction(demoCallModelCloudFn, onCallUpdateModelParams(notificationBoxIdentity, params, 'recipient')), jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_BLOCKED_FROM_BEING_ADD_TO_RECIPIENTS_ERROR_CODE));
                                    });
                                  });
                                });
                              });
                            });
                          });
                        }
                      );
                    });
                  }
                );
              });
            });
          });

          describe('Notification Summary', () => {
            demoNotificationSummaryContext({ f, for: p }, (ns) => {
              demoNotificationBoxContext({ f, for: p, createIfNeeded: false }, (nb) => {
                describe('initialization', () => {
                  describe('firestoreNotificationSummarySendService()', () => {
                    describe('configured to create notification summaries', () => {
                      function describeCreateNotificationSummary(expectation: 'create' | 'delay') {
                        it(`should ${expectation === 'create' ? 'create a new uninitiailized NotificationSummary' : 'delay the sending of the Notification'}`, async () => {
                          const createTestNotification = await f.profileServerActions.createTestNotification({
                            key: p.documentKey
                          });

                          await createTestNotification(p.document);

                          let exists = await ns.document.exists();
                          expect(exists).toBe(false);

                          const sendAllQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
                          const sendResult = await sendAllQueuedNotifications();

                          switch (expectation) {
                            case 'create':
                              expect(sendResult.sendNotificationSummaryResult?.success).toHaveLength(1);

                              exists = await ns.document.exists();
                              expect(exists).toBe(true);

                              break;
                            case 'delay':
                              expect(sendResult.notificationsDelayed).toBe(1);
                              expect(sendResult.sendNotificationSummaryResult?.success).toHaveLength(0);
                              expect(sendResult.sendNotificationSummaryResult?.ignored).toHaveLength(0);
                              expect(sendResult.sendNotificationSummaryResult?.failed).toHaveLength(0);

                              exists = await ns.document.exists();
                              expect(exists).toBe(false);

                              break;
                          }
                        });
                      }

                      describe('notification box exists', () => {
                        describe('uninitialized', () => {
                          demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, (nb) => {
                            describeCreateNotificationSummary('delay');
                          });
                        });

                        describe('initialized', () => {
                          demoNotificationBoxContext({ f, for: p, createIfNeeded: true, initIfNeeded: true }, (nb) => {
                            describeCreateNotificationSummary('create');
                          });
                        });
                      });

                      describe('notification does not exist', () => {
                        describeCreateNotificationSummary('delay');
                      });
                    });
                  });
                });
              });
            });
          });

          describe('Notification Box', () => {
            describe('exists', () => {
              demoNotificationBoxContext(
                {
                  f,
                  for: p, // NotificationBox is for the profile
                  createIfNeeded: true
                },
                (nb) => {
                  describe('updateNotificationBoxRecipient()', () => {
                    demoAuthorizedUserContext({ f }, (u2) => {
                      describe('recipient with uid', () => {
                        demoNotificationUserContext({ f, u: u2, init: false }, (nu2) => {
                          it('should add a user recipient via uid of a user that exists', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(0);

                            await nb.updateRecipient({
                              uid: u2.uid,
                              insert: true
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].uid).toBe(u2.uid);
                          });

                          it('should create a NotificationUser of a user via uid for a user that exists', async () => {
                            const notificationUserExists = await nu2.document.exists();
                            expect(notificationUserExists).toBe(false);

                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(0);

                            await nb.updateRecipient({
                              uid: u2.uid,
                              insert: true
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].uid).toBe(u2.uid);

                            // created the NotificationUser and sync'd configuration
                            const notificationUser = await assertSnapshotData(nu2.document);
                            expect(notificationUser.bc).toHaveLength(1);
                            expect(notificationUser.ns).toBe(false);
                            expect(notificationUser.bc[0].nb).toBe(nb.documentId);
                          });

                          itShouldFail('if the recipient does not exist in the NotificationBox and insert is not true', async () => {
                            await expectFail(
                              () =>
                                nb.updateRecipient({
                                  uid: u2.uid,
                                  insert: false
                                }),
                              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_BOX_RECIPIENT_DOES_NOT_EXIST_ERROR_CODE)
                            );
                          });

                          itShouldFail('if the recipient with the target uid does not exist', async () => {
                            await expectFail(
                              () =>
                                nb.updateRecipient({
                                  uid: 'does_not_exist',
                                  insert: true
                                }),
                              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                            );
                          });

                          describe('recipient exists in NotificationBox', () => {
                            beforeEach(async () => {
                              await nb.updateRecipient({
                                uid: u2.uid,
                                insert: true
                              });
                            });

                            it('should remove the recipient from the NotificationBox and retain the config on the NotificationUser', async () => {
                              await nb.updateRecipient({
                                uid: u2.uid,
                                remove: true
                              });

                              const notificationBox = await assertSnapshotData(nb.document);
                              expect(notificationBox.r).toHaveLength(0);

                              const notificationUser = await assertSnapshotData(nu2.document);
                              expect(notificationUser.bc).toHaveLength(1);

                              const relatedConfig = notificationUser.bc[0];

                              expect(relatedConfig.rm).toBe(true);
                              expect(relatedConfig.i).toBe(UNSET_INDEX_NUMBER);
                            });
                          });
                        });
                      });

                      describe('recipient with email address', () => {
                        const e = 'tester@dereekb.com';

                        it('should add an email recipient', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(0);

                          await nb.updateRecipient({
                            e,
                            insert: true
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].e).toBe(e);
                        });

                        describe('one exists', () => {
                          const i = 0;

                          beforeEach(async () => {
                            await nb.updateRecipient({
                              e,
                              insert: true
                            });
                          });

                          it('should add two of the same email recipient if insert is true and no index is passed', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].e).toBe(e);

                            // NOTE: Does not check for duplicate recipients. This is an intended effect.
                            await nb.updateRecipient({
                              e,
                              insert: true
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(2);
                            expect(notificationBox.r[0].e).toBe(e);
                            expect(notificationBox.r[1].e).toBe(e);
                          });

                          it('should update the email of the target recipient', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].e).toBe(e);
                            expect(notificationBox.r[0].i).toBe(i);

                            const expectedE = 'second@components.dereekb.com';

                            await nb.updateRecipient({
                              i,
                              e: expectedE
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].e).toBe(expectedE);
                            expect(notificationBox.r[0].i).toBe(i);
                          });

                          it('should add a valid uid to the target recipient', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].e).toBe(e);
                            expect(notificationBox.r[0].i).toBe(i);
                            expect(notificationBox.r[0].uid).toBeUndefined();

                            const expectedE = 'second@components.dereekb.com';

                            await nb.updateRecipient({
                              i,
                              e: expectedE,
                              uid: u2.uid // set uid too
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].e).toBe(expectedE);
                            expect(notificationBox.r[0].uid).toBe(u2.uid);
                            expect(notificationBox.r[0].i).toBe(i);
                          });

                          itShouldFail('to add a uid to the recipient if the target uid does not exist', async () => {
                            await expectFail(
                              () =>
                                nb.updateRecipient({
                                  uid: 'does_not_exist',
                                  insert: true
                                }),
                              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                            );
                          });

                          it('should remove the recipient', async () => {
                            await nb.updateRecipient({
                              i,
                              remove: true
                            });

                            const notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(0);
                          });
                        });
                      });

                      describe('recipient with phone number for sms', () => {
                        const t = '+1208888888';

                        it('should add a sms recipient', async () => {
                          let notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(0);

                          await nb.updateRecipient({
                            t,
                            insert: true
                          });

                          notificationBox = await assertSnapshotData(nb.document);
                          expect(notificationBox.r).toHaveLength(1);
                          expect(notificationBox.r[0].t).toBe(t);
                        });

                        describe('one exists', () => {
                          const i = 0;

                          beforeEach(async () => {
                            await nb.updateRecipient({
                              t,
                              insert: true
                            });
                          });

                          it('should add two of the same sms recipients if insert is true and no index is passed', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].t).toBe(t);

                            // NOTE: Does not check for duplicate recipients. This is an intended effect.
                            await nb.updateRecipient({
                              t,
                              insert: true
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(2);
                            expect(notificationBox.r[0].t).toBe(t);
                            expect(notificationBox.r[1].t).toBe(t);
                          });

                          it('should update the email of the target recipient', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].t).toBe(t);
                            expect(notificationBox.r[0].i).toBe(i);

                            const expectedT = '+12109999999';

                            await nb.updateRecipient({
                              i,
                              t: expectedT
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].t).toBe(expectedT);
                            expect(notificationBox.r[0].i).toBe(i);
                          });

                          it('should add a valid uid to the target recipient', async () => {
                            let notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].t).toBe(t);
                            expect(notificationBox.r[0].i).toBe(i);
                            expect(notificationBox.r[0].uid).toBeUndefined();

                            const expectedT = '+12109999999';

                            await nb.updateRecipient({
                              i,
                              t: expectedT,
                              uid: u2.uid // set uid too
                            });

                            notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(1);
                            expect(notificationBox.r[0].t).toBe(expectedT);
                            expect(notificationBox.r[0].uid).toBe(u2.uid);
                            expect(notificationBox.r[0].i).toBe(i);
                          });

                          itShouldFail('to add a uid to the recipient if the target uid does not exist', async () => {
                            await expectFail(
                              () =>
                                nb.updateRecipient({
                                  uid: 'does_not_exist',
                                  insert: true
                                }),
                              jestExpectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                            );
                          });

                          it('should remove the recipient from the notification box', async () => {
                            await nb.updateRecipient({
                              i,
                              remove: true
                            });

                            const notificationBox = await assertSnapshotData(nb.document);
                            expect(notificationBox.r).toHaveLength(0);
                          });
                        });
                      });
                    });
                  });

                  // TODO: describe sending notifications with set settings
                }
              );
            });
          });

          describe('Notification', () => {
            function describeNotificationCreateAndSendTestsWithNotificationBox(initialNotificationBoxExists: boolean, initialNotificationBoxInitialized: boolean) {
              demoNotificationBoxContext({ f, for: p, createIfNeeded: initialNotificationBoxExists, initIfNeeded: initialNotificationBoxInitialized }, (nb) => {
                describe('notification created', () => {
                  let notificationDocument: NotificationDocument;

                  function initNotification(sendType: NotificationSendType, loadParams?: () => Partial<CreateNotificationTemplate>) {
                    beforeEach(async () => {
                      const partialParams = await loadParams?.();

                      const baseTemplate = exampleNotificationTemplate({
                        profileDocument: p.document
                      });

                      const template: CreateNotificationTemplate = {
                        ...baseTemplate,
                        ...partialParams,
                        st: sendType
                      };

                      const result = await createNotificationDocument({
                        template,
                        accessor: f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessor()
                      });

                      notificationDocument = result.notificationDocument;
                    });
                  }

                  describe('unknown notification type', () => {
                    describe('sendType=INIT_BOX_AND_SEND', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND, () => {
                        const template = exampleNotificationTemplate({
                          profileDocument: p.document
                        });

                        template.n.t = 'UNKNOWN_TYPE';

                        return template;
                      });
                      demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                        describe('via sendQueuedNotifications()', () => {
                          it('should have tried but not sent the queued notification.', async () => {
                            const result = await nbn.sendAllQueuedNotifications();
                            expect(result.notificationsVisited).toBe(1);
                            expect(result.notificationsFailed).toBe(1);
                            expect(result.notificationsDeleted).toBe(0);
                          });
                        });

                        describe('via sendNotification()', () => {
                          it('should not have created a NotificationBox and increased the try send count by one', async () => {
                            let notificationBoxExists = await nb.document.exists();
                            expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                            const result = await nbn.sendNotification();

                            expect(result.tryRun).toBe(false);
                            expect(result.success).toBe(false);
                            expect(result.deletedNotification).toBe(false);

                            // check still does not exist
                            notificationBoxExists = await nb.document.exists();
                            expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                            // check notification changes
                            const notification = await assertSnapshotData(nbn.document);

                            expect(notification.a).toBe(1); // send count increases by one
                            expect(isFuture(notification.sat)).toBe(true);
                          });

                          describe('send count is at maximum tries', () => {
                            beforeEach(async () => {
                              await nbn.document.update({ a: UNKNOWN_NOTIFICATION_TEMPLATE_TYPE_DELETE_AFTER_RETRY_ATTEMPTS });
                            });

                            it('should have tried but and deleted the queued notification.', async () => {
                              const result = await nbn.sendAllQueuedNotifications();
                              expect(result.notificationsVisited).toBe(1);
                              expect(result.notificationsFailed).toBe(1);
                              expect(result.notificationsDeleted).toBe(1);
                            });

                            it('should not have created a NotificationBox and deleted the notification', async () => {
                              let notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                              const result = await nbn.sendNotification();

                              expect(result.tryRun).toBe(false);
                              expect(result.success).toBe(false);
                              expect(result.deletedNotification).toBe(true);

                              // check still does not exist
                              notificationBoxExists = await nb.document.exists();
                              expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                              // check notification changes
                              const notificationExists = await nbn.document.exists();
                              expect(notificationExists).toBe(false); // send count increases by one
                            });
                          });
                        });
                      });
                    });
                  });

                  describe('known notification type', () => {
                    describe('sendType', () => {
                      describe('SEND_IF_BOX_EXISTS', () => {
                        initNotification(NotificationSendType.SEND_IF_BOX_EXISTS);
                        demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            if (initialNotificationBoxExists) {
                              describe('notification box exists', () => {
                                if (initialNotificationBoxInitialized) {
                                  describe('notification box initialized', () => {
                                    it('should have sent the notification', async () => {
                                      let notificationBoxExists = await nb.document.exists();
                                      expect(notificationBoxExists).toBe(true);

                                      const result = await nbn.sendNotification();

                                      expect(result.tryRun).toBe(true);
                                      expect(result.success).toBe(true);
                                      expect(result.deletedNotification).toBe(false);

                                      // check still does not exist
                                      notificationBoxExists = await nb.document.exists();
                                      expect(notificationBoxExists).toBe(true);
                                    });
                                  });
                                } else {
                                  describe('notification box not initialized', () => {
                                    it('should not have sent the notification but also not deleted the notification', async () => {
                                      let notificationBoxExists = await nb.document.exists();
                                      expect(notificationBoxExists).toBe(true);

                                      const result = await nbn.sendNotification();

                                      expect(result.tryRun).toBe(false);
                                      expect(result.success).toBe(false);
                                      expect(result.deletedNotification).toBe(false);

                                      // check still does not exist
                                      notificationBoxExists = await nb.document.exists();
                                      expect(notificationBoxExists).toBe(true);
                                    });
                                  });
                                }
                              });
                            } else {
                              describe('notification box does not exist', () => {
                                it('should not have sent and should have deleted the notification', async () => {
                                  let notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(false);

                                  const result = await nbn.sendNotification();

                                  expect(result.tryRun).toBe(false);
                                  expect(result.success).toBe(true);
                                  expect(result.deletedNotification).toBe(true);

                                  // check still does not exist
                                  notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(false);
                                });
                              });
                            }
                          });
                        });
                      });

                      describe('INIT_BOX_AND_SEND', () => {
                        initNotification(NotificationSendType.INIT_BOX_AND_SEND);

                        demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            if (initialNotificationBoxExists) {
                              describe('notification box exists', () => {
                                if (initialNotificationBoxInitialized) {
                                  describe('NotificationBox is flagged initialized', () => {
                                    demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                                      it('should have sent the notification', async () => {
                                        const notificationBox = await assertSnapshotData(nb.document);
                                        expect(notificationBox.s).toBeUndefined(); // initialized

                                        const result = await nbn.sendNotification();

                                        expect(result.tryRun).toBe(true);
                                        expect(result.success).toBe(true);
                                        expect(result.deletedNotification).toBe(false);

                                        // no email recipients for the notification
                                        expect(result.sendEmailsResult).toBeUndefined();

                                        // check update
                                        const notification = await assertSnapshotData(nbn.document);
                                        expect(notification.d).toBe(true); // complete and marked for deletion
                                      });
                                    });
                                  });
                                } else {
                                  describe('NotificationBox is not flagged as initialized', () => {
                                    demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, () => {
                                      it('should not have sent the notification since the box is not initialized', async () => {
                                        let notificationBox = await assertSnapshotData(nb.document);
                                        expect(notificationBox.s).toBe(true); // needs to be sync'd

                                        const result = await nbn.sendNotification();

                                        expect(result.tryRun).toBe(false);
                                        expect(result.success).toBe(false);
                                        expect(result.deletedNotification).toBe(false);
                                        expect(result.sendEmailsResult).toBeUndefined();

                                        // check not sent
                                        const notification = await assertSnapshotData(nbn.document);
                                        expect(notification.d).toBe(false);

                                        notificationBox = await assertSnapshotData(nb.document);
                                        expect(notificationBox.s).toBe(true); // still needs to be sync'd
                                      });
                                    });
                                  });
                                }
                              });
                            } else {
                              describe('notification box does not exist', () => {
                                it('should have created the NotificationBox', async () => {
                                  let notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                                  const result = await nbn.sendNotification();

                                  expect(result.tryRun).toBe(false);
                                  expect(result.success).toBe(false);
                                  expect(result.deletedNotification).toBe(false);
                                  expect(result.createdBox).toBe(true);

                                  // check exists
                                  notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(true);

                                  const notificationBox = await assertSnapshotData(nb.document);
                                  expect(notificationBox.s).toBe(true); // needs to be sync'd
                                });

                                it('should not have sent the notification since the box is not initialized', async () => {
                                  const result = await nbn.sendNotification();

                                  expect(result.tryRun).toBe(false);
                                  expect(result.success).toBe(false);
                                  expect(result.deletedNotification).toBe(false);
                                  expect(result.sendEmailsResult).toBeUndefined();

                                  // check update
                                  const notification = await assertSnapshotData(nbn.document);
                                  expect(notification.d).toBe(false);
                                });
                              });
                            }
                          });
                        });
                      });

                      describe('SEND_WITHOUT_CREATING_BOX', () => {
                        initNotification(NotificationSendType.SEND_WITHOUT_CREATING_BOX);

                        demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                          describe('send', () => {
                            if (initialNotificationBoxExists) {
                              describe('notification box exists', () => {
                                if (initialNotificationBoxInitialized) {
                                  it('should have sent the notifixcation', async () => {
                                    let notificationBoxExists = await nb.document.exists();
                                    expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                                    const result = await nbn.sendNotification();

                                    expect(result.tryRun).toBe(true);
                                    expect(result.success).toBe(true);
                                    expect(result.deletedNotification).toBe(false);

                                    // check still does not exist
                                    notificationBoxExists = await nb.document.exists();
                                    expect(notificationBoxExists).toBe(initialNotificationBoxExists);
                                  });
                                } else {
                                  it('should not send the notification until the notification box is initialized', async () => {
                                    let notificationBoxExists = await nb.document.exists();
                                    expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                                    const result = await nbn.sendNotification();

                                    expect(result.tryRun).toBe(false);
                                    expect(result.success).toBe(false);
                                    expect(result.deletedNotification).toBe(false);

                                    // check still does not exist
                                    notificationBoxExists = await nb.document.exists();
                                    expect(notificationBoxExists).toBe(initialNotificationBoxExists);
                                  });
                                }
                              });
                            } else {
                              describe('notification box does not exist', () => {
                                it('should have sent without creating the NotificationBox', async () => {
                                  let notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(initialNotificationBoxExists);

                                  const result = await nbn.sendNotification();

                                  expect(result.tryRun).toBe(true);
                                  expect(result.success).toBe(true);
                                  expect(result.deletedNotification).toBe(false);

                                  // check still does not exist
                                  notificationBoxExists = await nb.document.exists();
                                  expect(notificationBoxExists).toBe(initialNotificationBoxExists);
                                });
                              });
                            }
                          });
                        });
                      });
                    });

                    describe('multiple notifications', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);

                      demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                        it('should queue up multiple notifications', async () => {
                          const result = await nb.loadAllNotificationsForNotificationBox();
                          expect(result.length).toBe(3);
                        });
                      });
                    });

                    describe('Notifications partially sent (email success)', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                        demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                          beforeEach(async () => {
                            await nbn.sendNotification();
                          });

                          describe('attempting to send too early', () => {
                            beforeEach(async () => {
                              // mark as not done and queued
                              await nbn.document.update({
                                d: false,
                                ts: NotificationSendState.QUEUED,
                                sat: addMinutes(new Date(), 1) // cannot send for another minute
                              });
                            });

                            it('should not attempt to be sent via send all', async () => {
                              const result = await nbn.sendAllQueuedNotifications();
                              expect(result.notificationsVisited).toBe(0);
                            });

                            it('should not attempt to send again (send throttling)', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.sendEmailsResult).toBeUndefined(); // not attempted
                              expect(result.tryRun).toBe(false);
                              expect(result.success).toBe(false);
                            });
                          });

                          describe('texts not sent', () => {
                            beforeEach(async () => {
                              // mark as not done and queued
                              await nbn.document.update({ sat: new Date(), d: false, ts: NotificationSendState.QUEUED });
                            });

                            it('should attempt to send the text notifications again', async () => {
                              const result = await nbn.sendNotification();

                              expect(result.sendEmailsResult).toBeUndefined(); // not attempted
                              expect(result.tryRun).toBe(true);
                              expect(result.success).toBe(true);
                            });
                          });
                        });
                      });
                    });

                    describe('Notification Sent', () => {
                      initNotification(NotificationSendType.INIT_BOX_AND_SEND);
                      demoNotificationContext({ f, doc: () => notificationDocument }, (nbn) => {
                        demoNotificationBoxContext({ f, for: p, initIfNeeded: true }, () => {
                          describe('cleanupSentNotificationsFactory()', () => {
                            it('should not clean up the unsent notification', async () => {
                              let allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                              expect(allExistingNotifications.length).toBe(1);

                              await nbn.cleanupAllSentNotifications();

                              allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                              expect(allExistingNotifications.length).toBe(1);
                            });

                            describe('notification sent/done', () => {
                              beforeEach(async () => {
                                // mark as sent/done
                                await nbn.document.update({ d: true });
                              });

                              it('should clean up the sent notification', async () => {
                                let allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                                expect(allExistingNotifications.length).toBe(1);

                                let allExistingNotificationWeeks = await nb.loadAllNotificationWeeksForNotificationBox();
                                expect(allExistingNotificationWeeks.length).toBe(0);

                                const result = await nbn.cleanupAllSentNotifications();
                                expect(result.notificationBoxesUpdatesCount).toBe(1);
                                expect(result.notificationsDeleted).toBe(1);
                                expect(result.notificationWeeksCreated).toBe(1);
                                expect(result.notificationWeeksUpdated).toBe(0);

                                allExistingNotifications = await nb.loadAllNotificationsForNotificationBox();
                                expect(allExistingNotifications.length).toBe(0);

                                allExistingNotificationWeeks = await nb.loadAllNotificationWeeksForNotificationBox();
                                expect(allExistingNotificationWeeks.length).toBe(1);
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            }

            describe('notification box exists', () => {
              describe('is initialized', () => {
                describeNotificationCreateAndSendTestsWithNotificationBox(true, true);
              });

              describe('is not initialized', () => {
                describeNotificationCreateAndSendTestsWithNotificationBox(true, false);
              });
            });

            describe('notification box does not exist', () => {
              describeNotificationCreateAndSendTestsWithNotificationBox(false, false);
            });
          });
        });
      });
    });
  });
});
