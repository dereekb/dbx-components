import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DbxTwoColumnComponent } from '../two/two.column.component';
import { provideTwoColumnsContext, TwoColumnsContextStore } from '../two/two.column.store';

/**
 * Pre-configured Two-columns view that only has a left view and shows full left.
 */
@Component({
  selector: 'dbx-one-column',
  template: `
    <ng-container>
      <dbx-two-column [inSectionPage]="inSectionPage()">
        <ng-content top select="[top]"></ng-content>
        <ng-content left></ng-content>
      </dbx-two-column>
    </ng-container>
  `,
  exportAs: 'columns',
  providers: provideTwoColumnsContext(),
  imports: [DbxTwoColumnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxOneColumnComponent {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);
  readonly inSectionPage = input<boolean>(true);

  constructor() {
    this.twoColumnsContextStore.setFullLeft(true);
  }
}
