import { Module } from '@nestjs/common';
import { firebaseAdminFirestoreContextWithFixture } from './firebase.admin';
import { firebaseAdminNestContextFactory } from './firebase.admin.nest';
import { describeFirestoreTest, initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';

export class TestThing { }

@Module({
  providers: [{
    provide: TestThing,
    useFactory: () => new TestThing()
  }]
})
export class AppModule { }

export const firebaseAdminNestContext = firebaseAdminNestContextFactory({ nestModules: AppModule });

describe('firebaseAdminNestContext', () => {

  initFirebaseServerAdminTestEnvironment();

  firebaseAdminNestContext((f) => {

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

  // todo: add tests
  // - test providers are available on the glboal scope
  // - test modules are imported

});
