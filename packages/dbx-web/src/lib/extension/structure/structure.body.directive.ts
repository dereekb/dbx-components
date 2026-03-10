import { Directive } from '@angular/core';
import { DbxStructureDirective } from './structure.structure.directive';

/**
 * Specialized {@link DbxStructureDirective} intended for the application body element. Provides itself as a `DbxStructureDirective` so child components can inject a reference to the body's injector and element.
 *
 * @example
 * ```html
 * <div dbxBody>
 *   <!-- App content that can inject DbxStructureDirective -->
 * </div>
 * ```
 */
@Directive({
  selector: 'dbxBody,[dbxBody]',
  providers: [
    {
      provide: DbxStructureDirective,
      useExisting: DbxBodyDirective
    }
  ],
  standalone: true
})
export class DbxBodyDirective extends DbxStructureDirective {}
