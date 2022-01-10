import { Component, Directive, Inject, Injectable, Input, OnInit, Optional, OnDestroy, SkipSelf, Host } from '@angular/core';
import { ProvideActionStoreSource, SecondaryActionContextStoreSource } from './action';
import { ActionContextBaseSource } from './action.holder';

/**
 * Provides an DbNgxActionContext.
 */
@Directive({
  selector: '[dbxActionContext]',
  exportAs: 'action',
  providers: ProvideActionStoreSource(DbNgxActionContextDirective)
})
export class DbNgxActionContextDirective<T = any, O = any> extends ActionContextBaseSource implements OnDestroy {

  constructor(@Optional() @Host() inputSource: SecondaryActionContextStoreSource) {
    super(inputSource);
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this.destroy();
    });
  }

}
