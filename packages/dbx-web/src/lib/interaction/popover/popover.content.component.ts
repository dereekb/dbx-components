import { BehaviorSubject } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { Component, Input } from '@angular/core';
import { ResizedEvent } from 'angular-resize-event';
import { throttleTime } from 'rxjs/operators';

/**
 * Popover content wrapper component.
 */
@Component({
  selector: 'dbx-popover-content',
  template: `
  <div class="dbx-popover-content" (resized)="onResized($event)" [style.--popoverh]="height$ | async">
    <ng-content select="[controls]"></ng-content>
    <div class="dbx-popover-content-container" [ngClass]="{ 'dbx-popover-content-container-scrollable': scrollable }">
      <ng-content></ng-content>
    </div>
  </div>
`,
  styleUrls: ['./popover.scss']
})
export class DbNgxPopoverContentComponent implements OnDestroy {

  private readonly _height = new BehaviorSubject<string>('');
  readonly height$ = this._height.asObservable().pipe(throttleTime(100, undefined, { leading: true, trailing: true }));

  @Input()
  scrollable = false;

  @Input()
  hasControls = false;

  @Input()
  hasHeader = false;

  onResized(event: ResizedEvent): void {
    this._height.next(`${event.newRect.height}px`);
  }

  ngOnDestroy(): void {
    this._height.complete();
  }

}
