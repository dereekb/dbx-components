import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';

@Component({
  selector: 'dbx-firebase-development-popup-content',
  templateUrl: './development.popup.content.component.html'
})
export class DbxFirebaseDevelopmentPopupContentComponent implements OnDestroy {
  @Output()
  readonly shouldClose = new EventEmitter<void>();

  ngOnDestroy(): void {
    this.shouldClose.complete();
  }
}
