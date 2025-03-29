import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { ReadableError } from '@dereekb/util';
import { AbstractPopoverDirective } from '../interaction/popover/abstract.popover.directive';
import { DbxPopoverKey } from '../interaction/popover/popover';
import { DbxPopoverService } from '../interaction/popover/popover.service';
import { DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentComponent } from '../interaction';
import { DbxErrorDetailsComponent } from './error.details.component';

export const DEFAULT_ERROR_POPOVER_KEY = 'error';

export interface DbxErrorPopoverConfig {
  readonly origin: ElementRef;
  readonly error: ReadableError;
}

@Component({
  template: `
    <dbx-popover-content class="dbx-error-popover">
      <dbx-popover-header [header]="code" icon="error"></dbx-popover-header>
      <dbx-popover-scroll-content>
        <dbx-error-details [error]="error"></dbx-error-details>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentComponent, DbxErrorDetailsComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorPopoverComponent extends AbstractPopoverDirective<void, ReadableError> {
  get error() {
    return this.popover.data as ReadableError;
  }

  get code() {
    return this.error.code;
  }

  static openPopover(popoverService: DbxPopoverService, { origin, error }: DbxErrorPopoverConfig, popoverKey?: DbxPopoverKey) {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_ERROR_POPOVER_KEY,
      origin,
      isResizable: true,
      componentClass: DbxErrorPopoverComponent,
      data: error
    });
  }
}
