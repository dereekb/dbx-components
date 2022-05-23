import { Component } from '@angular/core';

@Component({
  selector: 'dbx-warn',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'dbx-warn'
  }
})
export class DbxWarnComponent {}
