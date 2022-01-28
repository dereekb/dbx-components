import { Component, Input } from '@angular/core';
import { DbNgxPromptBoxComponent } from './prompt.box.component';

/**
 * Pre-configured prompt.
 */
@Component({
  selector: 'dbx-prompt',
  templateUrl: './prompt.component.html',
  // TODO: styleUrls: ['./prompt.scss']
})
export class DbNgxPromptComponent extends DbNgxPromptBoxComponent {

  @Input()
  header?: string;

  @Input()
  prompt?: string;

}
