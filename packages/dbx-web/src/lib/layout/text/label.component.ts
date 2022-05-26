import { Component } from '@angular/core';

@Component({
  selector: 'dbx-label',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-label'
  }
})
export class DbxLabelComponent {}
