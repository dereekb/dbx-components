import { Maybe } from './value/maybe.type';

/**
 * Object that must be "initialized".
 */
export interface Initialized {
  init(): void;
}

/**
 * Object that can be "destroyed" as a way to clean itself up.
 */
export interface Destroyable {
  destroy(): void;
}

/**
 * Used for cleaning up/destroying content.
 */
export type DestroyFunction = () => void;

/**
 * Retains a reference to a single destroy function. When replaced, the previous destroy function is removed.
 */
export class DestroyFunctionObject implements Destroyable {
  private _destroy?: Maybe<DestroyFunction>;

  constructor(destroyFunction?: Maybe<DestroyFunction>) {
    if (destroyFunction) {
      this.setDestroyFunction(destroyFunction);
    }
  }

  public get hasDestroyFunction(): boolean {
    return Boolean(this._destroy);
  }

  setDestroyFunction(destroyFunction: Maybe<DestroyFunction>) {
    this.destroy();
    this._destroy = destroyFunction;
  }

  get destroy(): DestroyFunction {
    return () => this.clear();
  }

  set destroy(destroyFn: Maybe<DestroyFunction>) {
    this._destroy = destroyFn;
  }

  clear() {
    if (this._destroy) {
      this._destroy();
      delete this._destroy;
    }
  }
}
