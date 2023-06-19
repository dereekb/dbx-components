import { MatDialogConfig } from '@angular/material/dialog';

export type DbxDialogContentConfig = Omit<MatDialogConfig, 'viewContainerRef' | 'injector' | 'id' | 'data'>;
