import { Component } from '@angular/core';

@Component({
  selector: 'dbx-prompt-page',
  template: `
    <div class="prompt-page">
      <dbx-content-container width="full">
        <div class="prompt-page-content-wrap">
          <ng-content></ng-content>
        </div>
      </dbx-content-container>
    </div>
  `,
  // TODO: styleUrls: ['./prompt.scss']
})
export class DbxPromptPageComponent { }
