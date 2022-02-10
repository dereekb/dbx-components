import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormInfoWrapperComponent } from './info.wrapper.component';
import { DbxFormSectionWrapperComponent } from './section.wrapper.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { DbxFormFlexWrapperComponent } from './flex.wrapper.component';
import { DbxFormSubsectionWrapperComponent } from './subsection.wrapper.component';
import { DbxFormExpandWrapperComponent } from './expandable.wrapper.component';
import { AutoTouchFieldWrapperComponent } from './autotouch.wrapper.component';
import { DbxFormToggleWrapperComponent } from './toggle.wrapper.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DbxSectionLayoutModule, DbxTextModule, DbxFlexLayoutModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    DbxFlexLayoutModule,
    DbxSectionLayoutModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      wrappers: [
        { name: 'autotouch', component: AutoTouchFieldWrapperComponent },
        { name: 'expandable', component: DbxFormExpandWrapperComponent },
        { name: 'toggle', component: DbxFormToggleWrapperComponent },
        { name: 'section', component: DbxFormSectionWrapperComponent },
        { name: 'subsection', component: DbxFormSubsectionWrapperComponent },
        { name: 'info', component: DbxFormInfoWrapperComponent },
        { name: 'flex', component: DbxFormFlexWrapperComponent }
      ]
    })
  ],
  declarations: [
    AutoTouchFieldWrapperComponent,
    DbxFormSectionWrapperComponent,
    DbxFormSubsectionWrapperComponent,
    DbxFormInfoWrapperComponent,
    DbxFormExpandWrapperComponent,
    DbxFormToggleWrapperComponent,
    DbxFormFlexWrapperComponent
  ],
  exports: []
})
export class DbxFormFormlyWrapperModule { }
