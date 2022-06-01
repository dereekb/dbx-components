import { MockFirebaseContext, authorizedFirestoreFactory, MockItemCollectionFixture, testWithMockItemFixture, MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, mockFirebaseModelServices, MockItem, MockItemDocument, MockItemRoles } from '@dereekb/firebase/test';
import { GrantedRoleMap, isFullAccessRoleMap, isNoAccessRoleMap } from '@dereekb/model';
import { Building } from '@dereekb/util';
import { makeDocuments } from '../firestore';
import { FirestoreDocumentAccessor } from '../firestore/accessor/document';
import { firebaseModelsService, inContextFirebaseModelsServiceFactory, InModelContextFirebaseModelServiceFactory } from './model.service';

describe('firebaseModelsService', () => {
  describe('with mockFirebaseModelServices', () => {
    it('should create a FirebaseModelsService', () => {
      const result = firebaseModelsService(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

      expect(result).toBeDefined();
    });
  });

  testWithMockItemFixture()(authorizedFirestoreFactory)((f: MockItemCollectionFixture) => {
    let context: MockFirebaseContext;
    let firestoreDocumentAccessor: FirestoreDocumentAccessor<MockItem, MockItemDocument>;
    let item: MockItemDocument;

    beforeEach(async () => {
      context = {
        app: f.instance.collections
      };

      firestoreDocumentAccessor = f.instance.firestoreCollection.documentAccessor();
      const items = await makeDocuments(f.instance.firestoreCollection.documentAccessor(), {
        count: 1,
        init: (i) => {
          return {
            value: `${i}`,
            test: true,
            string: ''
          };
        }
      });

      item = items[0];
    });

    describe('inContextFirebaseModelsServiceFactory', () => {
      it('should create an InContextFirebaseModelsServiceFactory', () => {
        const x = inContextFirebaseModelsServiceFactory(mockFirebaseModelServices);
        expect(x).toBeDefined();
        expect(typeof x === 'function').toBe(true);
      });

      describe('InModelContextFirebaseModelServiceFactory', () => {
        it('should create an InModelContextFirebaseModelsServiceFactory', () => {
          const inContextFactory = inContextFirebaseModelsServiceFactory(mockFirebaseModelServices);
          const inContext = inContextFactory(context)('mockitem');
          const inModelContextFactory = inContext(item);

          expect(inModelContextFactory).toBeDefined();
          expect(typeof inModelContextFactory === 'object').toBe(true);
        });

        describe('service', () => {
          let inModelContextFactory: InModelContextFirebaseModelServiceFactory<MockFirebaseContext, MockItem, MockItemDocument, MockItemRoles>;

          beforeEach(() => {
            const inContextFactory = inContextFirebaseModelsServiceFactory(mockFirebaseModelServices);
            const inContext = inContextFactory(context)('mockitem');
            inModelContextFactory = inContext;
          });

          describe('roleMap', () => {
            it('should return the roles map for that model.', async () => {
              const inModelContext = inModelContextFactory(item);
              const roleMap = await inModelContext.roleMap();
              expect(roleMap).toBeDefined();
            });
          });
        });
      });
    });

    describe('service', () => {
      it('should create an InContextFirebaseModelService', async () => {
        const context: MockFirebaseContext = {
          app: f.instance.collections
        };

        const result = mockFirebaseModelServices('mockitem', context);
        expect(result).toBeDefined();
        expect(result.roleMapForKey).toBeDefined();
        expect(result.roleMapForModel).toBeDefined();
        expect(result.loadModelForKey).toBeDefined();
      });

      describe('InContextFirebaseModelLoader', () => {
        describe('loadModelForKey()', () => {
          it('should return a document for the input key', async () => {
            const result = await mockFirebaseModelServices('mockitem', context).loadModelForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.documentRef.path).toBe(item.documentRef.path);
          });
        });
      });

      describe('InContextFirebaseModelPermissionService', () => {
        describe('roleMapForKey()', () => {
          it('should return roles if the model exists.', async () => {
            let testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockitem', context).roleMapForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data?.snapshot).toBeDefined();
            expect(result.data?.document).toBeDefined();
            expect(result.data?.exists).toBe(true);
            expect(result.data?.data).toBeDefined();
            expect(result.roleMap).toBe(testRoles);
          });

          it('should return empty roles if the model does not exist.', async () => {
            await item.accessor.delete();

            const result = await mockFirebaseModelServices('mockitem', context).roleMapForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data?.exists).toBe(false);
            expect(result.data?.data).not.toBeDefined();
            expect(result.roleMap).toBeDefined();
            expect(isNoAccessRoleMap(result.roleMap)).toBe(true);
          });
        });

        describe('roleMapForModel()', () => {
          it('should return roles if the model exists.', async () => {
            let testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockitem', context).roleMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.roleMap).toBe(testRoles);
          });

          it('should return empty roles if the model does not exist.', async () => {
            await item.accessor.delete();

            const result = await mockFirebaseModelServices('mockitem', context).roleMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data!.data).not.toBeDefined();
            expect(result.roleMap).toBeDefined();
            expect(isNoAccessRoleMap(result.roleMap)).toBe(true);
          });

          describe('with adminGetsAllowAllRoles=true', () => {
            beforeEach(() => {
              (context as any).adminGetsAllowAllRoles = true;
            });

            it('should return fullAccessor if the user is an admin', async () => {
              (context as Building<typeof context>).auth = {
                isAdmin: () => true
              } as any;

              const result = await mockFirebaseModelServices('mockitem', context).roleMapForModel(item);
              expect(isFullAccessRoleMap(result.roleMap)).toBe(true);
            });

            it('should return normal roles if the user is not an admin.', async () => {
              (context as Building<typeof context>).auth = {
                uid: 'test',
                isAdmin: () => false
              } as any;

              const result = await mockFirebaseModelServices('mockitem', context).roleMapForModel(item);
              expect(isFullAccessRoleMap(result.roleMap)).toBe(false);
            });
          });
        });
      });
    });
  });
});
