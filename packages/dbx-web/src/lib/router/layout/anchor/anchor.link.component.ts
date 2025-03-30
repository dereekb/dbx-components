import { Component, Input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Pre-styled text that can link to either a website or a ref using a dbx-anchor.
 */
@Component({
  selector: 'dbx-link',
  standalone: true,
  imports: [DbxAnchorComponent],
  template: `
    <dbx-anchor [anchor]="anchor">
      <ng-content></ng-content>
    </dbx-anchor>
  `,
  host: {
    class: 'd-inline dbx-link'
  }
})
export class DbxLinkComponent {
  @Input()
  anchor?: Maybe<ClickableAnchor>;

  @Input()
  set ref(ref: Maybe<string>) {
    if (ref) {
      this.anchor = {
        ref
      };
    }
  }

  @Input()
  set href(href: Maybe<string>) {
    if (href) {
      this.anchor = {
        url: href
      };
    }
  }
}
