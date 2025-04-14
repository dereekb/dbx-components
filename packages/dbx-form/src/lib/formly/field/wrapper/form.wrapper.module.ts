import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormInfoWrapperComponent } from './info.wrapper.component';
import { DbxFormSectionWrapperComponent } from './section.wrapper.component';
import { DbxFormFlexWrapperComponent } from './flex.wrapper.component';
import { DbxFormSubsectionWrapperComponent } from './subsection.wrapper.component';
import { DbxFormExpandWrapperComponent } from './expand.wrapper.component';
import { AutoTouchFieldWrapperComponent } from './autotouch.wrapper.component';
import { DbxFormToggleWrapperComponent } from './toggle.wrapper.component';
import { DbxFormStyleWrapperComponent } from './style.wrapper.component';
import { DbxFormWorkingWrapperComponent } from './working.wrapper.component';
import { AUTO_TOUCH_WRAPPER_KEY, EXPAND_WRAPPER_KEY, FLEX_WRAPPER_KEY, INFO_WRAPPER_KEY, SECTION_WRAPPER_KEY, STYLE_WRAPPER_KEY, SUBSECTION_WRAPPER_KEY, TOGGLE_WRAPPER_KEY, WORKING_WRAPPER_KEY } from './wrapper.key';

const importsAndExports = [AutoTouchFieldWrapperComponent, DbxFormSectionWrapperComponent, DbxFormSubsectionWrapperComponent, DbxFormInfoWrapperComponent, DbxFormExpandWrapperComponent, DbxFormToggleWrapperComponent, DbxFormFlexWrapperComponent, DbxFormStyleWrapperComponent, DbxFormWorkingWrapperComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      wrappers: [
        { name: AUTO_TOUCH_WRAPPER_KEY, component: AutoTouchFieldWrapperComponent },
        { name: EXPAND_WRAPPER_KEY, component: DbxFormExpandWrapperComponent },
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
  exports: importsAndExports
})
export class DbxFormFormlyWrapperModule {}
