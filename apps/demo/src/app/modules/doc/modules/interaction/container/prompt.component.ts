import { DbxPromptConfirmDialogComponent, DbxContentContainerDirective, DbxContentBorderDirective, DbxPromptComponent, DbxPromptBoxDirective, DbxPromptPageComponent } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { Component, inject, signal, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { first } from 'rxjs';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton, MatAnchor } from '@angular/material/button';

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
