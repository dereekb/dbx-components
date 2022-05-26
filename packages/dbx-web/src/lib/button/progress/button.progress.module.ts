import { CommonModule } from '@angular/common';
import { NgModule, ModuleWithProviders } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG, DbxProgressButtonGlobalConfig } from './button.progress.config';
import { DbxBarButtonComponent } from './bar.button.component';
import { DbxSpinnerButtonComponent } from './spinner.button.component';

@NgModule({
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, MatProgressSpinnerModule, MatRippleModule, MatIconModule],
  exports: [DbxSpinnerButtonComponent, DbxBarButtonComponent],
  declarations: [DbxSpinnerButtonComponent, DbxBarButtonComponent]
})
export class DbxProgressButtonsModule {
  static forRoot(config?: DbxProgressButtonGlobalConfig): ModuleWithProviders<DbxProgressButtonsModule> {
    return {
      ngModule: DbxProgressButtonsModule,
      providers: [
        {
          provide: DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG,
          useValue: config
        }
      ]
    };
  }
}
