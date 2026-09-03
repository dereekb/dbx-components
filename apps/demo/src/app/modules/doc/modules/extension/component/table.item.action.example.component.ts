import { Component } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DbxButtonSpacerDirective } from '@dereekb/dbx-web';

@Component({
  template: `
    <div class="doc-example-table-action-cell dbx-flex-center">
      <button mat-icon-button><mat-icon>thumb_up</mat-icon></button>
      <dbx-button-spacer></dbx-button-spacer>
      <button mat-icon-button><mat-icon>thumb_down</mat-icon></button>
    </div>
  `,
  styleUrls: ['./table.item.action.example.scss'],
  imports: [MatIconButton, MatIcon, DbxButtonSpacerDirective]
})
export class DocExtensionTableItemActionExampleComponent {}
