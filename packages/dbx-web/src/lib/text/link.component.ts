import { Component, Input, OnInit } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-link',
  template: `<span class="dbx-link"><dbx-anchor [anchor]="anchor"><ng-content></ng-content></dbx-anchor></span>`,
  // TODO: styleUrls: ['./text.scss']
})
export class DbNgxLinkComponent {

  @Input()
  anchor?: ClickableAnchor;

  @Input()
  set ref(ref: string) {
    if (ref) {
      this.anchor = {
        ref
      };
    }
  }

  @Input()
  set href(href: string) {
    if (href) {
      this.anchor = {
        url: href
      };
    }
  }

}
