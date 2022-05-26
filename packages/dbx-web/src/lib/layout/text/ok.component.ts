import { Component } from '@angular/core';

@Component({
  selector: 'dbx-ok',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-ok'
  }
})
export class DbxOkComponent {}
