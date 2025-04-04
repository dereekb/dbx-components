import { safeDetectChanges } from '@dereekb/dbx-core';
import { NgPopoverCloseEvent } from 'ng-overlay-container';
import { ChangeDetectorRef, ElementRef, Component, ViewChild, inject, AfterViewInit } from '@angular/core';
import { DbxPopoverService } from '@dereekb/dbx-web';
import { DocInteractionExamplePopoverComponent } from '../component/interaction.popover.component';
import { first } from 'rxjs';

@Component({
  templateUrl: './popover.component.html'
})
export class DocInteractionPopoverComponent implements AfterViewInit {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly dbxPopoverService = inject(DbxPopoverService);

  result?: NgPopoverCloseEvent<number>;

  @ViewChild('popoverOrigin', { read: ElementRef })
  popoverOrigin!: ElementRef;

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePopover(), 100);
  }

  openExamplePopoverOnButton(key?: string) {
    this.openExamplePopover(key, this.buttonPopoverOrigin);
  }

  openExamplePopover(key?: string, origin = this.popoverOrigin) {
    DocInteractionExamplePopoverComponent.openPopover(
      this.dbxPopoverService,
      {
        origin
      },
      key
    )
      .afterClosed$.pipe(first())
      .subscribe((x) => {
        this.result = x;
        safeDetectChanges(this.cdRef);
      });
  }
}
