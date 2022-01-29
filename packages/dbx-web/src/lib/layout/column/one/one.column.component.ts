import { Component, Inject, Input } from '@angular/core';
import { TwoColumnsContextStore } from '../two';

/**
 * Pre-configured Two-columns view that only has a left view and shows full left.
 */
@Component({
  selector: 'dbx-one-column',
  template: `
    <ng-container>
      <dbx-two-columns [inSectionPage]="inSectionPage">
        <ng-content top select="[top]"></ng-content>
        <ng-content left></ng-content>
      </dbx-two-columns>
    </ng-container>
  `,
  exportAs: 'columns',
  providers: [TwoColumnsContextStore]
})
export class DbNgxOneColumnComponent {

  constructor(@Inject(TwoColumnsContextStore) public readonly twoColumnsContextStore: TwoColumnsContextStore) {
    twoColumnsContextStore.setFullLeft(true);
  }

  @Input()
  inSectionPage = true;

}
