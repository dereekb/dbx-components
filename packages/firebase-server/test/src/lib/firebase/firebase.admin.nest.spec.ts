import { Injectable, Module } from '@nestjs/common';
import { firebaseAdminFirestoreContextWithFixture } from './firebase.admin';
import { firebaseAdminNestContextFactory } from './firebase.admin.nest';
import { describeFirestoreTest, initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';

@Injectable()
export class TestInjectable {}

@Module({
  providers: [
    {
      provide: TestInjectable,
      useFactory: () => new TestInjectable()
    }
  ]
})
export class TestAppModule {}

export const firebaseAdminNestContext = firebaseAdminNestContextFactory({ nestModules: TestAppModule });

describe('firebaseAdminNestContext', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseAdminNestContext((f) => {
    describe('nest', () => {
      it('should have initialized the nest module.', () => {
        const thing = f.instance.get(TestInjectable);
        expect(thing).toBeDefined();
      });
    });

    // Example of only using the firestore fixture
    firebaseAdminFirestoreContextWithFixture(f.parent, (s) => {
      describeFirestoreTest(s);
    });
  });

  // todo: add tests
  // - test providers are available on the glboal scope
  // - test modules are imported
});
