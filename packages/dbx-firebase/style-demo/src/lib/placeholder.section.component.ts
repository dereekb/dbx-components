import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Phase 1 placeholder section for the `@dereekb/dbx-firebase/style-demo` plumbing.
 *
 * Confirms the plumbing wires a `dbx-firebase` section group into the `<dbx-style-demo>` playground. Real
 * Firebase-styling sections arrive in a later phase.
 */
@Component({
  selector: 'dbx-firebase-style-demo-placeholder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-p3">
      <div class="dbx-text-title-medium dbx-mb1">dbx-firebase</div>
      <p class="dbx-hint">Firebase styling sections are coming in a later phase.</p>
    </div>
  `
})
export class DbxFirebaseStyleDemoPlaceholderSectionComponent {}
