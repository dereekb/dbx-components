import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Combines a dbx-label and arbitrary content.
 */
@Component({
  selector: 'dbx-label-block',
  template: `
    <dbx-label class="d-block dbx-label-padded">{{ header }}</dbx-label>
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-label-block'
  }
})
export class DbxLabelBlockComponent {
  @Input()
  header?: Maybe<string>;
}
