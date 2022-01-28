import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
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
  header?: Maybe<string>;

  @Input()
  prompt?: Maybe<string>;

}
