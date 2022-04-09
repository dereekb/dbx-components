import { firebaseAdminFirestoreContextWithFixture, firebaseAdminFunctionTestContextFactory, setupFirebaseAdminFunctionTestSingleton } from './firebase.admin';
import { describeFirestoreTest, initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';

describe('firebaseAdminFunctionContext', () => {

  initFirebaseServerAdminTestEnvironment();
  setupFirebaseAdminFunctionTestSingleton();

  // TODO: Test singleton mode vs non-singleton mode.

  firebaseAdminFunctionTestContextFactory((f) => {

    // Example of only using the firestore fixture
    firebaseAdminFirestoreContextWithFixture(f, (s) => {

      describeFirestoreTest(s);

    });

  });

});
