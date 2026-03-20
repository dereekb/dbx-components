import { type AbstractFirebaseNestContext } from './nest.provider';

/**
 * Abstract class used for the top-level server NestJS context for server-only services.
 *
 * Your API implementation of this class is usually <AppPrefix>ApiServerNestContext (e.g. `DemoApiServerNestContext`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic type parameters require `any` for Firebase SDK compatibility
export abstract class AbstractServerFirebaseNestContext<C extends AbstractFirebaseNestContext<any, any>> {
  private readonly _context: C;

  constructor(c: C) {
    this._context = c;
  }

  get context(): C {
    return this._context;
  }

  get nest() {
    return this.context.nestApplication;
  }
}
