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
export class DbxActionDirective<T = any, O = any> extends DbxActionContextBaseSource implements OnDestroy {

  constructor(@Optional() @Host() inputSource: SecondaryActionContextStoreSource) {
    super(inputSource);
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this.destroy();
    });
  }

}
