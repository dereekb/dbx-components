import { Component, Directive, forwardRef, Injectable, OnInit } from '@angular/core';
import { ProvideActionStoreSource } from './action';
import { DbNgxActionContextDirective } from './action.directive';

@Component({
  selector: 'dbx-action',
  exportAs: 'action',
  template: '<ng-content></ng-content>',
  styleUrls: ['./action.scss'],
  providers: ProvideActionStoreSource(DbNgxActionComponent)
})
export class DbNgxActionComponent<T = any, O = any> extends DbNgxActionContextDirective<T, O>  { }
