import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';

/**
 * Popover scrollable content wrapper component.
 */
@Component({
  selector: 'dbx-popover-scroll-content',
  template: `
    <ng-content></ng-content>
  `,
  host: {
    class: 'd-block dbx-popover-scroll-content',
    '[class]': 'sizingClasses'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverScrollContentComponent {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent);

  get sizingClasses(): string {
    const hasHeader = this.hasHeader;
    const hasControls = this.hasControls;

    const classes: string[] = [];

    if (hasHeader && hasControls) {
      classes.push('popover-has-controls-and-header');
    } else if (hasHeader) {
      classes.push('popover-has-header');
    } else if (hasControls) {
      classes.push('popover-has-controls');
    }

    return classes.join(' ');
  }

  get hasHeader(): boolean {
    return this.appPopoverContentComponent.hasHeader;
  }

  get hasControls(): boolean {
    return this.appPopoverContentComponent.hasControls;
  }
}
