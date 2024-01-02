import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormMapboxZoomFieldComponent } from './zoom.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule } from '@angular/material/legacy-input';
import { DbxTextModule } from '@dereekb/dbx-web';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxTextModule,
    DbxMapboxModule,
    FormsModule,
    ReactiveFormsModule,
    MatLegacyInputModule,
    FormlyModule.forChild({
      types: [{ name: 'mapbox-zoom-picker', component: DbxFormMapboxZoomFieldComponent, wrappers: ['style', 'form-field'] }]
    }),
    NgxMapboxGLModule
  ],
  declarations: [DbxFormMapboxZoomFieldComponent]
})
export class DbxFormMapboxZoomModule {}
