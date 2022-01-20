import { Component } from '@angular/core';
import { ProvideActionStoreSource } from './action.store.source';
import { DbNgxActionContextDirective } from './action.directive';

@Component({
  selector: 'dbx-action',
  exportAs: 'action',
  template: '<ng-content></ng-content>',
  
  providers: ProvideActionStoreSource(DbNgxActionComponent)
})
export class DbNgxActionComponent<T = any, O = any> extends DbNgxActionContextDirective<T, O>  { }
