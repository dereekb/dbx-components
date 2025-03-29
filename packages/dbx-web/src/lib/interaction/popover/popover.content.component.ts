import { BehaviorSubject, throttleTime } from 'rxjs';
import { OnDestroy, Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { AngularResizeEventModule, ResizedEvent } from 'angular-resize-event-package';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Popover content wrapper component.
 */
@Component({
  selector: 'dbx-popover-content',
  template: `
    <div class="d-block dbx-popover-content" (resized)="onResized($event)" [style.--popoverh]="heightSignal()">
      <ng-content select="[controls]"></ng-content>
      <div class="dbx-popover-content-container">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  imports: [AngularResizeEventModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPopoverContentComponent implements OnDestroy {
  private readonly _height = new BehaviorSubject<string>('');
  readonly height$ = this._height.asObservable().pipe(throttleTime(100, undefined, { leading: true, trailing: true }));

  private readonly _heightSignal = toSignal(this.height$);
  readonly heightSignal = this._heightSignal;

  hasControls = false;
  hasHeader = false;

  onResized(event: ResizedEvent): void {
    this._height.next(`${event.newRect.height}px`);
  }

  ngOnDestroy(): void {
    this._height.complete();
  }
}
