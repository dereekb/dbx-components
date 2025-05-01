import { DbxPromptConfirmDialogComponent } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { Component, inject, signal, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { first } from 'rxjs';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatAnchor } from '@angular/material/button';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxPromptComponent } from '@dereekb/dbx-web';
import { DbxPromptBoxDirective } from '@dereekb/dbx-web';
import { DbxPromptPageComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './prompt.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxContentBorderDirective, DbxPromptComponent, MatAnchor, DbxPromptBoxDirective, DbxPromptPageComponent]
})
export class DocInteractionPromptComponent implements AfterViewInit {
  readonly matDialog = inject(MatDialog);

  private readonly _resultSignal = signal<boolean | undefined>(undefined);
  readonly result = this._resultSignal;

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePrompt(), 100);
  }

  openExamplePrompt() {
    DbxPromptConfirmDialogComponent.openDialog(this.matDialog)
      .afterClosed()
      .pipe(first())
      .subscribe((x) => {
        this._resultSignal.set(x);
      });
  }
}
