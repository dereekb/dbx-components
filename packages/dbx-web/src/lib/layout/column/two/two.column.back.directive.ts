import { Directive, inject, output } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with an DbxTwoColumnComponent to help respond to a "back" function.
 */
@Directive({
  selector: '[dbxTwoColumnBack]',
  standalone: true
})
export class DbxTwoColumnBackDirective {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly dbxTwoColumnBack = output();

  constructor() {
    cleanSubscription(this.twoColumnsContextStore.back$.subscribe(() => this.dbxTwoColumnBack.emit()));
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
