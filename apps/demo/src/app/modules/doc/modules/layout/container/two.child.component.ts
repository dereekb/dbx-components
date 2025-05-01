import { Component } from '@angular/core';
import { DbxTwoColumnRightComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.right.component';

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
