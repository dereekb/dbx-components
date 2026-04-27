import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_SETTINGS_SECTION: UiExamplePattern = {
  slug: 'settings-section',
  name: 'Settings section',
  summary: 'A dbx-section with header, form body, and a save button bar at the bottom.',
  usesUiSlugs: ['section', 'bar', 'button', 'button-spacer'],
  snippets: {
    minimal: `<dbx-section header="Account">
  <p>Body</p>
  <dbx-bar>
    <dbx-button text="Save" raised color="primary" [dbxAction]="saveAction"></dbx-button>
  </dbx-bar>
</dbx-section>`,
    brief: `<dbx-section header="Account" icon="person" hint="Update your profile and security settings">
  <!-- Form body -->
  <ng-container [formGroup]="form">
    <mat-form-field>
      <input matInput placeholder="Name" formControlName="name" />
    </mat-form-field>
  </ng-container>

  <dbx-bar>
    <dbx-button text="Save changes" raised color="primary" [dbxAction]="saveAction"></dbx-button>
    <dbx-button-spacer></dbx-button-spacer>
    <dbx-button text="Cancel" stroked (btnClick)="cancel()"></dbx-button>
  </dbx-bar>
</dbx-section>`,
    full: `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DbxSectionComponent, DbxBarDirective, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [DbxSectionComponent, DbxBarDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxActionDirective, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: \`
    <dbx-section header="Account" icon="person" hint="Update your profile">
      <ng-container [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
      </ng-container>

      <dbx-bar>
        <dbx-button text="Save changes" raised color="primary" [dbxAction]="saveAction"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button text="Cancel" stroked (btnClick)="cancel()"></dbx-button>
      </dbx-bar>
    </dbx-section>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSettingsComponent {
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.group({ name: [''] });
  readonly saveAction = /* ... */ null;

  cancel(): void { /* ... */ }
}`
  },
  notes: 'Wrap multiple sections in a `dbx-content-container` for consistent page padding. Use `dbx-subsection` to nest related groups under a single `dbx-section`.'
};
