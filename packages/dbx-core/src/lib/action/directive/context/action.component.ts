import { Component } from '@angular/core';
import { ProvideActionStoreSource } from '../../action.store.source';
import { DbxActionContextDirective } from './action.directive';

@Component({
  selector: 'dbx-action',
  exportAs: 'action',
  template: '<ng-content></ng-content>',
  
  providers: ProvideActionStoreSource(DbxActionComponent)
})
export class DbxActionComponent<T = any, O = any> extends DbxActionContextDirective<T, O>  { }
