import { DBX_CURATED_COLOR_COUNT, DBX_CURATED_COLOR_TEMPLATES, dbxCuratedColorConfigForString } from './style';

describe('DBX_CURATED_COLOR_TEMPLATES', () => {
  it('should declare DBX_CURATED_COLOR_COUNT curated templates', () => {
    expect(DBX_CURATED_COLOR_TEMPLATES.length).toBe(DBX_CURATED_COLOR_COUNT);
  });

  it('should flag every template as curated and reference var() color tokens', () => {
    DBX_CURATED_COLOR_TEMPLATES.forEach((template, index) => {
      const colorNumber = index + 1;
      expect(template.curated).toBe(true);
      expect(template.key).toBe(`curated-${colorNumber}`);
      expect(template.config.color).toBe(`var(--dbx-curated-color-${colorNumber})`);
      expect(template.config.contrast).toBe(`var(--dbx-curated-color-${colorNumber}-contrast)`);
    });
  });
});

describe('dbxCuratedColorConfigForString()', () => {
  it('should deterministically map the same string to the same curated config', () => {
    const a = dbxCuratedColorConfigForString('Michelle B');
    const b = dbxCuratedColorConfigForString('Michelle B');
    expect(a).toEqual(b);
  });

  it('should return a config carrying the picked template key and its var() values', () => {
    const result = dbxCuratedColorConfigForString('Michelle B');
    expect(result).toBeDefined();
    expect(result?.template).toMatch(/^curated-\d+$/);
    expect(result?.color).toMatch(/^var\(--dbx-curated-color-\d+\)$/);
    expect(result?.contrast).toMatch(/^var\(--dbx-curated-color-\d+-contrast\)$/);
  });

  it('should pick a template within the available set', () => {
    const keys = DBX_CURATED_COLOR_TEMPLATES.map((template) => template.key);
    const inputs = ['Michelle B', 'A', 'BB', 'John Smith', 'Zoe Quinn', '', 'a-very-long-name-value'];

    inputs.forEach((input) => {
      const result = dbxCuratedColorConfigForString(input);

      if (input) {
        expect(keys).toContain(result?.template);
      }
    });
  });

  it('should return null for a blank value', () => {
    expect(dbxCuratedColorConfigForString(null)).toBeUndefined();
    expect(dbxCuratedColorConfigForString(undefined)).toBeUndefined();
    expect(dbxCuratedColorConfigForString('')).toBeUndefined();
  });

  it('should return null when no templates are available', () => {
    expect(dbxCuratedColorConfigForString('Michelle B', [])).toBeUndefined();
  });
});
