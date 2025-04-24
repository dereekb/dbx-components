import { Component, ViewEncapsulation, inject, ChangeDetectionStrategy } from '@angular/core';
import { UIView } from '@uirouter/angular';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UIView, DbxAppContextStateDirective],
  standalone: true
})
export class AppLayoutComponent {}
