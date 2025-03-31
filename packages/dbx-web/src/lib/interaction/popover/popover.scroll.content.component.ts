import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';
import { toSignal } from '@angular/core/rxjs-interop';

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
    '[class]': 'sizingClassesSignal()'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverScrollContentComponent {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent);

  readonly hasControlsSignal = toSignal(this.appPopoverContentComponent.hasControls);
  readonly hasHeaderSignal = toSignal(this.appPopoverContentComponent.hasHeader);

  readonly sizingClassesSignal = computed(() => {
    const hasHeader = this.hasHeaderSignal();
    const hasControls = this.hasControlsSignal();

    const classes: string[] = [];

    if (hasHeader && hasControls) {
      classes.push('popover-has-controls-and-header');
    } else if (hasHeader) {
      classes.push('popover-has-header');
    } else if (hasControls) {
      classes.push('popover-has-controls');
    }

    return classes.join(' ');
  });
}
