import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormInfoWrapperComponent } from './info.wrapper.component';
import { DbxFormSectionWrapperComponent } from './section.wrapper.component';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxFormFlexWrapperComponent } from './flex.wrapper.component';
import { DbxFormSubsectionWrapperComponent } from './subsection.wrapper.component';
import { DbxFormExpandWrapperComponent } from './expandable.wrapper.component';
import { AutoTouchFieldWrapperComponent } from './autotouch.wrapper.component';
import { DbxFormToggleWrapperComponent } from './toggle.wrapper.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DbxSectionLayoutModule, DbxTextModule, DbxFlexLayoutModule, DbxLoadingModule } from '@dereekb/dbx-web';
import { DbxFormStyleWrapperComponent } from './style.wrapper.component';
import { DbxFormWorkingWrapperComponent } from './working.wrapper.component';
import { AUTO_TOUCH_WRAPPER_KEY, EXPANDABLE_WRAPPER_KEY, FLEX_WRAPPER_KEY, INFO_WRAPPER_KEY, SECTION_WRAPPER_KEY, STYLE_WRAPPER_KEY, SUBSECTION_WRAPPER_KEY, TOGGLE_WRAPPER_KEY, WORKING_WRAPPER_KEY } from './wrapper';

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
        { name: AUTO_TOUCH_WRAPPER_KEY, component: AutoTouchFieldWrapperComponent },
        { name: EXPANDABLE_WRAPPER_KEY, component: DbxFormExpandWrapperComponent },
        { name: TOGGLE_WRAPPER_KEY, component: DbxFormToggleWrapperComponent },
        { name: SECTION_WRAPPER_KEY, component: DbxFormSectionWrapperComponent },
        { name: SUBSECTION_WRAPPER_KEY, component: DbxFormSubsectionWrapperComponent },
        { name: INFO_WRAPPER_KEY, component: DbxFormInfoWrapperComponent },
        { name: FLEX_WRAPPER_KEY, component: DbxFormFlexWrapperComponent },
        { name: STYLE_WRAPPER_KEY, component: DbxFormStyleWrapperComponent },
        { name: WORKING_WRAPPER_KEY, component: DbxFormWorkingWrapperComponent }
      ]
    })
  ],
  declarations: [AutoTouchFieldWrapperComponent, DbxFormSectionWrapperComponent, DbxFormSubsectionWrapperComponent, DbxFormInfoWrapperComponent, DbxFormExpandWrapperComponent, DbxFormToggleWrapperComponent, DbxFormFlexWrapperComponent, DbxFormStyleWrapperComponent, DbxFormWorkingWrapperComponent],
  exports: []
})
export class DbxFormFormlyWrapperModule {}
