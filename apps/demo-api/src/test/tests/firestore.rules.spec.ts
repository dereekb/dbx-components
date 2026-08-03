import { assertFails, assertSucceeds, firestoreRulesTestBuilder, readFirestoreRulesFile } from '@dereekb/firebase/test';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

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
  });
});
