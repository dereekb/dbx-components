import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { type Notification, type DocumentDataWithIdAndKey, onCallUpdateModelParams, NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE, type CreateNotificationTemplate, NotificationSendType, NotificationSendState, createNotificationDocument, createNotificationLoggedEventTemplate, notificationLoggedEventDayId } from '@dereekb/firebase';
import { EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, exampleNotificationTemplate, guestbookIdentity, type SubscribeToGuestbookNotificationsParams } from 'demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.scenario', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      describe('profile', () => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationBoxContext({ f, for: p, createIfNeeded: true }, (profileNb) => {
            it('should initialize the notification box for the profile.', async () => {
              await profileNb.initializeNotificationBox();

              const notificationBox = await assertSnapshotData(profileNb.document);
              expect(notificationBox.s).toBeUndefined(); // is now synced/initialized

              const recipients = notificationBox.r;
              const recipient = recipients[0];

              expect(recipients.length).toBe(1);
              expect(recipient.uid).toBe(u.uid); // added user as recipient automatically
            });
          });
        });
      });

      describe('guestbook', () => {
        demoGuestbookContext({ f, published: true }, (g) => {
          demoNotificationBoxContext({ f, for: g, createIfNeeded: true }, (guestbookNb) => {
            it('should initialized the notification box for the guestbook', async () => {
              await guestbookNb.initializeNotificationBox();

              const notificationBox = await assertSnapshotData(guestbookNb.document);
              expect(notificationBox.s).toBeUndefined(); // is now synced/initialized

              const recipients = notificationBox.r;
              expect(recipients.length).toBe(0);
            });

            describe('adding notification recipient', () => {
              demoAuthorizedUserAdminContext({ f }, (au) => {
                describe('recipient exists', () => {
                  it('should add the user as a notiication recipient', async () => {
                    const params: SubscribeToGuestbookNotificationsParams = {
                      uid: u.uid,
                      key: g.documentKey
                    };

                    await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'subscribeToNotifications'));

                    const notificationBox = await assertSnapshotData(guestbookNb.document);

                    const recipients = notificationBox.r;
                    expect(recipients.length).toBe(1);
                    expect(recipients[0].uid).toBe(u.uid);
                  });
                });

                describe('recipient does not exist', () => {
                  itShouldFail('to add a user that does not exist as a recipient', async () => {
                    const params: SubscribeToGuestbookNotificationsParams = {
                      uid: 'doesnotexist',
                      key: g.documentKey
                    };

                    await expectFail(
                      () => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'subscribeToNotifications')),
                      // should throw NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE
                      expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_USER_INVALID_UID_FOR_CREATE_ERROR_CODE)
                    );
                  });
                });
              });
            });

            describe('guestbook entry created', () => {
              demoGuestbookEntryContext({ f, u, g, init: false }, (ge) => {
                it('should create a new notification when an entry is created', async () => {
                  expect(await ge.document.exists()).toBe(false);

                  let notifications = await guestbookNb.loadAllNotificationsForNotificationBox();
                  expect(notifications.length).toBe(0);

                  await ge.init();

                  notifications = await guestbookNb.loadAllNotificationsForNotificationBox();
                  expect(notifications.length).toBe(1);

                  const notification = notifications[0].data as DocumentDataWithIdAndKey<Notification>;
                  expect(notification.n.t).toBe(GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE);
                });
              });
            });
          });
        });
      });

      describe('invalid notification box model types', () => {
        demoGuestbookContext({ f, published: true }, (g) => {
          describe('guestbook entry', () => {
            demoGuestbookEntryContext({ f, u, g }, (ge) => {
              demoNotificationBoxContext({ f, for: ge, createIfNeeded: true }, (guestbookEntryNb) => {
                // NotificationBoxes that are not for a Guestbook entry or a
                it('should flag the guestbook entry NotificationBox as invalid when initialized', async () => {
                  await guestbookEntryNb.initializeNotificationBox();

                  const notificationBox = await assertSnapshotData(guestbookEntryNb.document);

                  expect(notificationBox.s).toBeFalsy();
                  expect(notificationBox.fi).toBe(true);
                });
              });
            });
          });
        });
      });

      describe('notification logged event', () => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationBoxContext({ f, for: p, createIfNeeded: true, initIfNeeded: true }, (nb) => {
            interface CreateLoggedEventInput {
              readonly at?: Date;
              readonly data?: Record<string, unknown>;
            }

            async function createLoggedEventNotification(input: CreateLoggedEventInput = {}) {
              const baseTemplate = exampleNotificationTemplate({
                profileDocument: p.document
              });

              const template: CreateNotificationTemplate = {
                ...baseTemplate,
                st: NotificationSendType.LOGGED_EVENT,
                sat: input.at,
                n: {
                  ...baseTemplate.n,
                  d: input.data ?? { workerId: 'w_001', delta: 1 }
                }
              };

              const result = await createNotificationDocument({
                template,
                accessor: f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessor()
              });

              return result.notificationDocument;
            }

            async function loadAllLoggedEventDays() {
              const dayCollection = f.demoFirestoreCollections.notificationLoggedEventDayCollectionFactory(nb.document);
              return dayCollection.queryDocument().getDocs();
            }

            async function loadAllLoggedEventItemsForDay(dayId: string) {
              const dayCollection = f.demoFirestoreCollections.notificationLoggedEventDayCollectionFactory(nb.document);
              const dayDocument = dayCollection.documentAccessor().loadDocumentForId(dayId);
              const pagedItems = f.demoFirestoreCollections.notificationLoggedEventDayPagedItemsCollectionFactory(dayDocument);
              return pagedItems.loadAllItems();
            }

            function loggedEventDayPagedItems(dayId: string) {
              const dayCollection = f.demoFirestoreCollections.notificationLoggedEventDayCollectionFactory(nb.document);
              const dayDocument = dayCollection.documentAccessor().loadDocumentForId(dayId);
              return f.demoFirestoreCollections.notificationLoggedEventDayPagedItemsCollectionFactory(dayDocument);
            }

            describe('createNotificationLoggedEventTemplate() helper', () => {
              it('should produce a template that archives end-to-end through cleanup', async () => {
                const eventData = { workerId: 'w_helper', kind: 'clockIn' };

                // public helper API; mirrors how downstream code is expected to record domain events
                const template = createNotificationLoggedEventTemplate({
                  type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                  notificationModel: p.document,
                  data: eventData
                });

                const { notificationDocument } = await createNotificationDocument({
                  template,
                  accessor: f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessor()
                });

                const data = await assertSnapshotData(notificationDocument);
                expect(data.st).toBe(NotificationSendType.LOGGED_EVENT);
                expect(data.d).toBe(true);
                expect(data.r).toEqual([]);
                expect(data.ts).toBe(NotificationSendState.NO_TRY);
                expect(data.es).toBe(NotificationSendState.NO_TRY);
                expect(data.ps).toBe(NotificationSendState.NO_TRY);
                expect(data.ns).toBe(NotificationSendState.NO_TRY);

                const expectedDayId = notificationLoggedEventDayId(data.sat);

                // logged events are invisible to the send loop
                const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
                const sendResult = await sendQueuedNotifications();
                expect(sendResult.notificationsVisited).toBe(0);

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                const cleanupResult = await cleanupSentNotifications();

                expect(cleanupResult.notificationLoggedEventsCleanedUp).toBe(1);
                expect(cleanupResult.notificationsDeleted).toBe(1);

                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);
                expect(days[0].id).toBe(expectedDayId);

                const items = await loadAllLoggedEventItemsForDay(expectedDayId);
                expect(items.length).toBe(1);
                expect(items[0].t).toBe(EXAMPLE_NOTIFICATION_TEMPLATE_TYPE);
                expect(items[0].d).toEqual(eventData);
              });

              it('should throw when notificationModel is missing', () => {
                expect(() =>
                  createNotificationLoggedEventTemplate({
                    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                    notificationModel: undefined as never,
                    data: { workerId: 'w_001' }
                  })
                ).toThrow('Must provide a notificationModel when creating a logged-event notification template.');
              });
            });

            describe('single-transaction fan-out', () => {
              it('should persist multiple logged events created from one Firestore transaction and archive them to the same day', async () => {
                // simulate a domain action that emits N events in one logical operation — the production pattern from guestbook.action.server.ts:125
                await f.demoFirestoreCollections.firestoreContext.runTransaction(async (transaction) => {
                  const accessorInTransaction = f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessorForTransaction(transaction);

                  const templates = [
                    createNotificationLoggedEventTemplate({
                      type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                      notificationModel: p.document,
                      data: { event: 'clockIn', workerId: 'w_001' }
                    }),
                    createNotificationLoggedEventTemplate({
                      type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                      notificationModel: p.document,
                      data: { event: 'taskStarted', workerId: 'w_001', taskId: 't_001' }
                    }),
                    createNotificationLoggedEventTemplate({
                      type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
                      notificationModel: p.document,
                      data: { event: 'breakStarted', workerId: 'w_001' }
                    })
                  ];

                  await Promise.all(
                    templates.map((template) =>
                      createNotificationDocument({
                        template,
                        transaction,
                        accessor: accessorInTransaction
                      })
                    )
                  );
                });

                // all three documents committed in one shot
                const created = await nb.loadAllNotificationsForNotificationBox();
                expect(created.length).toBe(3);

                created.forEach((pair) => {
                  const data = pair.data as Notification;
                  expect(data.st).toBe(NotificationSendType.LOGGED_EVENT);
                  expect(data.d).toBe(true);
                });

                const createdEvents = created.map((x) => ((x.data as Notification).n.d as { event: string }).event).sort();
                expect(createdEvents).toEqual(['breakStarted', 'clockIn', 'taskStarted']);

                // all three archive together — same sat ⇒ same day bucket
                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                const cleanupResult = await cleanupSentNotifications();

                expect(cleanupResult.notificationLoggedEventsCleanedUp).toBe(3);
                expect(cleanupResult.notificationsDeleted).toBe(3);

                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);

                const items = await loadAllLoggedEventItemsForDay(days[0].id);
                expect(items.length).toBe(3);

                const archivedEvents = items.map((x) => (x.d as { event: string }).event).sort();
                expect(archivedEvents).toEqual(['breakStarted', 'clockIn', 'taskStarted']);
              });
            });

            describe('page-level reads', () => {
              it('should expose the populated page index and per-page items after archival', async () => {
                const eventDataA = { tag: 'a', workerId: 'w_001' };
                const eventDataB = { tag: 'b', workerId: 'w_002' };
                const eventDataC = { tag: 'c', workerId: 'w_003' };

                await createLoggedEventNotification({ data: eventDataA });
                await createLoggedEventNotification({ data: eventDataB });
                await createLoggedEventNotification({ data: eventDataC });

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                await cleanupSentNotifications();

                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);

                const dayId = days[0].id;
                const pagedItems = loggedEventDayPagedItems(dayId);

                // index document reflects all archived items on a single page (default page size)
                const index = await pagedItems.loadIndex();
                expect(index).toBeDefined();
                expect(index?.tc).toBe(3);
                expect(index?.p).toEqual(['0']);
                expect(index?.pc).toEqual({ '0': 3 });
                expect(index?.u).toEqual(expect.any(Number));

                // reading items for the discovered page IDs round-trips the same data as loadAllItems
                const itemsForKnownPages = await pagedItems.loadItemsForPages(index?.p ?? []);
                const allItems = await pagedItems.loadAllItems();
                expect(itemsForKnownPages.length).toBe(3);
                expect(itemsForKnownPages).toEqual(allItems);

                const tags = itemsForKnownPages.map((x) => (x.d as { tag: string }).tag).sort();
                expect(tags).toEqual(['a', 'b', 'c']);

                // requesting unknown page IDs silently returns nothing (does not throw)
                const itemsForMissingPage = await pagedItems.loadItemsForPages(['9999']);
                expect(itemsForMissingPage).toEqual([]);
              });

              it('should return undefined index and empty items for a day that was never archived', async () => {
                const neverWrittenDayId = notificationLoggedEventDayId(new Date('2000-01-01T00:00:00.000Z'));
                const pagedItems = loggedEventDayPagedItems(neverWrittenDayId);

                const index = await pagedItems.loadIndex();
                expect(index).toBeUndefined();

                const allItems = await pagedItems.loadAllItems();
                expect(allItems).toEqual([]);

                const itemsForPages = await pagedItems.loadItemsForPages(['0']);
                expect(itemsForPages).toEqual([]);
              });
            });

            describe('arbitrary event data round-trip', () => {
              it('should preserve heterogeneous d payloads (flat / nested / arrays / null) through cleanup archival', async () => {
                const flatPayload = { workerId: 'w_001', delta: 1 };
                const nestedPayload = { kind: 'taskStarted', at: new Date('2025-04-15T12:00:00.000Z').toISOString() };
                const complexPayload = { nested: { a: 1, b: 'two' }, items: [1, 2, 3], flag: true, optional: null };

                await createLoggedEventNotification({ data: flatPayload });
                await createLoggedEventNotification({ data: nestedPayload });
                await createLoggedEventNotification({ data: complexPayload });

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                await cleanupSentNotifications();

                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);

                const items = await loadAllLoggedEventItemsForDay(days[0].id);
                expect(items.length).toBe(3);

                // firestorePassThroughField() should round-trip every JSON-compatible payload as-is
                const payloads = items.map((x) => x.d);
                expect(payloads).toContainEqual(flatPayload);
                expect(payloads).toContainEqual(nestedPayload);
                expect(payloads).toContainEqual(complexPayload);
              });
            });

            describe('multi-day archival', () => {
              it('should split logged events into separate day wrappers based on each event sat', async () => {
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setUTCDate(today.getUTCDate() - 1);
                const lastWeek = new Date(today);
                lastWeek.setUTCDate(today.getUTCDate() - 7);

                await createLoggedEventNotification({ at: today, data: { tag: 'today-a' } });
                await createLoggedEventNotification({ at: today, data: { tag: 'today-b' } });
                await createLoggedEventNotification({ at: yesterday, data: { tag: 'yesterday' } });
                await createLoggedEventNotification({ at: lastWeek, data: { tag: 'lastWeek' } });

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                const cleanupResult = await cleanupSentNotifications();

                expect(cleanupResult.notificationLoggedEventsCleanedUp).toBe(4);
                expect(cleanupResult.notificationsDeleted).toBe(4);
                // logged events should never produce NotificationWeek archives
                expect(cleanupResult.notificationWeeksCreated).toBe(0);
                expect(cleanupResult.notificationWeeksUpdated).toBe(0);

                const todayDayId = notificationLoggedEventDayId(today);
                const yesterdayDayId = notificationLoggedEventDayId(yesterday);
                const lastWeekDayId = notificationLoggedEventDayId(lastWeek);

                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(3);

                const dayIds = days.map((x) => x.id).sort();
                expect(dayIds).toEqual([todayDayId, yesterdayDayId, lastWeekDayId].sort());

                const todayItems = await loadAllLoggedEventItemsForDay(todayDayId);
                expect(todayItems.length).toBe(2);
                const todayTags = todayItems.map((x) => (x.d as { tag: string }).tag).sort();
                expect(todayTags).toEqual(['today-a', 'today-b']);

                const yesterdayItems = await loadAllLoggedEventItemsForDay(yesterdayDayId);
                expect(yesterdayItems.length).toBe(1);
                expect((yesterdayItems[0].d as { tag: string }).tag).toBe('yesterday');

                const lastWeekItems = await loadAllLoggedEventItemsForDay(lastWeekDayId);
                expect(lastWeekItems.length).toBe(1);
                expect((lastWeekItems[0].d as { tag: string }).tag).toBe('lastWeek');

                // source notifications all consumed
                const remaining = await nb.loadAllNotificationsForNotificationBox();
                expect(remaining.length).toBe(0);
              });
            });

            describe('retention boundary', () => {
              it('should preserve days inside the retention window while purging older days', async () => {
                const recent = new Date();
                recent.setUTCDate(recent.getUTCDate() - 5);
                const old = new Date();
                old.setUTCDate(old.getUTCDate() - 100);

                await createLoggedEventNotification({ at: recent, data: { tag: 'recent' } });
                await createLoggedEventNotification({ at: old, data: { tag: 'old' } });

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                await cleanupSentNotifications();

                const recentDayId = notificationLoggedEventDayId(recent);
                const oldDayId = notificationLoggedEventDayId(old);

                let days = await loadAllLoggedEventDays();
                expect(days.length).toBe(2);

                const cleanupOldDays = await f.notificationServerActions.cleanupOldNotificationLoggedEventDays({ retentionDays: 30 });
                const result = await cleanupOldDays();

                expect(result.daysDeleted).toBe(1);
                expect(result.pagesDeleted).toBeGreaterThanOrEqual(1);

                days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);
                expect(days[0].id).toBe(recentDayId);

                // recent day's items remain intact
                const recentItems = await loadAllLoggedEventItemsForDay(recentDayId);
                expect(recentItems.length).toBe(1);
                expect((recentItems[0].d as { tag: string }).tag).toBe('recent');

                // old day's paged items are gone
                const oldItems = await loadAllLoggedEventItemsForDay(oldDayId);
                expect(oldItems.length).toBe(0);
              });
            });

            describe('mixed cleanup with normal notifications', () => {
              it('should route normal notifications to NotificationWeek and logged events to NotificationLoggedEventDay in the same cleanup pass', async () => {
                // logged event is born d=true so it is immediately eligible for cleanup
                await createLoggedEventNotification({ data: { tag: 'logged' } });

                // normal notification — create then mark done so cleanup picks it up alongside the logged event
                const normalTemplate: CreateNotificationTemplate = {
                  ...exampleNotificationTemplate({ profileDocument: p.document }),
                  st: NotificationSendType.SEND_IF_BOX_EXISTS
                };
                const normalCreate = await createNotificationDocument({
                  template: normalTemplate,
                  accessor: f.demoFirestoreCollections.notificationCollectionFactory(nb.document).documentAccessor()
                });
                await normalCreate.notificationDocument.update({ d: true });

                const beforeCleanup = await nb.loadAllNotificationsForNotificationBox();
                expect(beforeCleanup.length).toBe(2);

                const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
                const cleanupResult = await cleanupSentNotifications();

                // 2 source documents removed: 1 archived to week, 1 archived to day
                expect(cleanupResult.notificationsDeleted).toBe(2);
                expect(cleanupResult.notificationLoggedEventsCleanedUp).toBe(1);
                expect(cleanupResult.notificationWeeksCreated).toBe(1);
                expect(cleanupResult.notificationWeeksUpdated).toBe(0);

                const remaining = await nb.loadAllNotificationsForNotificationBox();
                expect(remaining.length).toBe(0);

                // logged event landed in the day archive only
                const days = await loadAllLoggedEventDays();
                expect(days.length).toBe(1);
                const dayItems = await loadAllLoggedEventItemsForDay(days[0].id);
                expect(dayItems.length).toBe(1);
                expect((dayItems[0].d as { tag: string }).tag).toBe('logged');

                // normal notification landed in the week archive only
                const weeks = await nb.loadAllNotificationWeeksForNotificationBox();
                expect(weeks.length).toBe(1);
                const weekData = weeks[0].data as DocumentDataWithIdAndKey<{ n: Notification['n'][] }>;
                expect(weekData.n.length).toBe(1);
                expect(weekData.n[0].t).toBe(EXAMPLE_NOTIFICATION_TEMPLATE_TYPE);
              });
            });
          });
        });
      });
    });
  });
});
