import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormlyModule } from '@ngx-formly/core';
import { FormInfoSectionWrapperComponent } from './info.wrapper.component';
import { FormSectionWrapperComponent } from './section.wrapper.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormFlexWrapperComponent } from './flex.wrapper.component';
import { FormSubsectionWrapperComponent } from './subsection.wrapper.component';
import { FormExpandableSectionWrapperComponent } from './expandable.wrapper.component';
import { AutoTouchFieldWrapperComponent } from './autotouch.wrapper.component';
import { FormToggleSectionWrapperComponent } from './toggle.wrapper.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DbxTextModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    FlexLayoutModule,
    FormlyModule.forChild({
      wrappers: [
        { name: 'autotouch', component: AutoTouchFieldWrapperComponent },
        { name: 'expandable', component: FormExpandableSectionWrapperComponent },
        { name: 'toggle', component: FormToggleSectionWrapperComponent },
        { name: 'section', component: FormSectionWrapperComponent },
        { name: 'subsection', component: FormSubsectionWrapperComponent },
        { name: 'info', component: FormInfoSectionWrapperComponent },
        { name: 'flex', component: FormFlexWrapperComponent }
      ]
    })
  ],
  declarations: [
    AutoTouchFieldWrapperComponent,
    FormSectionWrapperComponent,
    FormSubsectionWrapperComponent,
    FormInfoSectionWrapperComponent,
    FormExpandableSectionWrapperComponent,
    FormToggleSectionWrapperComponent
  ],
  exports: []
})
export class DbxFormWrapperModule { }
