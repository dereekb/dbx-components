import { Component } from '@angular/core';
import { DbxTableColumn } from '@dereekb/dbx-web/table';
import { DatePipe } from '@angular/common';

@Component({
  template: `
    <div class="dbx-text-center">
      <div class="dbx-small dbx-hint">Column Footer</div>
      <div class="dbx-small dbx-hint">{{ column.meta | date: 'MMM d, y' }}</div>
    </div>
  `,
  imports: [DatePipe],
  standalone: true
})
export class DocExtensionTableColumnFooterExampleComponent {
  column!: DbxTableColumn<Date>;
}
