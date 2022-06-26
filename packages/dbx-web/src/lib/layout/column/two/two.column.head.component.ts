import { Component, Input } from '@angular/core';

/**
 * Two Columns related component that sits at the top of the content bodies and wraps content.
 */
@Component({
  selector: 'dbx-two-column-head',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-two-column-head',
    '[class.dbx-block]': 'block',
    '[class.full]': 'full'
  }
})
export class DbxTwoColumnColumnHeadComponent {
  @Input()
  block?: boolean;

  @Input()
  full?: boolean;
}
