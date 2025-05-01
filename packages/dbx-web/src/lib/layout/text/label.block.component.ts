import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Combines a dbx-label and arbitrary content.
 */
@Component({
  selector: 'dbx-label-block',
  template: `
    <span class="d-block dbx-label dbx-label-padded">{{ header() }}</span>
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-label-block'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxLabelBlockComponent {
  readonly header = input<Maybe<string>>();
}
