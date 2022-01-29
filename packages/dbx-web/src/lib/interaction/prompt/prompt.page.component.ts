import { Component } from '@angular/core';

@Component({
  selector: 'dbx-prompt-page',
  template: `
    <div class="prompt-page">
      <dbx-full-width-content-container>
        <div class="prompt-page-content-wrap">
          <ng-content></ng-content>
        </div>
      </dbx-full-width-content-container>
    </div>
  `,
  // TODO: styleUrls: ['./prompt.scss']
})
export class DbNgxPromptPageComponent { }
