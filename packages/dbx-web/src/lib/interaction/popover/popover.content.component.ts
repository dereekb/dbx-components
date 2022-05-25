import { BehaviorSubject } from 'rxjs';
import { OnDestroy } from '@angular/core';
import { Component } from '@angular/core';
import { ResizedEvent } from 'angular-resize-event';
import { throttleTime } from 'rxjs';

/**
 * Popover content wrapper component.
 */
@Component({
  selector: 'dbx-popover-content',
  template: `
  <div class="d-block dbx-popover-content" (resized)="onResized($event)" [style.--popoverh]="height$ | async">
    <ng-content select="[controls]"></ng-content>
    <div class="dbx-popover-content-container">
      <ng-content></ng-content>
    </div>
  </div>
`
})
export class DbxPopoverContentComponent implements OnDestroy {

  private readonly _height = new BehaviorSubject<string>('');
  readonly height$ = this._height.asObservable().pipe(throttleTime(100, undefined, { leading: true, trailing: true }));

  hasControls = false;
  hasHeader = false;

  onResized(event: ResizedEvent): void {
    this._height.next(`${event.newRect.height}px`);
  }

  ngOnDestroy(): void {
    this._height.complete();
  }

}
