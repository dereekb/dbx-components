import { DbxPromptConfirmDialogComponent } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { first } from 'rxjs';

@Component({
  templateUrl: './prompt.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionPromptComponent {
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
