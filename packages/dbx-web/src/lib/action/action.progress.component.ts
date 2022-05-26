import { Component } from '@angular/core';

@Component({
  selector: 'dbx-action-progress',
  template: `
    <dbx-loading-progress *dbxActionIsWorking [linear]="true"></dbx-loading-progress>
  `
})
export class DbxActionProgressComponent {}
