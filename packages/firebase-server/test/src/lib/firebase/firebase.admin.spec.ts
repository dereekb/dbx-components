import { firebaseAdminFirestoreContextWithFixture, firebaseAdminTestContextFactory } from './firebase.admin';
import { describeFirestoreTest, initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';

describe('firebaseAdminTestContextFactory()', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminTestContextFactory((f) => {
    describe('context test', () => {
      it('should create a context.', () => {
        expect(f.instance).toBeDefined();
      });
    });

    // Example of only using the firestore fixture
    firebaseAdminFirestoreContextWithFixture(f, (s) => {
      describeFirestoreTest(s);
    });
  });
});
