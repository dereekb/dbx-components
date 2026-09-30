import { describe, it, expect, expectTypeOf, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe, waitForMs } from '@dereekb/util';
import { dbxForgeWebsiteUrlField, type DbxForgeWebsiteUrlFieldConfig } from './website';
import { DbxForgeAsyncConfigFormComponent } from '../form';
import { DBX_FORGE_TEST_PROVIDERS } from '../form/forge.component.spec';
import '../forge.registry';
import { FORGE_WEBSITE_URL_FIELD_TYPE, type DbxForgeWebsiteUrlFieldDef } from '../field/value/website/website.field';
import { type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import { IS_NOT_WEBSITE_URL_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_EXPECTED_BASE_URL_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY } from '../../validator/website';

// MARK: DbxForgeWebsiteUrlFieldConfig
describe('DbxForgeWebsiteUrlFieldConfig', () => {
  /**
   * The configuration that dbxForgeWebsiteUrlField() accepted when it was built on dbxForgeTextField().
   */
  type PreviousDbxForgeWebsiteUrlFieldConfigKeys = keyof Omit<DbxForgeTextFieldConfig, 'inputType'>;

  it('should include all keys of the previous text field based configuration', () => {
    expectTypeOf<Exclude<PreviousDbxForgeWebsiteUrlFieldConfigKeys, keyof DbxForgeWebsiteUrlFieldConfig>>().toEqualTypeOf<never>();
  });

  it('should accept the previous text field based props', () => {
    expectTypeOf<NonNullable<DbxForgeTextFieldConfig['props']>>().toExtend<NonNullable<DbxForgeWebsiteUrlFieldConfig['props']>>();
  });
});

// MARK: dbxForgeWebsiteUrlField
describe('dbxForgeWebsiteUrlField()', () => {
  it('should create a website url field', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.type).toBe(FORGE_WEBSITE_URL_FIELD_TYPE);
  });

  it('should default key to website', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.key).toBe('website');
  });

  it('should default label to Website Url', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.label).toBe('Website Url');
  });

  it('should not set the base url props by default', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.props?.baseUrl).toBeUndefined();
    expect(field.props?.valueMode).toBeUndefined();
  });

  it('should pass the base url config through props', () => {
    const field = dbxForgeWebsiteUrlField({ baseUrl: 'https://linkedin.com/in/', allowHttp: true, valueMode: 'relative' });
    expect(field.props?.baseUrl).toBe('https://linkedin.com/in/');
    expect(field.props?.allowHttp).toBe(true);
    expect(field.props?.valueMode).toBe('relative');
  });

  it('should not copy the config-only properties to the field definition', () => {
    const field = dbxForgeWebsiteUrlField({ baseUrl: 'https://linkedin.com/in/', requirePrefix: false, validDomains: ['example.com'] }) as unknown as Record<string, unknown>;
    expect(field['baseUrl']).toBeUndefined();
    expect(field['requirePrefix']).toBeUndefined();
    expect(field['validDomains']).toBeUndefined();
  });

  it('should set the autocomplete meta', () => {
    const field = dbxForgeWebsiteUrlField({ autocomplete: 'url' });
    expect(field.meta?.['autocomplete']).toBe('url');
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

  it('should map hint to hint in props', () => {
    const field = dbxForgeWebsiteUrlField({ hint: 'Enter your website' });
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

    it('should use the base url message key instead of the website url message keys when a base url is set', () => {
      const field = dbxForgeWebsiteUrlField({ baseUrl: 'https://linkedin.com/in/' });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_EXPECTED_BASE_URL_VALIDATION_KEY]).toBeDefined();
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]).toBeUndefined();
    });

    it('should allow overriding the expected-base-url message', () => {
      const custom = 'Enter your LinkedIn username.';
      const field = dbxForgeWebsiteUrlField({ baseUrl: 'https://linkedin.com/in/', notWebsiteUrlWithExpectedBaseUrlMessage: custom });
      expect(field.validationMessages?.[IS_NOT_WEBSITE_URL_WITH_EXPECTED_BASE_URL_VALIDATION_KEY]).toBe(custom);
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
    return fixtureFormConfig.fields[0] as DbxForgeWebsiteUrlFieldDef;
  }

  async function settle() {
    fixture.detectChanges();
    await waitForMs(0);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setValueAndSettle(value: string, key = 'website') {
    fixture.componentInstance.setValue({ [key]: value });
    await settle();
  }

  /**
   * Waits for the lazy-loaded website url field component to render its input.
   *
   * @returns The input element.
   */
  async function waitForInputElement(): Promise<HTMLInputElement> {
    let element: Maybe<HTMLInputElement>;

    for (let i = 0; i < 50 && !element; i += 1) {
      await settle();
      element = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('dbx-forge-websiteurl-field input');
    }

    if (!element) {
      throw new Error('The website url field input was not rendered.');
    }

    return element;
  }

  async function typeText(text: string) {
    const element = await waitForInputElement();
    element.value = text;
    element.dispatchEvent(new Event('input'));
    await settle();
    return element;
  }

  async function typeCharacters(text: string) {
    const element = await waitForInputElement();

    for (const character of text) {
      element.value = `${element.value}${character}`;
      element.dispatchEvent(new Event('input'));
      await settle();
    }

    return element;
  }

  async function deleteCharacters(count: number) {
    const element = await waitForInputElement();

    for (let i = 0; i < count; i += 1) {
      element.value = element.value.slice(0, -1);
      element.dispatchEvent(new Event('input'));
      await settle();
    }

    return element;
  }

  async function pasteText(text: string) {
    const element = await waitForInputElement();
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    element.dispatchEvent(event);
    await settle();
    return element;
  }

  async function blurInput() {
    const element = await waitForInputElement();
    element.dispatchEvent(new Event('blur'));
    await settle();
    return element;
  }

  function prefixText() {
    return (fixture.nativeElement as HTMLElement).querySelector('.dbx-forge-websiteurl-field-prefix')?.textContent?.trim() ?? null;
  }

  async function currentValue(key = 'website') {
    const value = (await firstValueFrom(fixture.componentInstance.getValue())) as Record<string, unknown>;
    return value[key];
  }

  async function currentStatus() {
    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    return streamEvent.status;
  }

  it('should validate when the value is a valid website url with a prefix', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('https://example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID');
  });

  it('should invalidate when the value is missing an http/https prefix', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID');
  });

  it('should invalidate when the value is nonsense text', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('not a url');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID');
  });

  it('should accept a bare url when requirePrefix is false', async () => {
    const field = dbxForgeWebsiteUrlField({ requirePrefix: false });
    await applyField(field);

    await setValueAndSettle('example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID');
  });

  it('should accept urls with a port when allowPorts is true', async () => {
    const field = dbxForgeWebsiteUrlField({ allowPorts: true });
    await applyField(field);

    await setValueAndSettle('http://localhost:8080');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID');
  });

  it('should reject urls with a port when allowPorts is false', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('http://localhost:8080');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID');
  });

  it('should validate when the domain is in validDomains', async () => {
    const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'] });
    await applyField(field);

    await setValueAndSettle('https://example.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID');
  });

  it('should invalidate when the domain is not in validDomains', async () => {
    const field = dbxForgeWebsiteUrlField({ validDomains: ['example.com'] });
    await applyField(field);

    await setValueAndSettle('https://other.com');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('INVALID');
  });

  it('should treat empty values as valid (not-required fields)', async () => {
    const field = dbxForgeWebsiteUrlField();
    await applyField(field);

    await setValueAndSettle('');

    const streamEvent = await firstValueFrom(fixture.componentInstance.context.stream$);
    expect(streamEvent.status).toBe('VALID');
  });

  describe('without a base url', () => {
    it('should save the typed text as-is', async () => {
      await applyField(dbxForgeWebsiteUrlField());

      await typeText('https://example.com');

      expect(await currentValue()).toBe('https://example.com');
      expect(await currentStatus()).toBe('VALID');
    });

    it('should show the loaded value in the input', async () => {
      await applyField(dbxForgeWebsiteUrlField());
      await setValueAndSettle('https://example.com');

      const element = await waitForInputElement();
      expect(element.value).toBe('https://example.com');
    });

    it('should apply the idempotentTransform', async () => {
      await applyField(dbxForgeWebsiteUrlField({ idempotentTransform: { trim: true } }));

      await typeText('  https://example.com  ');

      expect(await currentValue()).toBe('https://example.com');
    });
  });

  describe('with a base url', () => {
    const baseUrl = 'https://linkedin.com/in/';

    describe('url value mode', () => {
      it('should save the full url when only the relative path is typed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeText('dereekb');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
        expect(await currentStatus()).toBe('VALID');
      });

      it('should remove the base url from a pasted url without a protocol', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeText('linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should remove the base url from a pasted full url', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeText('https://www.linkedin.com/in/dereekb/?trk=abc');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should save a pasted http url with https when http is not allowed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        await typeText('http://linkedin.com/in/dereekb');

        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should save a pasted http url with http when http is allowed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, allowHttp: true }));

        const element = await typeText('http://linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('http://linkedin.com/in/dereekb');
      });

      it('should auto-fill the base url when only the http protocol is typed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeText('http://');

        expect(element.value).toBe('');
        expect(prefixText()).toBe('https://linkedin.com/in/');

        await typeText('dereekb');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should auto-fill the base url with the http protocol when http:// is typed and http is allowed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, allowHttp: true }));

        const element = await typeText('http://');

        expect(element.value).toBe('');
        expect(prefixText()).toBe('http://linkedin.com/in/');

        await typeText('dereekb');
        expect(await currentValue()).toBe('http://linkedin.com/in/dereekb');
      });

      it('should keep the http protocol after the relative path is cleared with backspace', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, allowHttp: true }));

        await typeText('http://');
        await typeCharacters('dereekb');
        const element = await deleteCharacters('dereekb'.length);

        expect(element.value).toBe('');
        expect(prefixText()).toBe('http://linkedin.com/in/');

        await typeCharacters('someone');
        expect(await currentValue()).toBe('http://linkedin.com/in/someone');
      });

      it('should switch back to the https protocol when https:// is typed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, allowHttp: true }));

        await typeText('http://');
        await typeText('https://');

        expect(prefixText()).toBe('https://linkedin.com/in/');
      });

      it('should keep the prefix visible while the protocol is being typed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        await typeText('http:');

        expect(prefixText()).toBe(baseUrl);
      });

      it('should save the https url when an http url is typed character by character and http is not allowed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeCharacters('http://linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(prefixText()).toBe('https://linkedin.com/in/');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should keep the http protocol when an http url is typed character by character and http is allowed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, allowHttp: true }));

        const element = await typeCharacters('http://linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(prefixText()).toBe('http://linkedin.com/in/');
        expect(await currentValue()).toBe('http://linkedin.com/in/dereekb');
      });

      it('should replace the existing relative path with a pasted url', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));
        await typeText('someone');

        const element = await pasteText('http://linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('https://linkedin.com/in/dereekb');
      });

      it('should remove the base url on blur when there is no relative path', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));
        await typeText('linkedin.com/in');

        const element = await blurInput();

        expect(element.value).toBe('');
      });

      it('should show the base url as a prefix', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));
        await waitForInputElement();

        const prefix = (fixture.nativeElement as HTMLElement).querySelector('.dbx-forge-websiteurl-field-prefix');
        expect(prefix?.textContent?.trim()).toBe(baseUrl);
      });

      it('should keep a value that is set before the field is rendered', async () => {
        fixture.componentInstance.config.set({ fields: [dbxForgeWebsiteUrlField({ baseUrl })] });
        fixture.componentInstance.setValue({ website: 'https://www.linkedin.com/in/dereekb/' });

        const element = await waitForInputElement();

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('https://www.linkedin.com/in/dereekb/');
      });

      it('should show only the relative path of a loaded url in the input', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));
        await setValueAndSettle('https://linkedin.com/in/dereekb');

        const element = await waitForInputElement();
        expect(element.value).toBe('dereekb');
      });

      it('should invalidate a url on a different domain', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        const element = await typeText('https://twitter.com/dereekb');

        expect(element.value).toBe('https://twitter.com/dereekb');
        expect(await currentStatus()).toBe('INVALID');
        expect((fixture.nativeElement as HTMLElement).querySelector('.dbx-forge-websiteurl-field-prefix')).toBeNull();
      });

      it('should invalidate a relative path with whitespace', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        await typeText('derek burgman');

        expect(await currentStatus()).toBe('INVALID');
      });

      it('should treat empty values as valid', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl }));

        await setValueAndSettle('');

        expect(await currentStatus()).toBe('VALID');
      });
    });

    describe('relative value mode', () => {
      it('should save only the relative path when the relative path is typed', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, valueMode: 'relative' }));

        await typeText('dereekb');

        expect(await currentValue()).toBe('dereekb');
        expect(await currentStatus()).toBe('VALID');
      });

      it('should save only the relative path when a url is pasted', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, valueMode: 'relative' }));

        const element = await typeText('linkedin.com/in/dereekb');

        expect(element.value).toBe('dereekb');
        expect(await currentValue()).toBe('dereekb');
      });

      it('should show a loaded relative path in the input', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, valueMode: 'relative' }));
        await setValueAndSettle('dereekb');

        const element = await waitForInputElement();
        expect(element.value).toBe('dereekb');
        expect(await currentStatus()).toBe('VALID');
      });

      it('should invalidate a url on a different domain', async () => {
        await applyField(dbxForgeWebsiteUrlField({ baseUrl, valueMode: 'relative' }));

        await typeText('https://twitter.com/dereekb');

        expect(await currentStatus()).toBe('INVALID');
      });
    });
  });
});
