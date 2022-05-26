import { Component, Input } from '@angular/core';

@Component({
  selector: 'dbx-prompt-box',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'd-block dbx-prompt-box',
    '[class.elevated]': 'elevated'
  }
})
export class DbxPromptBoxComponent {
  @Input()
  elevated = true;
}
