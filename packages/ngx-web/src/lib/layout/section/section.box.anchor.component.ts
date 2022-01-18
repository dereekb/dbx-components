import { Component, Input } from '@angular/core';
import { ClickableAnchor } from '@dereekb/ngx-core';

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
  styleUrls: ['./container.scss']
})
export class DbNgxSectionBoxAnchorComponent {

  @Input()
  anchor?: ClickableAnchor;

  @Input()
  disabled: boolean = false;

}
