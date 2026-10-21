import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { DbxClickToCopyFieldComponent, DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT } from './copy.field.component';

describe('DbxClickToCopyFieldComponent', () => {
  function createField(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(DbxClickToCopyFieldComponent);

    Object.entries(inputs).forEach(([key, value]) => {
      fixture.componentRef.setInput(key, value);
    });

    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should show and copy the text', () => {
    const { componentInstance, nativeElement } = createField({ text: 'abc123' });

    expect(componentInstance.displayTextSignal()).toBe('abc123');
    expect(componentInstance.clickToCopyTextConfigSignal().copyText).toBe('abc123');
    expect((nativeElement as HTMLElement).querySelector('.dbx-click-to-copy-field-text')?.textContent).toBe('abc123');
  });

  it('should copy copyText in place of the text', () => {
    const { componentInstance } = createField({ text: 'Order #1042', copyText: '1042' });
    expect(componentInstance.clickToCopyTextConfigSignal().copyText).toBe('1042');
  });

  it('should take values from the config when the inputs are unset', () => {
    const { componentInstance } = createField({ config: { text: 'from-config', icon: 'key', clickIconToCopyOnly: true }, icon: 'link' });

    expect(componentInstance.textSignal()).toBe('from-config');
    expect(componentInstance.iconSignal()).toBe('link');
    expect(componentInstance.clickToCopyTextConfigSignal().clickIconToCopyOnly).toBe(true);
  });

  it('should pass the copy options through to dbx-click-to-copy-text', () => {
    const clipboardSnackbarMessagesConfig = { successMessage: 'Copied.' };
    const { componentInstance } = createField({ text: 'x', showIcon: false, clickToCopyIcon: 'content_paste', clipboardSnackbarMessagesEnabled: false, clipboardSnackbarMessagesConfig });

    expect(componentInstance.clickToCopyTextConfigSignal()).toEqual({
      copyText: 'x',
      showIcon: false,
      clickToCopyIcon: 'content_paste',
      clickIconToCopyOnly: undefined,
      clipboardSnackbarMessagesEnabled: false,
      clipboardSnackbarMessagesConfig
    });
  });

  describe('secret', () => {
    it('should hide the value until revealed, while still copying the real value', () => {
      const fixture = createField({ text: 'top-secret', secret: true });
      const { componentInstance } = fixture;

      expect(componentInstance.displayTextSignal()).toBe(DEFAULT_DBX_CLICK_TO_COPY_FIELD_HIDDEN_TEXT);
      expect(componentInstance.clickToCopyTextConfigSignal().copyText).toBe('top-secret');

      componentInstance.toggleRevealed();
      expect(componentInstance.revealed()).toBe(true);
      expect(componentInstance.displayTextSignal()).toBe('top-secret');
    });

    it('should toggle from the show/hide button', () => {
      const fixture = createField({ text: 'top-secret', secret: true });
      const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.dbx-click-to-copy-field-reveal');

      button?.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.revealed()).toBe(true);
      expect(button?.getAttribute('aria-pressed')).toBe('true');
    });

    it('should use the configured hidden text', () => {
      const { componentInstance } = createField({ text: 'top-secret', secret: true, hiddenText: '****' });
      expect(componentInstance.displayTextSignal()).toBe('****');
    });

    it('should not show the show/hide button for a value that is not secret', () => {
      const { nativeElement } = createField({ text: 'abc123' });
      expect((nativeElement as HTMLElement).querySelector('.dbx-click-to-copy-field-reveal')).toBeNull();
    });
  });
});
