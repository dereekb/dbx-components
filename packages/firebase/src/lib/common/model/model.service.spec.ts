import { itShouldFail, expectFail } from '@dereekb/util/test';
import { type MockFirebaseContext, authorizedFirebaseFactory, type MockItemCollectionFixture, testWithMockItemCollectionFixture, MOCK_FIREBASE_MODEL_SERVICE_FACTORIES, mockFirebaseModelServices, type MockItem, type MockItemDocument, type MockItemRoles } from '@dereekb/firebase/test';
import { type GrantedRoleMap, isNoAccessRoleMap } from '@dereekb/model';
import { type ArrayOrValue, type UsePromiseFunction } from '@dereekb/util';
import { makeDocuments } from '../firestore';
import { type FirestoreDocumentAccessor } from '../firestore/accessor/document';
import { firebaseModelsService, inContextFirebaseModelsServiceFactory, type InModelContextFirebaseModelServiceFactory, selectFromFirebaseModelsService, useFirebaseModelsService } from './model.service';
import { type ContextGrantedModelRolesReader } from './permission/permission.service.role';

describe('firebaseModelsService', () => {
  describe('with mockFirebaseModelServices', () => {
    it('should create a FirebaseModelsService', () => {
      const result = firebaseModelsService(MOCK_FIREBASE_MODEL_SERVICE_FACTORIES);

      expect(result).toBeDefined();
    });
  });

  testWithMockItemCollectionFixture()(authorizedFirebaseFactory)((f: MockItemCollectionFixture) => {
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

    describe('selection', () => {
      describe('selectFromFirebaseModelsService()', () => {
        it('should return an InModelContextFirebaseModelService instance with the specified model.', () => {
          const result = selectFromFirebaseModelsService(mockFirebaseModelServices, 'mockItem', {
            context,
            key: item.key
          });

          expect(typeof result).toBe('function');
          expect(result).toBeDefined();
          expect(result.requireRole).toBeDefined();
          expect(result.requireUse).toBeDefined();
          expect(result.use).toBeDefined();
          expect(result.roleMap).toBeDefined();
          expect(result.roleReader).toBeDefined();
          expect(result.model).toBeDefined();
          expect(result.model.key).toBe(item.key);
        });
      });

      describe('useFirebaseModelsService()', () => {
        it('should create a function that uses the target model.', () => {
          const useFn = useFirebaseModelsService(mockFirebaseModelServices, 'mockItem', {
            context,
            key: item.key
          });

          expect(useFn).toBeDefined();
          expect(typeof useFn).toBe('function');
        });

        describe('function', () => {
          let useFn: UsePromiseFunction<ContextGrantedModelRolesReader<MockFirebaseContext, MockItem, MockItemDocument, MockItemRoles>>;

          function setUseFnWithContext(partialContext: Partial<MockFirebaseContext>, roles: ArrayOrValue<MockItemRoles> = 'read') {
            useFn = useFirebaseModelsService(mockFirebaseModelServices, 'mockItem', {
              context: {
                ...context,
                ...partialContext
              },
              key: item.key,
              roles
            });
          }

          beforeEach(() => {
            useFn = useFirebaseModelsService(mockFirebaseModelServices, 'mockItem', {
              context,
              key: item.key
            });
          });

          it('should use the model.', async () => {
            let used = false;

            const value = 0;
            const result = await useFn((x) => {
              expect(x.data).toBeDefined();
              expect(x.document).toBeDefined();
              expect(x.snapshot).toBeDefined();

              used = true;

              return value;
            });

            expect(used).toBe(true);
            expect(result).toBe(value);
          });

          describe('with roles', () => {
            const readRoleKey = 'read';

            it('should use the model if the context is granted the expected roles.', async () => {
              setUseFnWithContext({
                rolesToReturn: {
                  [readRoleKey]: true
                }
              });

              let used = false;

              const value = 0;
              const result = await useFn((x) => {
                expect(x.hasRole(readRoleKey)).toBe(true);
                used = true;
                return value;
              });

              expect(used).toBe(true);
              expect(result).toBe(value);
            });

            itShouldFail('if the model is not granted the expected roles.', async () => {
              setUseFnWithContext({
                rolesToReturn: {
                  [readRoleKey]: false // not allowed to read
                }
              });

              let used = false;

              const value = 0;

              try {
                await expectFail(() =>
                  useFn((x) => {
                    expect(x.hasRole(readRoleKey)).toBe(true);
                    used = true;
                    return value;
                  })
                );
              } catch (e) {
                expect(used).toBe(false);
                throw e;
              }
            });
          });
        });
      });
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
          const inContext = inContextFactory(context)('mockItem');
          const inModelContextFactory = inContext(item);

          expect(inModelContextFactory).toBeDefined();
          expect(typeof inModelContextFactory).toBe('function');
        });

        describe('service', () => {
          let inModelContextFactory: InModelContextFirebaseModelServiceFactory<MockFirebaseContext, MockItem, MockItemDocument, MockItemRoles>;

          beforeEach(() => {
            const inContextFactory = inContextFirebaseModelsServiceFactory(mockFirebaseModelServices);
            const inContext = inContextFactory(context)('mockItem');
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

        const result = mockFirebaseModelServices('mockItem', context);
        expect(result).toBeDefined();
        expect(result.roleMapForKey).toBeDefined();
        expect(result.roleMapForModel).toBeDefined();
        expect(result.loadModelForKey).toBeDefined();
      });

      describe('InContextFirebaseModelLoader', () => {
        describe('loadModelForKey()', () => {
          it('should return a document for the input key', async () => {
            const result = await mockFirebaseModelServices('mockItem', context).loadModelForKey(item.documentRef.path);
            expect(result).toBeDefined();
            expect(result.documentRef.path).toBe(item.documentRef.path);
          });
        });
      });

      describe('InContextFirebaseModelPermissionService', () => {
        describe('roleMapForKey()', () => {
          it('should return roles if the model exists.', async () => {
            const testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockItem', context).roleMapForKey(item.documentRef.path);
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

            const result = await mockFirebaseModelServices('mockItem', context).roleMapForKey(item.documentRef.path);
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
            const testRoles: GrantedRoleMap<MockItemRoles> = {
              read: true
            };

            context.rolesToReturn = testRoles; // configured to be returned

            const result = await mockFirebaseModelServices('mockItem', context).roleMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.roleMap).toBe(testRoles);
          });

          it('should return empty roles if the model does not exist.', async () => {
            await item.accessor.delete();

            const result = await mockFirebaseModelServices('mockItem', context).roleMapForModel(item);
            expect(result).toBeDefined();
            expect(result.context).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data!.data).not.toBeDefined();
            expect(result.roleMap).toBeDefined();
            expect(isNoAccessRoleMap(result.roleMap)).toBe(true);
          });
        });
      });
    });
  });
});
