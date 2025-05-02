import { Component } from '@angular/core';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';

@Component({
  template: `
    <dbx-two-column-right right>
      <p>Right content.</p>
    </dbx-two-column-right>
  `,
  standalone: true,
  imports: [DbxTwoColumnRightComponent]
})
export class DocLayoutTwoColumnsChildComponent {}
