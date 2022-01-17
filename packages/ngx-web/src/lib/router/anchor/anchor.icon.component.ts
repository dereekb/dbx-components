import { Component, Input } from '@angular/core';
import { ClickableIconAnchorLink } from './anchor';

/**
 * Component that displays an anchor and a mat-button.
 */
@Component({
  selector: 'app-anchor-icon',
  template: `
  <app-anchor [anchor]="anchor">
    <button mat-icon-button><mat-icon>{{ anchor.icon }}</mat-icon></button>
  </app-anchor>
`
})
export class AppAnchorIconComponent {

  @Input()
  anchor: ClickableIconAnchorLink;

}
