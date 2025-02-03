import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Pre-configured prompt.
 */
@Component({
  selector: 'dbx-prompt',
  template: `
    <div class="dbx-prompt">
      <ng-content select="[hero]"></ng-content>
      <dbx-subsection [header]="header" [hint]="prompt">
        <ng-content></ng-content>
      </dbx-subsection>
    </div>
  `
})
export class DbxPromptComponent {
  @Input()
  header?: Maybe<string>;

  @Input()
  prompt?: Maybe<string>;
}
