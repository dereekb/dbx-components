import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';

@Component({
  template: `
    <dbx-two-column-right right>
      <p>Right content.</p>
    </dbx-two-column-right>
  `,
  imports: [DbxTwoColumnRightComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutTwoColumnsChildComponent {}
