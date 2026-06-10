import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_DBX_STYLE_CONFIG_TOKEN, DbxStyleService } from './style.service';

/**
 * Configures a {@link DbxStyleService} via TestBed with a fixed default style config.
 */
function setupService(): DbxStyleService {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), DbxStyleService, { provide: DEFAULT_DBX_STYLE_CONFIG_TOKEN, useValue: { style: 'test-app' } }]
  });

  return TestBed.inject(DbxStyleService);
}

describe('DbxStyleService', () => {
  describe('styleApplication$', () => {
    it('should emit the root style class with empty styles when no supplement is set', async () => {
      const service = setupService();
      const application = await firstValueFrom(service.styleApplication$);
      expect(application).toEqual({ classes: ['test-app'], style: {} });
    });

    it('should flatten the root style class with supplement classes and inline styles', async () => {
      const service = setupService();
      service.setSupplement({ classes: ['extra-class'], style: { '--mat-sys-primary': '#ff0066' } });

      const application = await firstValueFrom(service.styleApplication$);
      expect(application.classes).toEqual(['test-app', 'extra-class']);
      expect(application.style).toEqual({ '--mat-sys-primary': '#ff0066' });
    });

    it('should revert to the root style class only after a supplement is cleared', async () => {
      const service = setupService();
      service.setSupplement({ classes: ['extra-class'] });
      service.setSupplement(undefined);

      const application = await firstValueFrom(service.styleApplication$);
      expect(application).toEqual({ classes: ['test-app'], style: {} });
    });
  });
});
