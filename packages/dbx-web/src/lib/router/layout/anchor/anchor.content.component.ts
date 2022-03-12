import { Component, Input } from '@angular/core';
import { ClickableAnchorLink } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Component that displays an anchor and a span with the title.
 */
@Component({
  selector: 'dbx-anchor-content',
  template: `<mat-icon *ngIf="anchor?.icon">{{ anchor?.icon }}</mat-icon><span *ngIf="anchor?.title">{{ anchor?.title }}</span>`
})
export class DbxAnchorContentComponent {

  @Input()
  anchor: Maybe<Partial<ClickableAnchorLink>>;

}
