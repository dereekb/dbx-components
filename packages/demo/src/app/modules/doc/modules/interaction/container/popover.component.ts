import { safeDetectChanges } from '@dereekb/dbx-core';
import { NgPopoverCloseEvent } from 'ng-overlay-container';
import { ChangeDetectorRef, ElementRef, Component, ViewChild } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DocInteractionExamplePopoverComponent } from '../component/interaction.popover.component';
import { first } from 'rxjs';

@Component({
  templateUrl: './popover.component.html'
})
export class DocInteractionPopoverComponent {

  result?: NgPopoverCloseEvent<number>;

  @ViewChild('popoverOrigin', { read: ElementRef })
  popoverOrigin!: ElementRef;

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  constructor(readonly popoverService: DbxPopoverService, readonly cdRef: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePopover(), 100);
  }

  openExamplePopoverOnButton(key?: string) {
    this.openExamplePopover(key, this.buttonPopoverOrigin);
  }

  openExamplePopover(key?: string, origin = this.popoverOrigin) {
    DocInteractionExamplePopoverComponent.openPopover(this.popoverService, {
      origin,
      config: {}
    }, key).afterClosed$.pipe(first()).subscribe((x) => {
      this.result = x;
      safeDetectChanges(this.cdRef);
    });
  }

}
