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
import { DbxSectionLayoutModule, DbxTextModule, DbxFlexLayoutModule, DbxLoadingModule } from '@dereekb/dbx-web';
import { DbxFormStyleWrapperComponent } from './style.wrapper.component';
import { DbxFormWorkingWrapperComponent } from './working.wrapper.component';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    DbxLoadingModule,
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
        { name: 'flex', component: DbxFormFlexWrapperComponent },
        { name: 'style', component: DbxFormStyleWrapperComponent },
        { name: 'working', component: DbxFormWorkingWrapperComponent }
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
    DbxFormFlexWrapperComponent,
    DbxFormStyleWrapperComponent,
    DbxFormWorkingWrapperComponent
  ],
  exports: []
})
export class DbxFormFormlyWrapperModule { }
