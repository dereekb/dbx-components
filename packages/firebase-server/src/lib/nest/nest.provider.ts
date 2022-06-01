import { FirebaseAppModelContext, FirebaseModelsService, InContextFirebaseModelsService, inContextFirebaseModelsServiceFactory } from '@dereekb/firebase';
import { build, BuildFunction, Getter } from '@dereekb/util';
import { INestApplicationContext } from '@nestjs/common';
import { AuthDataRef } from '../auth';
import { FirebaseServerAuthService } from '../auth/auth.service';

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type NestApplicationPromiseGetter = Getter<Promise<INestApplicationContext>>;

/**
 * Generates a function from the passed NestApplicationPromiseGetter/context.
 *
 * This pattern is available to allow generating similar content for differenting contexts, such as production and testing.
 */
export type NestApplicationFunctionFactory<F> = (nestAppPromiseGetter: NestApplicationPromiseGetter) => F;

/**
 * Getter for an INestApplicationContext promise. Nest should be initialized when the promise resolves.
 */
export type MakeNestContext<C> = (nest: INestApplicationContext) => C;

/**
 * Abstract class that wraps an INestApplicationContext value.
 */
export abstract class AbstractNestContext {
  constructor(readonly nest: INestApplicationContext) {}
}

export abstract class AbstractFirebaseNestContext<C, Y extends FirebaseModelsService<any, any>> extends AbstractNestContext {
  abstract get authService(): FirebaseServerAuthService;
  abstract get modelsService(): Y;
  abstract get app(): C;

  /**
   * Creates a FirebaseAppModelContext instance.
   *
   * @param auth
   * @param buildFn
   * @returns
   */
  modelContext(auth: AuthDataRef, buildFn?: BuildFunction<FirebaseAppModelContext<C>>): FirebaseAppModelContext<C> {
    const base = {
      auth: this.authService.authContextInfo(auth),
      app: this.app
    };

    return buildFn
      ? build({
          base,
          build: buildFn
        })
      : base;
  }

  /**
   * Creates a InContextFirebaseModelsService given the input context and parameters.
   *
   * @param auth
   * @param buildFn
   * @returns
   */
  service(auth: AuthDataRef, buildFn?: BuildFunction<FirebaseAppModelContext<C>>): InContextFirebaseModelsService<Y> {
    const firebaseModelContext = this.modelContext(auth, buildFn);
    return inContextFirebaseModelsServiceFactory(this.modelsService)(firebaseModelContext) as InContextFirebaseModelsService<Y>;
  }
}
