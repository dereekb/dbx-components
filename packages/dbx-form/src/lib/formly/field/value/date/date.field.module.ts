import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxDateTimeFieldComponent } from './datetime.field.component';
import { DbxFormFormlyWrapperModule } from '../../wrapper/form.wrapper.module';
import { DbxFixedDateRangeFieldComponent } from './fixeddaterange.field.component';

const importsAndExports = [DbxDateTimeFieldComponent, DbxFixedDateRangeFieldComponent, DbxFormFormlyWrapperModule];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [
        //
        { name: 'datetime', component: DbxDateTimeFieldComponent, wrappers: ['style', 'form-field'] },
        { name: 'fixeddaterange', component: DbxFixedDateRangeFieldComponent, wrappers: ['style', 'form-field'] }
      ]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyDateFieldModule {}
