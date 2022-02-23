import { OnInit } from '@angular/core';
import { Directive, Input, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnsComponent to set the full left to true.
 */
@Directive({
  selector: '[dbxTwoColumnsFullLeft]'
})
export class DbxTwoColumnsFullLeftDirective implements OnInit, OnDestroy {

  private _fullLeft = new BehaviorSubject<boolean>(true);

  @Input('dbxTwoColumnsFullLeft')
  get fullLeft(): boolean {
    return this._fullLeft.value;
  }

  set fullLeft(fullLeft: boolean) {
    if (fullLeft != null && (fullLeft as any) !== '') {
      this._fullLeft.next(fullLeft);
    }
  }

  constructor(private readonly _twoColumnsContextStore: TwoColumnsContextStore) { }

  ngOnInit(): void {
    this._twoColumnsContextStore.setFullLeft(this._fullLeft);
  }

  ngOnDestroy(): void {
    this._fullLeft.complete();
  }

}
