import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type FormControlStatus } from '@angular/forms';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { waitForMs } from '@dereekb/util';
import { dbxForgeWebsiteUrlField } from './website';
import { DbxForgeAsyncConfigFormComponent } from '../form';
import { DBX_FORGE_TEST_PROVIDERS } from '../form/forge.component.spec';
import { IS_NOT_WEBSITE_URL_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY } from '../../validator/website';

// MARK: dbxForgeWebsiteUrlField
describe('dbxForgeWebsiteUrlField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.type).toBe('input');
  });

  it('should default key to website', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.key).toBe('website');
  });

  it('should default label to Website Url', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.label).toBe('Website Url');
  });

  it('should use text input type', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.props?.type).toBe('text');
  });

  it('should allow overriding the key', () => {
    const field = dbxForgeWebsiteUrlField({ key: 'homepage' });
    expect(field.key).toBe('homepage');
  });

  it('should allow overriding the label', () => {
    const field = dbxForgeWebsiteUrlField({ label: 'Homepage' });
    expect(field.label).toBe('Homepage');
  });

  it('should set required when specified', () => {
    const field = dbxForgeWebsiteUrlField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeWebsiteUrlField({ description: 'Enter your website' });
    expect(field.props?.hint).toBe('Enter your website');
  });

  describe('validation config', () => {
    it('should register a custom website url validator by default', () => {
      const field = dbxForgeWebsiteUrlField();
      expect(field.validators).toBeDefined();
      expect(field.validators!.some((v) => v.type === 'custom')).toBe(true);
    });

    it('should use the with-prefix message key when a prefix is required', () => {
      const field = dbxForgeWebsiteUrlField();
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]).toBeDefined();
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_VALIDATION_KEY]).toBeUndefined();
    });

    it('should use the no-prefix message key when a prefix is not required', () => {
      const field = dbxForgeWebsiteUrlField({ requirePrefix: false });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_VALIDATION_KEY]).toBeDefined();
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]).toBeUndefined();
    });

    it('should always include the expected-domain message key', () => {
      const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'] });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY]).toBeDefined();
    });

    it('should allow overriding the with-prefix message', () => {
      const custom = 'Must begin with http:// or https://';
      const field = dbxForgeWebsiteUrlField({ notWebsiteUrlWithPrefixMessage: custom });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]).toBe(custom);
    });

    it('should allow overriding the expected-domain message', () => {
      const custom = 'Domain not allowed';
      const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'], notWebsiteUrlWithExpectedDomainMessage: custom });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY]).toBe(custom);
    });
  });
});

// MARK: Scenarios
describe('dbxForgeWebsiteUrlField() scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function applyField(field: ReturnType<typeof dbxForgeWebsiteUrlField>) {
    const formConfig = { fields: [field] };
    fixture.componentInstance.config.set(formConfig);

    fixture.detectChanges();
    await fixture.whenStable();

    const fixtureFormConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
    return fixtureFormConfig.fields[0] as MatInputField;
  }

  async function setValueAndSettle(value: string) {
    fixture.componentInstance.setValue({ website: value });

    fixture.detectChanges();
    await waitForMs(0);
    await fixture.whenStable();
  }

  it('should validate when the value is a valid website url with a prefix', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('https://example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should invalidate when the value is missing an http/https prefix', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
  });

  it('should invalidate when the value is nonsense text', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('not a url');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
  });

  it('should accept a bare url when requirePrefix is false', async () => {
    const field = dbxForgeWebsiteUrlField({ requirePrefix: false });
    await applyField(field);

    await setValueAndSettle('example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should accept urls with a port when allowPorts is true', async () => {
    const field = dbxForgeWebsiteUrlField({ allowPorts: true });
    await applyField(field);

    await setValueAndSettle('http://localhost:8080');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should reject urls with a port when allowPorts is false', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('http://localhost:8080');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
  });

  it('should validate when the domain is in validDomains', async () => {
    const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'] });
    await applyField(field);

    await setValueAndSettle('https://example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });

  it('should invalidate when the domain is not in validDomains', async () => {
    const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'] });
    await applyField(field);

    await setValueAndSettle('https://other.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID' as FormControlStatus);
  });

  it('should treat empty values as valid (not-required fields)', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID' as FormControlStatus);
  });
});
