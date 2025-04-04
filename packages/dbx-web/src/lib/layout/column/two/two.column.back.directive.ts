import { Directive, EventEmitter, Output, OnInit, inject, output } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with an DbxTwoColumnComponent to help respond to a "back" function.
 */
@Directive({
  selector: '[dbxTwoColumnBack]',
  standalone: true
})
export class DbxTwoColumnBackDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly dbxTwoColumnBack = output();

  ngOnInit(): void {
    this.sub = this.twoColumnsContextStore.back$.subscribe(() => this.dbxTwoColumnBack.emit());
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
