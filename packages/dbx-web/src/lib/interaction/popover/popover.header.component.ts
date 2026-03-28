import { ChangeDetectionStrategy, Component, type OnInit, inject, input } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { type Maybe } from '@dereekb/util';

/**
 * Renders a formatted header bar for a popover with an optional icon and projected action content.
 *
 * @example
 * ```html
 * <dbx-popover-header [header]="'Settings'" [icon]="'settings'">
 *   <dbx-popover-close-button></dbx-popover-close-button>
 * </dbx-popover-header>
 * ```
 */
@Component({
  selector: 'dbx-popover-header',
  template: `
    <div class="dbx-popover-header">
      <div class="dbx-popover-header-content dbx-flex-bar">
        <h3>
          @if (icon()) {
            <mat-icon class="dbx-icon-spacer">{{ icon() }}</mat-icon>
          }
          {{ header() }}
        </h3>
        <span class="spacer"></span>
        <ng-content></ng-content>
      </div>
    </div>
    <mat-divider></mat-divider>
  `,
  imports: [MatIconModule, MatDivider],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverHeaderComponent implements OnInit {
  readonly appPopoverContentComponent = inject(DbxPopoverContentComponent, { optional: true });

  readonly header = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();

  ngOnInit() {
    if (this.appPopoverContentComponent) {
      this.appPopoverContentComponent.hasHeader.next(true);
    }
  }
}
