import { Component, Input } from '@angular/core';

@Component({
  selector: 'dbx-prompt-box',
  template: `
    <div class="prompt-box" [ngClass]="{ 'elevated': elevated, 'full-width': fullWidth, 'no-padding': noPadding }">
      <ng-content></ng-content>
    </div>
  `,
  // TODO: styleUrls: ['./prompt.scss']
})
export class DbNgxPromptBoxComponent {

  @Input()
  elevated = true;

  @Input()
  fullWidth = false;

  @Input()
  noPadding = false;

}
