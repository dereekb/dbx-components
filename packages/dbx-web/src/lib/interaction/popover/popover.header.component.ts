import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { DbxPopoverContentComponent } from './popover.content.component';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { Maybe } from '@dereekb/util';

/**
 * Component used to format a header for a popover.
 */
@Component({
  selector: 'dbx-popover-header',
  template: `
    <div class="dbx-popover-header">
      <div class="dbx-popover-header-content">
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
  imports: [MatIcon, MatDivider],
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
