import { describe, expect, it } from 'vitest';
import { runFilterScaffold } from './filter-scaffold.tool.js';

describe('dbx_filter_scaffold', () => {
  it('returns isError when model_name is missing', () => {
    const result = runFilterScaffold({ filter_type: 'ProfileFilter' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns isError when filter_type is missing', () => {
    const result = runFilterScaffold({ model_name: 'Profile' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects empty model_name after trimming', () => {
    const result = runFilterScaffold({ model_name: '   ', filter_type: 'ProfileFilter' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('must not be empty');
  });

  it('produces filter type + template + class without presets', () => {
    const result = runFilterScaffold({ model_name: 'Profile', filter_type: 'ProfileFilter' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('# Profile filter scaffold');
    expect(text).toContain('export interface ProfileFilter');
    expect(text).toContain('dbxFilterSourceConnector');
    expect(text).toContain('export class ProfileListPageComponent');
    expect(text).not.toContain('## Presets');
    expect(text).not.toContain('DbxFilterPresetListComponent');
  });

  it('emits preset constants and array when preset_keys are supplied', () => {
    const result = runFilterScaffold({ model_name: 'Profile', filter_type: 'ProfileFilter', preset_keys: ['active', 'archived'] });
    const text = result.content[0].text;
    expect(text).toContain('## Presets');
    expect(text).toContain('profileActivePreset');
    expect(text).toContain('profileArchivedPreset');
    expect(text).toContain('profileFilterPresets');
    expect(text).toContain("preset?: 'active' | 'archived'");
  });

  it('wires the collection store when uses_collection_store=true', () => {
    const result = runFilterScaffold({ model_name: 'Profile', filter_type: 'ProfileFilter', uses_collection_store: true });
    const text = result.content[0].text;
    expect(text).toContain('dbxFirebaseCollectionList');
    expect(text).toContain('DbxFirebaseCollectionListDirective');
    expect(text).toContain('inject(ProfileCollectionStore)');
  });

  it('skips the collection-store wiring by default', () => {
    const result = runFilterScaffold({ model_name: 'Profile', filter_type: 'ProfileFilter' });
    const text = result.content[0].text;
    expect(text).not.toContain('DbxFirebaseCollectionListDirective');
    expect(text).not.toContain('CollectionStore');
  });
});
