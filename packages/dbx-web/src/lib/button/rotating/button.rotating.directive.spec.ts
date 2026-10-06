import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DbxButtonComponent } from '../button.component';
import { DbxRotatingButtonDirective } from './button.rotating.directive';
import { type DbxRotatingButtonConfig } from './button.rotating';
import { DEFAULT_DBX_TRISTATE_OFF_ICON, DEFAULT_DBX_TRISTATE_ON_ICON, type DbxTristateValue, dbxTristateRotatingButtonConfig } from './button.rotating.tristate';

@Component({
  template: `
    <div class="test-row" role="button" tabindex="0" (click)="rowClicks.set(rowClicks() + 1)" (keydown.enter)="rowClicks.set(rowClicks() + 1)">
      <dbx-button iconOnly [disabled]="disabled()" [dbxRotatingButton]="config()" [(dbxRotatingButtonValue)]="value"></dbx-button>
    </div>
  `,
  imports: [DbxButtonComponent, DbxRotatingButtonDirective]
})
class TestRotatingButtonHostComponent {
  readonly value = signal<DbxTristateValue>(null);
  readonly rowClicks = signal(0);
  readonly disabled = signal(false);
  readonly config = signal<DbxRotatingButtonConfig<DbxTristateValue>>(dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false }));
}

describe('DbxRotatingButtonDirective', () => {
  let fixture: ComponentFixture<TestRotatingButtonHostComponent>;
  let announce: ReturnType<typeof vi.fn>;

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
  }

  function icon(): string {
    return (fixture.debugElement.query(By.css('mat-icon')).nativeElement as HTMLElement).textContent?.trim() ?? '';
  }

  function clickButton() {
    button().click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    announce = vi.fn(() => Promise.resolve());

    TestBed.configureTestingModule({
      providers: [{ provide: LiveAnnouncer, useValue: { announce } }]
    });

    fixture = TestBed.createComponent(TestRotatingButtonHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should apply the current state to the dbx-button', () => {
    expect(button().getAttribute('aria-label')).toBe('Text: Default (Off)');
    expect(icon()).toContain(DEFAULT_DBX_TRISTATE_OFF_ICON);
  });

  it('should rotate Default -> On -> Off -> Default through the two-way binding', () => {
    clickButton();
    expect(fixture.componentInstance.value()).toBe(true);
    expect(button().getAttribute('aria-label')).toBe('Text: On');
    expect(icon()).toContain(DEFAULT_DBX_TRISTATE_ON_ICON);

    clickButton();
    expect(fixture.componentInstance.value()).toBe(false);
    expect(button().getAttribute('aria-label')).toBe('Text: Off');

    clickButton();
    expect(fixture.componentInstance.value()).toBeNull();
    expect(button().getAttribute('aria-label')).toBe('Text: Default (Off)');
  });

  it('should reflect a value set by the host', () => {
    fixture.componentInstance.value.set(false);
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Text: Off');
  });

  it('should skip the default state from its equivalent state on the first click only', () => {
    fixture.componentInstance.config.set(dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false }));
    fixture.componentInstance.value.set(false);
    fixture.detectChanges();

    // Default (Off) looks the same as Off, so the first click goes to On
    clickButton();
    expect(fixture.componentInstance.value()).toBe(true);

    clickButton();
    expect(fixture.componentInstance.value()).toBe(false);

    // later clicks rotate through every state
    clickButton();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('should go from a default that resolves to on to Off on the first click', () => {
    fixture.componentInstance.config.set(dbxTristateRotatingButtonConfig({ label: 'Email', defaultValue: true }));
    fixture.detectChanges();

    clickButton();
    expect(fixture.componentInstance.value()).toBe(false);
    expect(button().getAttribute('aria-label')).toBe('Email: Off');
  });

  it('should keep the same button element and focus across clicks', () => {
    const original = button();
    original.focus();
    clickButton();
    clickButton();
    expect(button()).toBe(original);
    expect(document.activeElement).toBe(original);
  });

  it('should not rotate while disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    clickButton();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('should not propagate clicks to the row', () => {
    clickButton();
    expect(fixture.componentInstance.rowClicks()).toBe(0);
  });

  it('should announce each change', () => {
    clickButton();
    expect(announce).toHaveBeenCalledWith('Text: On');
  });

  it('should not announce when announceChanges is false', () => {
    fixture.componentInstance.config.set(dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false, announceChanges: false }));
    fixture.detectChanges();
    clickButton();
    expect(announce).not.toHaveBeenCalled();
  });

  it('should rotate through custom states', () => {
    fixture.componentInstance.config.set({
      label: 'Sort',
      states: [
        { value: true, label: 'Ascending', display: { icon: 'arrow_upward' } },
        { value: false, label: 'Descending', display: { icon: 'arrow_downward' } }
      ]
    });
    fixture.componentInstance.value.set(true);
    fixture.detectChanges();
    expect(icon()).toContain('arrow_upward');

    clickButton();
    expect(fixture.componentInstance.value()).toBe(false);
    expect(icon()).toContain('arrow_downward');
    expect(button().getAttribute('aria-label')).toBe('Sort: Descending');
  });
});
