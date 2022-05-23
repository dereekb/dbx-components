import { Directive, Optional, OnDestroy, Host } from '@angular/core';
import { ProvideActionStoreSource, SecondaryActionContextStoreSource } from '../../action.store.source';
import { DbxActionContextBaseSource } from '../../action.holder';

/**
 * Provides an DbxActionContext.
 */
@Directive({
  selector: 'dbx-action,[dbxAction],dbx-action-context,[dbxActionContext]',
  exportAs: 'action,dbxAction',
  providers: ProvideActionStoreSource(DbxActionDirective)
})
export class DbxActionDirective<T = unknown, O = unknown> extends DbxActionContextBaseSource<T, O> implements OnDestroy {

  constructor(@Optional() @Host() inputSource: SecondaryActionContextStoreSource<T, O>) {
    super(inputSource);
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this.destroy();
    });
  }

}
