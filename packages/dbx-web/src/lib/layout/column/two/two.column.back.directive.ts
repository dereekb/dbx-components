import { Directive, EventEmitter, Output, OnInit, inject } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with an DbxTwoColumnComponent to help respond to a "back" function.
 */
@Directive({
  selector: '[dbxTwoColumnBack]'
})
export class DbxTwoColumnBackDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  @Output('dbxTwoColumnBack')
  public back = new EventEmitter();

  ngOnInit(): void {
    this.sub = this.twoColumnsContextStore.back$.subscribe(() => this.back.emit());
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
