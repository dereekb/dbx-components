import { Observable, BehaviorSubject, map } from 'rxjs';
import { Component, Directive, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
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
  ]
})
export class DbxBodyDirective extends DbxStructureDirective {}
