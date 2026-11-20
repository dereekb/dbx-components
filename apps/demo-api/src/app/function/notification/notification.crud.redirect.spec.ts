import { addDays, addMinutes } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoNotificationBoxContext } from '../../../test/fixture';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { notificationShortLinkFactory } from '@dereekb/firebase-server/model';
import { DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS, firestoreModelKey, isNotificationRedirectEntryId, notificationRedirectEntryIdPrefix } from '@dereekb/firebase';
import { DEMO_GUESTBOOK_ENTRY_NOTIFICATION_REDIRECT_ENTRY_PREFIX, DEMO_GUESTBOOK_NOTIFICATION_REDIRECT_ENTRY_PREFIX, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, profileIdentity } from 'demo-firebase';

const BASE_URL = 'https://example.com/demo/app/s';

demoApiFunctionContextFactory((f) => {
  describe('notification.crud.redirect', () => {
    function makeShortLinks() {
      return notificationShortLinkFactory({
        notificationRedirectEntryCollection: f.demoFirestoreCollections.notificationRedirectEntryCollection,
        baseUrl: BASE_URL,
        ownershipKeyForUid: (uid) => firestoreModelKey(profileIdentity, uid)
      });
    }

    describe('notificationShortLinkFactory()', () => {
      it('should create an entry and return its short link', async () => {
        const now = new Date();
        const shortLinks = makeShortLinks();
        const result = await shortLinks({ prefix: 'j', m: 'gb/abc', now });

        expect(isNotificationRedirectEntryId(result.id)).toBe(true);
        expect(notificationRedirectEntryIdPrefix(result.id)).toBe('j');
        expect(result.url).toBe(`${BASE_URL}/${result.id}`);

        const entry = await assertSnapshotData(result.document);
        expect(entry.m).toBe('gb/abc');
        expect(entry.o).toBeFalsy();
        expect(entry.xat).toEqual(addDays(now, DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS));
      });

      it('should make the recipient the owner', async () => {
        const result = await makeShortLinks()({ uid: 'abc' });
        const entry = await assertSnapshotData(result.document);
        expect(entry.o).toBe(firestoreModelKey(profileIdentity, 'abc'));
      });

      it('should prefer an explicit owner over the uid', async () => {
        const result = await makeShortLinks()({ uid: 'abc', o: 'pr/other' });
        const entry = await assertSnapshotData(result.document);
        expect(entry.o).toBe('pr/other');
      });

      it('should throw when given a uid without ownershipKeyForUid', async () => {
        const shortLinks = notificationShortLinkFactory({ notificationRedirectEntryCollection: f.demoFirestoreCollections.notificationRedirectEntryCollection, baseUrl: BASE_URL });
        await expect(shortLinks({ uid: 'abc' })).rejects.toThrow();
      });

      it('should build the url for an existing id', () => {
        expect(makeShortLinks().urlForId('gb-a8Kd02Lm')).toBe(`${BASE_URL}/gb-a8Kd02Lm`);
      });
    });

    describe('cleanupSentNotifications()', () => {
      it('should delete expired entries and keep live ones', async () => {
        const now = new Date();
        const shortLinks = makeShortLinks();
        const expired = await shortLinks({ xat: addMinutes(now, -1), now: addDays(now, -1) });
        const live = await shortLinks({ xat: addDays(now, 1) });

        const cleanupSentNotifications = await f.notificationServerActions.cleanupSentNotifications({});
        const result = await cleanupSentNotifications();

        expect(result.notificationRedirectEntriesDeleted).toBe(1);
        expect(await expired.document.exists()).toBe(false);
        expect(await live.document.exists()).toBe(true);
      });
    });

    describe('created with a notification', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoGuestbookContext({ f, published: true }, (g) => {
          demoNotificationBoxContext({ f, for: g }, (nb) => {
            describe('guestbook entry created', () => {
              demoGuestbookEntryContext({ f, u, g, published: true }, () => {
                it('should create a shared entry for the guestbook and store its id on the notification item', async () => {
                  const notifications = await nb.loadAllNotificationsForNotificationBox();
                  const created = notifications.find((x) => x.data?.n.t === GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE)?.data;
                  const entryId = created?.n.l;

                  expect(entryId).toBeDefined();
                  expect(notificationRedirectEntryIdPrefix(entryId)).toBe(DEMO_GUESTBOOK_NOTIFICATION_REDIRECT_ENTRY_PREFIX);

                  const entry = await assertSnapshotData(f.demoFirestoreCollections.notificationRedirectEntryCollection.documentAccessor().loadDocumentForId(entryId as string));
                  expect(entry.m).toBe(g.documentKey);
                  expect(entry.o).toBeFalsy();
                });
              });
            });

            describe('guestbook entry liked', () => {
              demoGuestbookEntryContext({ f, u, g, published: true }, (e) => {
                it("should create an entry owned by the entry's creator that opens the entry", async () => {
                  await e.like();

                  const notifications = await nb.loadAllNotificationsForNotificationBox();
                  const liked = notifications.find((x) => x.data?.n.t === GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE)?.data;
                  const entryId = liked?.n.l;

                  expect(entryId).toBeDefined();
                  expect(notificationRedirectEntryIdPrefix(entryId)).toBe(DEMO_GUESTBOOK_ENTRY_NOTIFICATION_REDIRECT_ENTRY_PREFIX);

                  const entry = await assertSnapshotData(f.demoFirestoreCollections.notificationRedirectEntryCollection.documentAccessor().loadDocumentForId(entryId as string));
                  expect(entry.m).toBe(e.documentKey);
                  expect(entry.o).toBe(firestoreModelKey(profileIdentity, u.uid));
                });
              });
            });
          });
        });
      });
    });
  });
});
