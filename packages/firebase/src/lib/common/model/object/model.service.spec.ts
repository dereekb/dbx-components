import { MockFirebaseContext, authorizedFirestoreFactory, MockItemCollectionFixture, testWithMockItemFixture, MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, mockFirebaseModelServices, MockItem, MockItemDocument, MockItemRoles } from '@dereekb/firebase/test';
import { GrantedRoleMap, isFullAccessRolesMap, isNoAccessRolesMap } from '@dereekb/model';
import { Building } from '@dereekb/util';
import { makeDocuments } from '../../firestore';
import { FirestoreDocumentAccessor } from '../../firestore/accessor/document';
import { firebaseModelsService } from './model.service';

describe('firebaseModelsService', () => {
  describe('with mockFirebaseModelServices', () => {
    it('should create a FirebaseModelsService', () => {
      const result = firebaseModelsService(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

      expect(result).toBeDefined();
    });
  });

  testWithMockItemFixture()(authorizedFirestoreFactory)((f: MockItemCollectionFixture) => {
    describe('service', () => {
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

      it('should create an InContextFirebaseModelService', async () => {
        const context: MockFirebaseContext = {
          app: f.instance.collections
        };

        const result = mockFirebaseModelServices('mockitem', context);
        expect(result).toBeDefined();
        expect(result.rolesMapForKey).toBeDefined();
        expect(result.rolesMapForModel).toBeDefined();
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
        describe('rolesMapForKey()', () => {
          it('should return roles if the model exists.', async () => {
            let testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockitem', context).rolesMapForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data?.snapshot).toBeDefined();
            expect(result.data?.document).toBeDefined();
            expect(result.data?.exists).toBe(true);
            expect(result.data?.data).toBeDefined();
            expect(result.roles).toBe(testRoles);
          });

          it('should return empty roles if the model does not exist.', async () => {
            await item.accessor.delete();

            const result = await mockFirebaseModelServices('mockitem', context).rolesMapForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data?.exists).toBe(false);
            expect(result.data?.data).not.toBeDefined();
            expect(result.roles).toBeDefined();
            expect(isNoAccessRolesMap(result.roles)).toBe(true);
          });
        });

        describe('rolesMapForModel()', () => {
          it('should return roles if the model exists.', async () => {
            let testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockitem', context).rolesMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.roles).toBe(testRoles);
          });

          it('should return empty roles if the model does not exist.', async () => {
            await item.accessor.delete();

            const result = await mockFirebaseModelServices('mockitem', context).rolesMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data!.data).not.toBeDefined();
            expect(result.roles).toBeDefined();
            expect(isNoAccessRolesMap(result.roles)).toBe(true);
          });

          describe('with adminGetsAllowAllRoles=true', () => {
            beforeEach(() => {
              (context as any).adminGetsAllowAllRoles = true;
            });

            it('should return fullAccessor if the user is an admin', async () => {
              (context as Building<typeof context>).auth = {
                isAdmin: () => true
              } as any;

              const result = await mockFirebaseModelServices('mockitem', context).rolesMapForModel(item);
              expect(isFullAccessRolesMap(result.roles)).toBe(true);
            });

            it('should return normal roles if the user is not an admin.', async () => {
              (context as Building<typeof context>).auth = {
                uid: 'test',
                isAdmin: () => false
              } as any;

              const result = await mockFirebaseModelServices('mockitem', context).rolesMapForModel(item);
              expect(isFullAccessRolesMap(result.roles)).toBe(false);
            });
          });
        });
      });
    });
  });
});
