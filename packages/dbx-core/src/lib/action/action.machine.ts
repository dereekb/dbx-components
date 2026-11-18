import { type DbxActionContextSourceReference } from './action.reference';
import { delay, take } from 'rxjs';
import { type ActionContextStoreSource } from './action.store.source';
import { DbxActionWorkInstanceDelegate } from './action.handler';
import { DbxActionContextBaseSource } from './action.holder';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { SubscriptionObject, type Work, workFactory } from '@dereekb/rxjs';
import { Injectable } from '@angular/core';
import { clean } from '../rxjs/clean';

/**
 * Configuration for a {@link DbxActionContextMachine}.
 *
 * Controls how the machine handles the value-ready phase, whether it self-destructs
 * after a single use, and optional callbacks for success events.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 */
export interface DbxActionContextMachineConfig<T = unknown, O = unknown> {
  /**
   * Whether or not the machine should clean itself up after being triggered once.
   */
  readonly oneTimeUse: boolean;
  /**
   * Function to handle any valueReady events.
   *
   * If false, will not subscribe/handle valueReady$ events.
   */
  readonly handleValueReady: Work<T, O> | false;
  /**
   * Optional function to execute after the action has succeeded.
   */
  readonly onSuccess?: (value: Maybe<O>) => void;
}

/**
 * Configurable machine that handles components of the ActionContextStore lifecycle.
 *
 * It can be configured to activate only once before cleaning itself up. It can be used directly as a DbxActionContextSourceReference in cases where it is created as a one-off action.
 *
 * The machine can be constructed anywhere; it does not need an injection context. Whoever creates it owns it and calls
 * {@link DbxActionContextMachine.destroy}, or wraps it in `clean(...)` to tie it to the current injection context.
 * A one-time-use machine destroys itself shortly after its first success, and the action snackbar destroys the undo
 * reference it was handed when it closes. Teardown waits until no work is in flight.
 *
 * @example
 * ```ts
 * // A one-off action, built outside of any injection context:
 * const machine = new DbxActionContextMachine<number, void>({ oneTimeUse: true, handleValueReady: (value) => api.restore(value) });
 * machine.triggerWithValue(5); // destroys itself after it succeeds
 * ```
 *
 * @example
 * ```ts
 * // A machine owned by a component, destroyed with it:
 * readonly machine = clean(new DbxActionContextMachine<MyValue, MyResult>({ oneTimeUse: false, handleValueReady: (value) => this.api.save(value) }));
 * ```
 */
export class DbxActionContextMachine<T = unknown, O = unknown> extends DbxActionContextBaseSource<T, O> implements DbxActionContextSourceReference<T, O>, Destroyable {
  private _isShutdown = false;

  private readonly _config: DbxActionContextMachineConfig<T, O>;
  private readonly _handleValueReadySub = new SubscriptionObject();
  private readonly _successSub = new SubscriptionObject();
  private readonly _oneTimeUseSub = new SubscriptionObject();

  constructor(config: DbxActionContextMachineConfig<T, O>, source?: ActionContextStoreSource<T, O>) {
    super(source);
    this._config = config;

    // Handle Value Ready
    if (config.handleValueReady !== false) {
      this._handleValueReadySub.subscription = this.sourceInstance.valueReady$.subscribe((value) => {
        const doWork = workFactory({
          work: config.handleValueReady as Work<T, O>,
          delegate: new DbxActionWorkInstanceDelegate<T, O>(this.sourceInstance)
        });

        doWork(value);
      });
    }

    // If this is a one-time use, then destroy it after the first success comes through.
    if (config.oneTimeUse) {
      this._oneTimeUseSub.subscription = this.sourceInstance.success$.pipe(take(1), delay(1000)).subscribe(() => {
        this.destroy();
      });
    }

    if (config.onSuccess) {
      this._successSub.subscription = this.sourceInstance.success$.subscribe(config.onSuccess);
    }
  }

  /**
   * Destroys the machine and queues the teardown of its store. Safe to call more than once.
   */
  override destroy(): void {
    if (!this._isShutdown) {
      this._isShutdown = true;
      super.destroy();
      this._handleValueReadySub.destroy();
      this._successSub.destroy();
      this._oneTimeUseSub.destroy();
    }
  }

  get config() {
    return this._config;
  }

  get isShutdown(): boolean {
    return this._isShutdown;
  }
}

/**
 * DbxActionContextMachine configured for use as a Service/Injectable.
 */
@Injectable()
export class DbxActionContextMachineAsService<T = unknown, O = unknown> extends DbxActionContextMachine<T, O> {
  constructor() {
    super({
      oneTimeUse: false,
      handleValueReady: false
    });

    clean(() => this.destroy());
  }
}
