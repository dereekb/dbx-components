import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Pre-configured prompt.
 */
@Component({
  selector: 'dbx-prompt',
  template: `
    <ng-content select="[hero]"></ng-content>
    <dbx-subsection [header]="header" [hint]="prompt">
      <ng-content></ng-content>
    </dbx-subsection>
  `,
  host: {
    'class': 'd-block dbx-prompt'
  }
})
export class DbxPromptComponent {

  @Input()
  header?: Maybe<string>;

  @Input()
  prompt?: Maybe<string>;

}
