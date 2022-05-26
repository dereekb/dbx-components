import { NgModule } from '@angular/core';
import { PrettyJsonPipe } from './prettyjson.pipe';

@NgModule({
  exports: [PrettyJsonPipe],
  declarations: [PrettyJsonPipe]
})
export class DbxMiscPipeModule {}
