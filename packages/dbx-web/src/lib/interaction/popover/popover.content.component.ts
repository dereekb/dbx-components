import { BehaviorSubject, throttleTime } from 'rxjs';
import { OnDestroy, Component, ChangeDetectionStrategy } from '@angular/core';
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
  readonly hasControls = new BehaviorSubject<boolean>(false);
  readonly hasHeader = new BehaviorSubject<boolean>(false);

  private readonly _height = new BehaviorSubject<string>('');
  readonly height$ = this._height.asObservable().pipe(throttleTime(100, undefined, { leading: true, trailing: true }));

  readonly heightSignal = toSignal(this.height$);

  onResized(event: ResizedEvent): void {
    this._height.next(`${event.newRect.height}px`);
  }

  ngOnDestroy(): void {
    this.hasControls.complete();
    this.hasHeader.complete();
    this._height.complete();
  }
}
