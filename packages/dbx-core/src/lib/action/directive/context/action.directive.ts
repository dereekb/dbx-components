import { Directive, Optional, OnDestroy, Host } from '@angular/core';
import { ProvideActionStoreSource, SecondaryActionContextStoreSource } from '../../action.store.source';
import { ActionContextBaseSource } from '../../action.holder';

/**
 * Provides an DbxActionContext.
 */
@Directive({
  selector: '[dbxActionContext]',
  exportAs: 'action',
  providers: ProvideActionStoreSource(DbxActionContextDirective)
})
export class DbxActionContextDirective<T = any, O = any> extends ActionContextBaseSource implements OnDestroy {

  constructor(@Optional() @Host() inputSource: SecondaryActionContextStoreSource) {
    super(inputSource);
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this.destroy();
    });
  }

}
