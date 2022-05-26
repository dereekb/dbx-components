import { Component } from '@angular/core';

@Component({
  selector: 'dbx-note',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-note'
  }
})
export class DbxNoteComponent {}
