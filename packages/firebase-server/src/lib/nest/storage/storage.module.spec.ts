import { Module } from '@nestjs/common';
import { firebaseAdminFunctionNestContextFactory, initFirebaseServerAdminTestEnvironment } from '@dereekb/firebase-server/test';
import { firebaseServerStorageModuleMetadata } from './storage.module';
import { FirebaseServerStorageService } from '../../storage/storage.service';
import { FirebaseStorageContext } from '@dereekb/firebase';

class TestFirebaseServerStorageService extends FirebaseServerStorageService {}

@Module(
  firebaseServerStorageModuleMetadata({
    serviceProvider: {
      provide: TestFirebaseServerStorageService,
      useFactory: (x: FirebaseStorageContext) => new TestFirebaseServerStorageService(x)
    }
  })
)
class TestStorageAppModule {}

/**
 * Test context factory that will automatically instantiate TestAppModule for each test, and make it available.
 */
const firebaseStorageAdminFunctionNestContext = firebaseAdminFunctionNestContextFactory({
  nestModules: TestStorageAppModule,
  injectFirebaseServerAppTokenProvider: true
});

describe('firebase nest storage', () => {
  initFirebaseServerAdminTestEnvironment();

  firebaseStorageAdminFunctionNestContext((f) => {
    let storageService: TestFirebaseServerStorageService;

    beforeEach(() => {
      storageService = f.get(TestFirebaseServerStorageService);
    });

    describe('FirebaseServerStorageService', () => {
      describe('file', () => {
        it('should create a file', () => {
          const file = storageService.file('hello.txt');
          expect(file).toBeDefined();
        });
      });
    });
  });
});
