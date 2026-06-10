import { Injectable, type Signal, inject, signal } from '@angular/core';
import { type DbxStyleDemoSection, type DbxStyleDemoSectionGroup } from './section';
import { DBX_STYLE_DEMO_SECTION_GROUP } from './section.providers';

/**
 * Root service that flattens every {@link DbxStyleDemoSectionGroup} registered via {@link provideDbxStyleDemoSections}
 * into a single ordered list of {@link DbxStyleDemoSection} entries.
 *
 * Consumed by the `<dbx-style-demo>` playground to determine which sections are available to render.
 */
@Injectable({ providedIn: 'root' })
export class DbxStyleDemoSectionRegistry {
  /**
   * All registered sections, in library-registration then section-declaration order.
   */
  readonly sectionsSignal: Signal<DbxStyleDemoSection[]>;

  constructor() {
    const groups = inject<DbxStyleDemoSectionGroup[]>(DBX_STYLE_DEMO_SECTION_GROUP, { optional: true }) ?? [];
    this.sectionsSignal = signal(groups.flatMap((group) => group.sections));
  }
}
