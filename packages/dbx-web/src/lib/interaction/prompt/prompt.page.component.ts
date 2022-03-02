import { Component } from '@angular/core';

@Component({
  selector: 'dbx-prompt-page',
  template: `
    <dbx-content-container width="full">
      <div class="dbx-prompt-page-content-wrap">
        <ng-content></ng-content>
      </div>
    </dbx-content-container>
  `,
  host: {
    'class': 'd-block dbx-prompt-page'
  }
})
export class DbxPromptPageComponent { }
