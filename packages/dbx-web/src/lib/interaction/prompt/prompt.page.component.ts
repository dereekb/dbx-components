import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../layout/content/content.container.directive';

@Component({
  selector: 'dbx-prompt-page',
  template: `
    <dbx-content-container grow="full">
      <div class="dbx-prompt-page-content-wrap">
        <ng-content></ng-content>
      </div>
    </dbx-content-container>
  `,
  host: {
    class: 'd-block dbx-prompt-page'
  },
  imports: [DbxContentContainerDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptPageComponent {}
