import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DbxForgeGlobalDefaultConfigService } from './forge.global-defaults.service';
import { dbxForgeDefaultValidationMessages } from '../validation';

describe('DbxForgeGlobalDefaultConfigService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be providedIn root (no explicit provider needed)', () => {
    const service = TestBed.inject(DbxForgeGlobalDefaultConfigService);
    expect(service).toBeInstanceOf(DbxForgeGlobalDefaultConfigService);
  });

  it('should seed defaultValidationMessages with dbxForgeDefaultValidationMessages()', () => {
    const service = TestBed.inject(DbxForgeGlobalDefaultConfigService);
    expect(service.getGlobalDefaults().defaultValidationMessages).toEqual(dbxForgeDefaultValidationMessages());
  });

  it('setGlobalDefaults() should fully replace the stored defaults', () => {
    const service = TestBed.inject(DbxForgeGlobalDefaultConfigService);

    service.setGlobalDefaults({ defaultValidationMessages: { required: 'Custom required' } });

    expect(service.getGlobalDefaults()).toEqual({ defaultValidationMessages: { required: 'Custom required' } });
  });

  it('setDefaultValidationMessages() should replace only the messages field', () => {
    const service = TestBed.inject(DbxForgeGlobalDefaultConfigService);

    service.setDefaultValidationMessages({ required: 'Overridden' });

    expect(service.getGlobalDefaults().defaultValidationMessages).toEqual({ required: 'Overridden' });
  });

  it('setDefaultValidationMessages(undefined) should clear the messages', () => {
    const service = TestBed.inject(DbxForgeGlobalDefaultConfigService);

    service.setDefaultValidationMessages(undefined);

    expect(service.getGlobalDefaults().defaultValidationMessages).toBeUndefined();
  });
});
