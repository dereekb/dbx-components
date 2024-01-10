import { Component } from '@angular/core';
import { DbxBodyDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './structure.component.html'
})
export class DocExtensionStructureComponent {
  constructor(readonly dbxBody: DbxBodyDirective) {}
}
