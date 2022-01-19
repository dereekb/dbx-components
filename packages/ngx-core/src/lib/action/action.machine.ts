import { delay, first } from 'rxjs/operators';
import { ActionContextStoreSource } from './action.store.source';
import { HandleActionFunction, handleWorkValueReadyFn, WorkHandlerContextSourceDelegate } from './action.handler';
import { ActionContextBaseSource } from './action.holder';
import { Destroyable } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/util-rxjs';

export interface ActionContextMachineConfig<T = any, O = any> {
  /**
   * Whether or not the machine should clean itself up after being triggered.
   */
  oneTimeUse: boolean;
  handleValueReady: HandleActionFunction<T, O>;
  onSuccess?: (value: O) => void;
}

/**
 * Configurable machine that handles components of the ActionContextStore lifecycle.
 */
export class ActionContextMachine<T = any, O = any> extends ActionContextBaseSource<T, O> implements Destroyable {

  private _isShutdown = true;
  private _handleValueReadySub = new SubscriptionObject();

  constructor(readonly config: ActionContextMachineConfig<T, O>, source?: ActionContextStoreSource) {
    super(source);

    // Handle Value Ready
    this._handleValueReadySub.subscription = this.sourceInstance.valueReady$.subscribe((value) => {
      handleWorkValueReadyFn({ handlerFunction: config.handleValueReady, delegate: new WorkHandlerContextSourceDelegate<T, O>(this.sourceInstance) })(value);
    });

    // If this is a one-time use, then destroy it after the first success comes through.
    if (this.config.oneTimeUse) {
      this.sourceInstance.success$.pipe(first(), delay(1000)).subscribe(() => {
        this.destroy();
      });
    }

    if (this.config.onSuccess) {
      this.sourceInstance.success$.subscribe(this.config.onSuccess);
    }
  }

  override destroy(): void {
    super.destroy();
    this._handleValueReadySub.destroy();
    this._isShutdown = true;
  }

  get isShutdown(): boolean {
    return this._isShutdown;
  }

}
