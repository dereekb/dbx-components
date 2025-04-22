import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxSubSectionComponent } from '../../layout/section/subsection.component';

/**
 * Pre-configured prompt.
 */
@Component({
  selector: 'dbx-prompt',
  template: `
    <div class="dbx-prompt">
      <ng-content select="[hero]"></ng-content>
      <dbx-subsection [header]="header()" [hint]="prompt()">
        <ng-content></ng-content>
      </dbx-subsection>
    </div>
  `,
  standalone: true,
  imports: [DbxSubSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptComponent {
  readonly header = input<Maybe<string>>();
  readonly prompt = input<Maybe<string>>();
}
