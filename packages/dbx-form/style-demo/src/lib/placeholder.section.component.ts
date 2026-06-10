import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Phase 1 placeholder section for the `@dereekb/dbx-form/style-demo` plumbing.
 *
 * Confirms the plumbing wires a `dbx-form` section group into the `<dbx-style-demo>` playground. Real form-styling
 * sections (field surfaces, validation states, etc.) arrive in a later phase.
 */
@Component({
  selector: 'dbx-form-style-demo-placeholder-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dbx-p3">
      <div class="dbx-text-title-medium dbx-mb1">dbx-form</div>
      <p class="dbx-hint">Form styling sections are coming in a later phase.</p>
    </div>
  `
})
export class DbxFormStyleDemoPlaceholderSectionComponent {}
