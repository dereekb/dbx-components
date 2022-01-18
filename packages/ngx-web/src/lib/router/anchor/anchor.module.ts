import { DbNgxInjectedComponentModule } from '@dereekb/ngx-core';
import { NgModule } from '@angular/core';
import { DbNgxAnchorComponent } from './anchor.component';
import { CommonModule } from '@angular/common';
import { DbNgxAnchorIconComponent } from './anchor.icon.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbNgxInjectedComponentModule
  ],
  declarations: [
    DbNgxAnchorComponent,
    DbNgxAnchorIconComponent
  ],
  exports: [
    DbNgxAnchorComponent,
    DbNgxAnchorIconComponent
  ]
})
export class DbNgxAnchorModule { }
