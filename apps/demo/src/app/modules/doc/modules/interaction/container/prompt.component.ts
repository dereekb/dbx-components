import { DbxPromptConfirmDialogComponent } from '@dereekb/dbx-web';
import { MatDialog } from '@angular/material/dialog';
import { Component, inject } from '@angular/core';
import { first } from 'rxjs';

@Component({
  templateUrl: './prompt.component.html'
})
export class DocInteractionPromptComponent {
  readonly matDialog = inject(MatDialog);

  result?: boolean;

  ngAfterViewInit(): void {
    setTimeout(() => this.openExamplePrompt(), 100);
  }

  openExamplePrompt() {
    DbxPromptConfirmDialogComponent.openDialog(this.matDialog)
      .afterClosed()
      .pipe(first())
      .subscribe((x) => {
        this.result = x;
      });
  }
}
