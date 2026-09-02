import { Component, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { UIView } from '@uirouter/angular';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [UIView, DbxAppContextStateDirective]
})
export class AppLayoutComponent {}
