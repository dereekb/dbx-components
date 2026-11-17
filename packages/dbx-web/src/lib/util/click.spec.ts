import { describe, expect, it } from 'vitest';
import { DBX_OVERRIDE_CLICK_IGNORE_CLASS, isOverrideClickIgnoredEvent } from './click';

function makeClickFrom(target: Element): Event {
  const event = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('isOverrideClickIgnoredEvent()', () => {
  it('should ignore a click from inside an ignore region within the child target', () => {
    const child = document.createElement('span');
    const region = document.createElement('div');
    region.classList.add(DBX_OVERRIDE_CLICK_IGNORE_CLASS);
    const button = document.createElement('button');
    region.appendChild(button);
    child.appendChild(region);

    expect(isOverrideClickIgnoredEvent(makeClickFrom(button), child)).toBe(true);
    expect(isOverrideClickIgnoredEvent(makeClickFrom(region), child)).toBe(true);
  });

  it('should not ignore a click from outside an ignore region', () => {
    const child = document.createElement('span');
    const region = document.createElement('div');
    region.classList.add(DBX_OVERRIDE_CLICK_IGNORE_CLASS);
    const content = document.createElement('div');
    child.appendChild(region);
    child.appendChild(content);

    expect(isOverrideClickIgnoredEvent(makeClickFrom(content), child)).toBe(false);
  });

  it('should not ignore a click when the ignore region wraps the child target instead of being inside it', () => {
    const outer = document.createElement('div');
    outer.classList.add(DBX_OVERRIDE_CLICK_IGNORE_CLASS);
    const child = document.createElement('span');
    const content = document.createElement('div');
    child.appendChild(content);
    outer.appendChild(child);

    expect(isOverrideClickIgnoredEvent(makeClickFrom(content), child)).toBe(false);
  });

  it('should not ignore a click when the child target itself carries the class', () => {
    const child = document.createElement('span');
    child.classList.add(DBX_OVERRIDE_CLICK_IGNORE_CLASS);
    const content = document.createElement('div');
    child.appendChild(content);

    expect(isOverrideClickIgnoredEvent(makeClickFrom(content), child)).toBe(false);
  });
});
