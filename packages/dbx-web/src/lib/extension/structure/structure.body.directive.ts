import { Directive } from '@angular/core';
import { DbxStructureDirective } from './structure.structure.directive';

/**
 * DbxStructureDirective used specifically on the body of the app.
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
