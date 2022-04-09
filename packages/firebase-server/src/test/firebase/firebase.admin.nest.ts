import { AbstractChildJestTestContextFixture, ClassType, JestBuildTestsWithContextFunction, JestTestContextFactory, JestTestContextFixture, useJestContextFixture } from "@dereekb/util";
import { firebaseAdminFunctionTestContextFactory, firebaseAdminTestContextFactory, FirebaseAdminTestInstance } from './firebase.admin';
import { Test, TestingModule } from '@nestjs/testing';
import { Abstract, Type } from "@nestjs/common";

// MARK: FirebaseAdminNestTestBuilder
export interface FirebaseAdminNestTestConfig {
  moduleClass: ClassType;
}

export class FirebaseAdminNestTestContextFixture<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance> extends AbstractChildJestTestContextFixture<FirebaseAdminNestTestInstance<F>, JestTestContextFixture<F>> { }

export class FirebaseAdminNestTestInstance<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance> {

  constructor(readonly instance: F, readonly nest: TestingModule) { }

  get<TInput = any, TResult = TInput>(typeOrToken: Type<TInput> | Abstract<TInput> | string | symbol, options?: {
    strict: boolean;
  }): TResult {
    return this.nest.get(typeOrToken);
  }

}

export type FirebaseAdminNestTestContextFactory = JestTestContextFactory<FirebaseAdminNestTestContextFixture>;

export function firebaseAdminNestContextFixture<F extends FirebaseAdminTestInstance>(config: FirebaseAdminNestTestConfig, factory: JestTestContextFactory<JestTestContextFixture<F>>): FirebaseAdminNestTestContextFactory {
  return (buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture>) => {
    factory((f) => firebaseAdminNestContextWithFixture(config, f, buildTests));
  };
}

export function firebaseAdminNestContextWithFixture<F extends FirebaseAdminTestInstance = FirebaseAdminTestInstance>(config: FirebaseAdminNestTestConfig, f: JestTestContextFixture<F>, buildTests: JestBuildTestsWithContextFunction<FirebaseAdminNestTestContextFixture<F>>) {
  const { moduleClass } = config;

  useJestContextFixture({
    fixture: new FirebaseAdminNestTestContextFixture<F>(f),
    /**
     * Build tests by passing the fixture to the testing functions.
     * 
     * This will inject all tests and sub Jest lifecycle items.
     */
    buildTests,
    initInstance: async () => {
      const builder = (Test.createTestingModule({
        imports: [moduleClass],
      }));

      const nest = await builder.compile();
      return new FirebaseAdminNestTestInstance<F>(f.instance, nest);
    },
    destroyInstance: async (instance) => {
      await instance.nest.close();
    }
  });
}

export function firebaseAdminNestContextFactory(config: FirebaseAdminNestTestConfig): FirebaseAdminNestTestContextFactory {
  return firebaseAdminNestContextFixture(config, firebaseAdminTestContextFactory);
}

export function firebaseAdminFunctionNestContextFactory(config: FirebaseAdminNestTestConfig): FirebaseAdminNestTestContextFactory {
  return firebaseAdminNestContextFixture(config, firebaseAdminFunctionTestContextFactory);
}
