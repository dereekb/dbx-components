import { safeDetectChanges } from '@dereekb/dbx-core';
import { type NgPopoverCloseEvent } from 'ng-overlay-container';
import { ChangeDetectorRef, ElementRef, Component, inject, type AfterViewInit, viewChild } from '@angular/core';
import { DbxPopoverService, DbxContentContainerDirective, DbxSpacerDirective } from '@dereekb/dbx-web';
import { DocInteractionExamplePopoverComponent } from '../component/interaction.popover.component';
import { first } from 'rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { MatButton } from '@angular/material/button';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './popover.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, FlexModule, MatButton, DbxSpacerDirective, JsonPipe]
})
export class DocInteractionPopoverComponent implements AfterViewInit {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly dbxPopoverService = inject(DbxPopoverService);

  result?: NgPopoverCloseEvent<number>;

  readonly popoverOrigin = viewChild.required('popoverOrigin', { read: ElementRef });

  readonly buttonPopoverOrigin = viewChild.required('buttonPopoverOrigin', { read: ElementRef });

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePopover(), 100);
  }

  openExamplePopoverOnButton(key?: string) {
    this.openExamplePopover(key, this.buttonPopoverOrigin());
  }

  openExamplePopover(key?: string, origin = this.popoverOrigin()) {
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
