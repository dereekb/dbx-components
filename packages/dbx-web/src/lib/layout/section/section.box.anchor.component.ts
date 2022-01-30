import { Component, Input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';

/**
 * Component used to wrap sectional content on an elevated box that is clickable.
 */
@Component({
  selector: 'dbx-section-box-anchor',
  template: `
  <dbx-anchor [anchor]="anchor" [disabled]="disabled">
    <div matRipple [matRippleDisabled]="disabled" class="dbx-section-box">
      <ng-content></ng-content>
    </div>
  </dbx-anchor>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbxSectionBoxAnchorComponent {

  @Input()
  anchor?: ClickableAnchor;

  @Input()
  disabled: boolean = false;

}
