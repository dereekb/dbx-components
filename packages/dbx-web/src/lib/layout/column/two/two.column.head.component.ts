import { Component, Input } from '@angular/core';

/**
 * Two Columns related component that sits at the top of the content bodies and wraps content.
 */
@Component({
  selector: 'dbx-two-columns-head',
  template: `
    <div class="dbx-two-columns-head" [ngClass]="{ 'block': block, 'full': full }">
      <ng-content></ng-content>
    </div>
  `
})
export class DbNgxTwoColumnsColumnHeadComponent {

  @Input()
  block?: boolean;

  @Input()
  full?: boolean;

}
