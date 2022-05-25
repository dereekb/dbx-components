import { Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { distinctUntilChanged, filter } from 'rxjs';
import { combineLatest } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { Host } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Maybe } from '@dereekb/util';

@Directive({
  selector: '[dbxActionAutoModify]',
})
export class DbxActionAutoModifyDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private readonly _autoModifyEnabled = new BehaviorSubject<boolean>(true);

  @Input('dbxActionAutoModify')
  get autoModifyEnabled(): boolean {
    return this._autoModifyEnabled.value;
  }

  set autoModifyEnabled(autoModifyEnabled: Maybe<boolean | ''>) {
    this._autoModifyEnabled.next(autoModifyEnabled !== false);
  }

  constructor(@Host() public readonly source: DbxActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    const obs = combineLatest([
      this._autoModifyEnabled.pipe(distinctUntilChanged()), // Don't change unless specified otherwise.
      this.source.isModified$.pipe(filter(x => !x)) // Only when not modified send a value.
    ]);

    this.sub = obs.subscribe(([autoModifyEnabled, isModified]) => {
      if (autoModifyEnabled && !isModified) {
        this.source.setIsModified(true);
      }
    });
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._autoModifyEnabled.complete();
    });
  }

}
