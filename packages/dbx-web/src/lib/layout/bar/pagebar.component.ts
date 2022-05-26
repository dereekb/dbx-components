import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

@Component({
  selector: 'dbx-pagebar',
  templateUrl: './pagebar.component.html'
})
export class DbxPagebarComponent {
  @Input()
  color?: Maybe<DbxBarColor>;
}
