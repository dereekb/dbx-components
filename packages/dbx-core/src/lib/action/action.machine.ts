import { DbxActionContextSourceReference } from './action.reference';
import { delay, first } from 'rxjs';
import { ActionContextStoreSource } from './action.store.source';
import { DbxActionWorkInstanceDelegate, HandleActionFunction } from './action.handler';
import { DbxActionContextBaseSource } from './action.holder';
import { Destroyable, Maybe } from '@dereekb/util';
import { SubscriptionObject, workFactory } from '@dereekb/rxjs';

/**
 * DbxActionContextMachine configuration.
 */
export interface DbxActionContextMachineConfig<T = unknown, O = unknown> {
  /**
   * Whether or not the machine should clean itself up after being triggered once.
   */
  oneTimeUse: boolean;
  /**
   * Function to handle any valueReady events.
   */
  handleValueReady: HandleActionFunction<T, O>;
  /**
   * Optional function to execute after the action has succeeded.
   */
  onSuccess?: (value: Maybe<O>) => void;
}

/**
 * Configurable machine that handles components of the ActionContextStore lifecycle.
 * 
 * It can be configured to activate only once before cleaning itself up. It can be used directly as a DbxActionContextSourceReference in cases where it is created as a one-off action.
 */
export class DbxActionContextMachine<T = unknown, O = unknown> extends DbxActionContextBaseSource<T, O> implements DbxActionContextSourceReference<T, O>, Destroyable {

  private _isShutdown = true;
  private _handleValueReadySub = new SubscriptionObject();
  private _successSub = new SubscriptionObject();

  constructor(readonly config: DbxActionContextMachineConfig<T, O>, source?: ActionContextStoreSource<T, O>) {
    super(source);

    // Handle Value Ready
    this._handleValueReadySub.subscription = this.sourceInstance.valueReady$.subscribe((value) => {
      const doWork = workFactory({
        work: config.handleValueReady,
        delegate: new DbxActionWorkInstanceDelegate<T, O>(this.sourceInstance)
      });

      doWork(value);
    });

    // If this is a one-time use, then destroy it after the first success comes through.
    if (this.config.oneTimeUse) {
      this.sourceInstance.success$.pipe(first(), delay(1000)).subscribe(() => {
        this.destroy();
      });
    }

    if (this.config.onSuccess) {
      this._successSub.subscription = this.sourceInstance.success$.subscribe(this.config.onSuccess);
    }
  }

  override destroy(): void {
    super.destroy();
    this._handleValueReadySub.destroy();
    this._successSub.destroy();
    this._isShutdown = true;
  }

  get isShutdown(): boolean {
    return this._isShutdown;
  }

}
