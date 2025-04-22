import { Directive, input } from '@angular/core';

@Directive({
  selector: 'dbx-prompt-box, [dbxPromptBox]',
  host: {
    class: 'd-block dbx-prompt-box',
    '[class.elevate]': 'elevate()'
  },
  standalone: true
})
export class DbxPromptBoxDirective {
  readonly elevate = input<boolean>(true);
}
