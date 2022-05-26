import { Module } from '@nestjs/common';
import { firebaseAdminFirestoreContextWithFixture } from './firebase.admin';
import { setupFirebaseAdminFunctionTestSingleton } from './firebase.admin.function';
import { firebaseAdminFunctionNestContextFactory } from './firebase.admin.nest.function';
import { describeFirestoreTest, initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';

export class TestThing {}

@Module({
  providers: [
    {
      provide: TestThing,
      useFactory: () => new TestThing()
    }
  ]
})
export class AppModule {}

export const firebaseAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({ nestModules: AppModule });

describe('firebaseAdminFunctionNestContext', () => {
  initFirebaseServerAdminTestEnvironment();
  setupFirebaseAdminFunctionTestSingleton();

  firebaseAdminFunctionNestContext((f) => {
    describe('nest', () => {
      it('should have initialized the nest module.', () => {
        const thing = f.instance.get(TestThing);
        expect(thing).toBeDefined();
      });
    });

    // Example of only using the firestore fixture
    firebaseAdminFirestoreContextWithFixture(f.parent, (s) => {
      describeFirestoreTest(s);
    });
  });
});
