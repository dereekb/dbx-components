import { BehaviorSubject, throttleTime } from 'rxjs';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type ResizedEvent } from '../../screen/resize';
import { DbxResizedDirective } from '../../screen/resize.directive';
import { completeOnDestroy } from '@dereekb/dbx-core';

/**
 * Wraps popover body content, providing a resizable container that tracks its height for dynamic sizing.
 *
 * Supports a `[controls]` content projection slot for popover control elements.
 *
 * @example
 * ```html
 * <dbx-popover-content>
 *   <dbx-popover-controls controls></dbx-popover-controls>
 *   <p>Popover body content here.</p>
 * </dbx-popover-content>
 * ```
 */
@Component({
  selector: 'dbx-popover-content',
  template: `
    <div class="d-block dbx-popover-content" (dbxResized)="onResized($event)" [style.--popoverh]="heightSignal()">
      <ng-content select="[controls]"></ng-content>
      <div class="dbx-popover-content-container">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  imports: [DbxResizedDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverContentComponent {
  readonly hasControls = completeOnDestroy(new BehaviorSubject<boolean>(false));
  readonly hasHeader = completeOnDestroy(new BehaviorSubject<boolean>(false));

  private readonly _height = completeOnDestroy(new BehaviorSubject<string>(''));
  readonly height$ = this._height.asObservable().pipe(throttleTime(100, undefined, { leading: true, trailing: true }));

  readonly heightSignal = toSignal(this.height$);

  onResized(event: ResizedEvent): void {
    this._height.next(`${event.newRect.height}px`);
  }
}
