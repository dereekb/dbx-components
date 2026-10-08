import { describe, it, expect } from 'vitest';
import { sourceSelectDisplayValueMatchesFilterText } from './sourceselect';

describe('sourceSelectDisplayValueMatchesFilterText()', () => {
  it('should match on the label', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'Houston Gateway Academy' }, 'gateway')).toBe(true);
  });

  it('should match the label case-insensitively', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'HOUSTON' }, 'houston')).toBe(true);
  });

  it('should match on a keyword', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'Houston Gateway Academy', keywords: ['HGA'] }, 'hga')).toBe(true);
  });

  it('should match on part of a keyword', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'Houston Gateway Academy', keywords: ['HGA'] }, 'hg')).toBe(true);
  });

  it('should not match when neither the label nor a keyword contains the filter text', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'Houston Gateway Academy', keywords: ['HGA'] }, 'denver')).toBe(false);
  });

  it('should not match when there are no keywords and the label does not match', () => {
    expect(sourceSelectDisplayValueMatchesFilterText({ label: 'Houston Gateway Academy', keywords: null }, 'hga')).toBe(false);
  });
});
