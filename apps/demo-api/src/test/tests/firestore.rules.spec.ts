import { assertFails, assertSucceeds, firestoreRulesTestBuilder, readFirestoreRulesFile } from '@dereekb/firebase/test';
import { collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const OWNER_UID = 'rulestestowner';
const OTHER_UID = 'rulestestother';

const rulesTest = firestoreRulesTestBuilder({
  projectId: 'demo-api-firestore-rules-test',
  // resolve from this module, not process.cwd(): vitest sets root to the project directory.
  rules: readFirestoreRulesFile({ from: import.meta.url })
});

describe('firestore.rules', () => {
  rulesTest((f) => {
    describe('uec (UserExternalConnection)', () => {
      beforeEach(async () => {
        await f.withSecurityRulesDisabled(async (firestore) => {
          await setDoc(doc(firestore, 'uec', OWNER_UID), { uid: OWNER_UID, e: {}, c: ['calcom'], uat: new Date() });
          await setDoc(doc(firestore, 'uec', OTHER_UID), { uid: OTHER_UID, e: {}, c: [], uat: new Date() });
        });
      });

      it('should allow the owner to read their own document', async () => {
        await assertSucceeds(getDoc(doc(f.firestoreForUser(OWNER_UID), 'uec', OWNER_UID)));
      });

      it('should allow the owner to read when they have no document yet', async () => {
        // resourceIsOwnedByAuthUserId() would deny this: it requires resource != null, and a user who
        // has connected nothing has no document. The path-variable form is what makes this succeed.
        await assertSucceeds(getDoc(doc(f.firestoreForUser('rulestestneverconnected'), 'uec', 'rulestestneverconnected')));
      });

      it("should deny reading another user's document", async () => {
        await assertFails(getDoc(doc(f.firestoreForUser(OTHER_UID), 'uec', OWNER_UID)));
      });

      it('should deny an unauthenticated read', async () => {
        await assertFails(getDoc(doc(f.unauthenticatedFirestore(), 'uec', OWNER_UID)));
      });

      it('should deny listing/querying the collection', async () => {
        await assertFails(getDocs(query(collection(f.firestoreForUser(OWNER_UID), 'uec'), where('c', 'array-contains', 'calcom'))));
      });

      it('should deny the owner writing their own document', async () => {
        await assertFails(setDoc(doc(f.firestoreForUser(OWNER_UID), 'uec', OWNER_UID), { c: ['calcom'] }));
      });
    });

    describe('uecp (UserExternalConnectionPrivate)', () => {
      beforeEach(async () => {
        await f.withSecurityRulesDisabled(async (firestore) => {
          await setDoc(doc(firestore, 'uecp', OWNER_UID), { uid: OWNER_UID, cr: 'encrypted', uat: new Date() });
        });
      });

      // There is deliberately NO match block for /uecp. Firestore rules do not cascade, so the root
      // catch-all denies every client. These assertions are what keeps that true.
      it('should deny the owner reading their own private document', async () => {
        await assertFails(getDoc(doc(f.firestoreForUser(OWNER_UID), 'uecp', OWNER_UID)));
      });

      it('should deny an unauthenticated read of the private document', async () => {
        await assertFails(getDoc(doc(f.unauthenticatedFirestore(), 'uecp', OWNER_UID)));
      });

      it('should deny listing/querying the private collection', async () => {
        await assertFails(getDocs(collection(f.firestoreForUser(OWNER_UID), 'uecp')));
      });

      it('should deny the owner writing their own private document', async () => {
        await assertFails(setDoc(doc(f.firestoreForUser(OWNER_UID), 'uecp', OWNER_UID), { cr: 'tampered' }));
      });

      it('should deny an unauthenticated write of the private document', async () => {
        await assertFails(setDoc(doc(f.unauthenticatedFirestore(), 'uecp', OWNER_UID), { cr: 'tampered' }));
      });
    });

    describe('sys (SystemState)', () => {
      const SYSTEM_STATE_TYPE = 'examplestate';

      beforeEach(async () => {
        await f.withSecurityRulesDisabled(async (firestore) => {
          await setDoc(doc(firestore, 'sys', SYSTEM_STATE_TYPE), { data: { example: true } });
        });
      });

      // SystemState is read/written server-side through the callable model services, which gate it
      // on sys-admin. There is no match block, so direct client access is denied.
      it('should deny an authenticated read', async () => {
        await assertFails(getDoc(doc(f.firestoreForUser(OWNER_UID), 'sys', SYSTEM_STATE_TYPE)));
      });

      it('should deny an unauthenticated read', async () => {
        await assertFails(getDoc(doc(f.unauthenticatedFirestore(), 'sys', SYSTEM_STATE_TYPE)));
      });

      it('should deny listing/querying the collection', async () => {
        await assertFails(getDocs(collection(f.firestoreForUser(OWNER_UID), 'sys')));
      });

      it('should deny an authenticated write', async () => {
        await assertFails(setDoc(doc(f.firestoreForUser(OWNER_UID), 'sys', SYSTEM_STATE_TYPE), { data: { example: false } }));
      });
    });

    describe('sysp (SystemStatePrivate)', () => {
      const SYSTEM_STATE_TYPE = 'zoho_access_token';

      beforeEach(async () => {
        await f.withSecurityRulesDisabled(async (firestore) => {
          await setDoc(doc(firestore, 'sysp', SYSTEM_STATE_TYPE), { data: { tokens: [], lat: new Date() } });
        });
      });

      // There is deliberately NO match block for /sysp. It holds secrets encrypted at rest and has
      // no client story at all. These assertions are what keeps the default-deny true.
      it('should deny an authenticated read of the private document', async () => {
        await assertFails(getDoc(doc(f.firestoreForUser(OWNER_UID), 'sysp', SYSTEM_STATE_TYPE)));
      });

      it('should deny an unauthenticated read of the private document', async () => {
        await assertFails(getDoc(doc(f.unauthenticatedFirestore(), 'sysp', SYSTEM_STATE_TYPE)));
      });

      it('should deny listing/querying the private collection', async () => {
        await assertFails(getDocs(collection(f.firestoreForUser(OWNER_UID), 'sysp')));
      });

      it('should deny an authenticated write of the private document', async () => {
        await assertFails(setDoc(doc(f.firestoreForUser(OWNER_UID), 'sysp', SYSTEM_STATE_TYPE), { data: { tampered: true } }));
      });

      it('should deny an unauthenticated write of the private document', async () => {
        await assertFails(setDoc(doc(f.unauthenticatedFirestore(), 'sysp', SYSTEM_STATE_TYPE), { data: { tampered: true } }));
      });
    });

    /**
     * The DYNAMIC oracle for the CLI query catalog's `reachability` verdict.
     *
     * `scanFirestoreRules()` reports `collectionGroup: true` only for a collection carrying a
     * `/{path=**}/<collection>/{id}` block, and the query-manifest generator turns that into a
     * refusal a `COLLECTION_GROUP`-scope entry is answered with locally. That refusal is only
     * correct if a path-scoped `match` genuinely does NOT authorize a collection-group query — a
     * claim the static scanner asserts and only the real rules engine can settle.
     *
     * The `gb` / `gbe` pair is the whole matrix: both are listable on their own path, and only
     * `gbe` declares the collection-group block.
     */
    describe('collection group queries', () => {
      const GUESTBOOK_ID = 'rulestestguestbook';

      beforeEach(async () => {
        await f.withSecurityRulesDisabled(async (firestore) => {
          await setDoc(doc(firestore, 'gb', GUESTBOOK_ID), { published: true });
          await setDoc(doc(firestore, 'gb', GUESTBOOK_ID, 'gbe', 'rulestestentry'), { published: true });
        });
      });

      it('should allow a path-scoped list of the root collection', async () => {
        await assertSucceeds(getDocs(query(collection(f.firestoreForUser(OWNER_UID), 'gb'), where('published', '==', true))));
      });

      it('should deny a collection group query over a collection with no {path=**} block', async () => {
        // `gb` is listable at `/gb/{guestbook}` and nowhere declares `/{path=**}/gb/{id}`. This is
        // the assertion the CLI's `unreachable` / `parent-only` verdicts rest on: a path-scoped
        // grant, however permissive, does not carry over to the collection group.
        await assertFails(getDocs(query(collectionGroup(f.firestoreForUser(OWNER_UID), 'gb'), where('published', '==', true))));
      });

      it('should allow a path-scoped list of the nested collection', async () => {
        await assertSucceeds(getDocs(query(collection(f.firestoreForUser(OWNER_UID), 'gb', GUESTBOOK_ID, 'gbe'), where('published', '==', true))));
      });

      it('should allow a collection group query over a collection that declares {path=**}', async () => {
        // the contrast case: `gbe` carries `match /{path=**}/gbe/{guestbookEntry}`, so the scanner
        // reports `collectionGroup: true` and the CLI runs the entry without a --parent
        await assertSucceeds(getDocs(query(collectionGroup(f.firestoreForUser(OWNER_UID), 'gbe'), where('published', '==', true))));
      });
    });
  });
});
