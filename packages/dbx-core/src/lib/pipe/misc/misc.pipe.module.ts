import { NgModule } from '@angular/core';
import { PrettyJsonPipe } from './prettyjson.pipe';

/**
 * @deprecated import the standalone pipes directly
 *
 * @see PrettyJsonPipe
 */
@NgModule({
  imports: [PrettyJsonPipe],
  exports: [PrettyJsonPipe]
})
export class DbxMiscPipeModule {}
