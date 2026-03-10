import { ChangeDetectionStrategy, Component, type ElementRef } from '@angular/core';
import { type ReadableError } from '@dereekb/util';
import { AbstractPopoverDirective } from '../interaction/popover/abstract.popover.directive';
import { type DbxPopoverKey } from '../interaction/popover/popover';
import { type DbxPopoverService } from '../interaction/popover/popover.service';
import { DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective } from '../interaction';
import { DbxErrorDetailsComponent } from './error.details.component';

/**
 * Default popover key used when opening an error popover.
 */
export const DEFAULT_ERROR_POPOVER_KEY = 'error';

/**
 * Configuration for opening an error popover via {@link DbxErrorPopoverComponent.openPopover}.
 */
export interface DbxErrorPopoverConfig {
  /** The element that the popover should be anchored to. */
  readonly origin: ElementRef;
  /** The error to display in the popover. */
  readonly error: ReadableError;
}

/**
 * Popover component that displays detailed error information including the error code and widget details.
 *
 * Opened programmatically via the static {@link DbxErrorPopoverComponent.openPopover} method rather than
 * being used directly in templates.
 *
 * @example
 * ```typescript
 * DbxErrorPopoverComponent.openPopover(popoverService, {
 *   origin: elementRef,
 *   error: readableError
 * });
 * ```
 */
@Component({
  template: `
    <dbx-popover-content class="dbx-error-popover">
      <dbx-popover-header [header]="code" icon="error"></dbx-popover-header>
      <dbx-popover-scroll-content>
        <dbx-error-details [error]="error"></dbx-error-details>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentDirective, DbxErrorDetailsComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorPopoverComponent extends AbstractPopoverDirective<void, ReadableError> {
  readonly error = this.popover.data as ReadableError;
  readonly code = this.error.code;

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
