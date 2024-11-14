import { Component, inject } from '@angular/core';
import { DbxBodyDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './structure.component.html'
})
export class DocExtensionStructureComponent {
  readonly dbxBody = inject(DbxBodyDirective);
}
