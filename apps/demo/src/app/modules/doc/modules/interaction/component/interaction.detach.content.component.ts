import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { DbxDetachContentComponent, DbxDetachControlsComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'doc-interaction-example-detach-content',
  template: `
    <dbx-detach-content>
      <dbx-detach-controls controls [header]="'Example Detach'"></dbx-detach-controls>
      <div class="doc-detach-content-body">
        <p>Detach Content</p>
        <p>Counter: {{ counter }}</p>
        <p class="hint">Increment the counter, then detach/attach to verify state is preserved.</p>
        <button mat-raised-button (click)="counter = counter + 1">Increment</button>
      </div>
    </dbx-detach-content>
  `,
  styles: [
    `
      .doc-detach-content-body {
        padding: 16px;
      }
      .hint {
        font-size: 12px;
        opacity: 0.7;
      }
    `
  ],
  standalone: true,
  imports: [MatButton, DbxDetachContentComponent, DbxDetachControlsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionExampleDetachContentComponent {
  counter = 0;
}
