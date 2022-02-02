import { Input, Component } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Component that displays a list of ClickableAnchorLink values within a MatNavList.
 */
@Component({
  selector: 'dbx-anchor-list',
  templateUrl: './anchorlist.component.html'
})
export class DbxAnchorListComponent {

  @Input()
  anchors?: Maybe<ClickableAnchorLink[]>;

}
