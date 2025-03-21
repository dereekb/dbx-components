import { Component, Input, inject } from '@angular/core';
import { TwoColumnsContextStore } from '../two';

/**
 * Pre-configured Two-columns view that only has a left view and shows full left.
 */
@Component({
  selector: 'dbx-one-column',
  template: `
    <ng-container>
      <dbx-two-column [inSectionPage]="inSectionPage">
        <ng-content top select="[top]"></ng-content>
        <ng-content left></ng-content>
      </dbx-two-column>
    </ng-container>
  `,
  exportAs: 'columns',
  providers: [TwoColumnsContextStore]
})
export class DbxOneColumnComponent {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  constructor() {
    this.twoColumnsContextStore.setFullLeft(true);
  }

  @Input()
  inSectionPage = true;
}
