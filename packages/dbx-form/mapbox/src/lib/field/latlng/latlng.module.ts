import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormMapboxLatLngFieldComponent } from './latlng.field.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { DbxTextModule } from '@dereekb/dbx-web';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DbxTextModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    FormlyModule.forChild({
      types: [{ name: 'mapbox-latlng-picker', component: DbxFormMapboxLatLngFieldComponent, wrappers: ['style', 'form-field'] }]
    }),
    NgxMapboxGLModule
  ],
  declarations: [DbxFormMapboxLatLngFieldComponent]
})
export class DbxFormMapboxLatLngModule {}
