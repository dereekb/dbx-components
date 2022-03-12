import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { NgModule } from '@angular/core';
import { DbxAnchorComponent } from './anchor.component';
import { CommonModule } from '@angular/common';
import { DbxAnchorIconComponent } from './anchor.icon.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorLinkComponent } from './anchor.link.component';
import { DbxAnchorContentComponent } from './anchor.content.component';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxInjectedComponentModule
  ],
  declarations: [
    DbxAnchorComponent,
    DbxAnchorIconComponent,
    DbxAnchorLinkComponent,
    DbxAnchorContentComponent
  ],
  exports: [
    DbxAnchorComponent,
    DbxAnchorIconComponent,
    DbxAnchorLinkComponent,
    DbxAnchorContentComponent
  ]
})
export class DbxAnchorModule { }
