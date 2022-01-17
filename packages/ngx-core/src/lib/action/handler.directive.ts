import { Directive, Host, Input, OnDestroy, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';
import { HandleActionFunction, WorkHandlerContextSourceDelegate, handleWorkValueReadyFn } from './action.handler';


/**
 * Context used for defining a function that performs an action using the input function on ValueReady.
 */
@Directive({
  selector: '[dbxActionHandler]',
})
export class DbNgxActionHandlerDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  @Input('dbxActionHandler')
  handlerFunction?: HandleActionFunction<T, O>;

  private _delegate = new WorkHandlerContextSourceDelegate<T, O>(this.source);

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.valueReady$.subscribe((value) => {
      if (!this.handlerFunction) {
        console.warn('No handler function registered to handle ready value: ', value);
        return;
      }

      const context = handleWorkValueReadyFn({ handlerFunction: this.handlerFunction, delegate: this._delegate })(value);

      if (context) {

        // Add the action to the lockSet for the source to prevent it from being destroyed until the action completes.
        this.source.lockSet.addLock('actionhandler', context.isComplete$.pipe(map(x => !x)));
      }
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
    });
  }

}
