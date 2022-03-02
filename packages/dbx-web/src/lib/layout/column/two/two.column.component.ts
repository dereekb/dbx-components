import { Component, Inject, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Responsive component meant to split a left and right column.
 *
 * The left column is smaller than the right column, which contains the primary content.
 *
 * Requires a TwoColumnsContextStore to be provided.
 */
@Component({
  selector: 'dbx-two-columns',
  templateUrl: './two.column.component.html',
  exportAs: 'columns'
})
export class DbxTwoColumnsComponent {

  readonly showRight$: Observable<boolean> = this.twoColumnsContextStore.showRight$;
  readonly hideRight$: Observable<boolean> = this.twoColumnsContextStore.hideRight$;
  readonly showFullLeft$: Observable<boolean> = this.twoColumnsContextStore.showFullLeft$;

  constructor(@Inject(TwoColumnsContextStore) public readonly twoColumnsContextStore: TwoColumnsContextStore) { }

  @Input()
  reverseSizing: boolean = false;

  @Input()
  inSectionPage: boolean = false;

}
