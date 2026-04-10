import { describe, it, expect } from 'vitest';
import { forgeRow, forgeGroup, forgeWithClassName, forgeToggleWrapper, forgeExpandWrapper } from './wrapper';
import { forgeDbxSectionFieldWrapper, forgeDbxSubsectionFieldWrapper, FORGE_SECTION_FIELD_TYPE_NAME } from './section/section.field';
import { forgeFormFieldWrapper, FORGE_FORM_FIELD_WRAPPER_TYPE_NAME } from './formfield/formfield.field';
import { forgeExpandField, FORGE_EXPAND_FIELD_TYPE_NAME } from './expand/expand.field';
import { forgeInfoButtonField, FORGE_INFO_BUTTON_FIELD_TYPE_NAME } from './info/info.field';
import { forgeInfoFieldWrapper, FORGE_INFO_WRAPPER_FIELD_TYPE_NAME } from './info/info.wrapper.field';
import { forgeStyleWrapper, FORGE_STYLE_FIELD_TYPE_NAME } from './style/style.field';
import { forgeWorkingField, FORGE_WORKING_FIELD_TYPE_NAME } from './working/working.field';
import { forgeWorkingFieldWrapper, FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME } from './working/working.wrapper.field';

// MARK: forgeRow
describe('forgeRow()', () => {
  it('should create a row field with correct type', () => {
    const row = forgeRow({ fields: [] });
    expect(row.type).toBe('row');
  });

  it('should set an auto-generated key', () => {
    const row = forgeRow({ fields: [] });
    expect(row.key).toContain('_row');
  });

  it('should use a custom key when provided', () => {
    const row = forgeRow({ key: 'myRow', fields: [] });
    expect(row.key).toBe('myRow');
  });

  it('should include the provided fields', () => {
    const fields = [
      { key: 'first', type: 'input' as const, label: 'First', col: 6 },
      { key: 'last', type: 'input' as const, label: 'Last', col: 6 }
    ];
    const row = forgeRow({ fields });
    expect(row.fields).toBe(fields);
  });

  it('should set className when provided', () => {
    const row = forgeRow({ fields: [], className: 'my-row' });
    expect((row as unknown as Record<string, unknown>)['className']).toBe('my-row');
  });

  it('should not set className when not provided', () => {
    const row = forgeRow({ fields: [] });
    expect((row as unknown as Record<string, unknown>)['className']).toBeUndefined();
  });
});

// MARK: forgeGroup
describe('forgeGroup()', () => {
  it('should create a group field with correct type', () => {
    const group = forgeGroup({ fields: [] });
    expect(group.type).toBe('group');
  });

  it('should set an auto-generated key with _group_ prefix', () => {
    const group = forgeGroup({ fields: [] });
    expect((group.key as string).startsWith('_group_')).toBe(true);
  });

  it('should use provided key', () => {
    const group = forgeGroup({ key: 'myGroup', fields: [] });
    expect(group.key).toBe('myGroup');
  });

  it('should include the provided fields', () => {
    const fields = [
      { key: 'a', type: 'input' as const, label: 'A' },
      { key: 'b', type: 'input' as const, label: 'B' }
    ];
    const group = forgeGroup({ fields });
    expect(group.fields).toEqual(fields);
  });

  it('should set className when provided', () => {
    const group = forgeGroup({ fields: [], className: 'my-class' });
    expect((group as unknown as Record<string, unknown>)['className']).toBe('my-class');
  });

  it('should set logic when provided', () => {
    const logic = [{ type: 'hidden' as const, condition: true }];
    const group = forgeGroup({ fields: [], logic });
    expect((group as unknown as Record<string, unknown>)['logic']).toEqual(logic);
  });
});

// MARK: forgeDbxSectionFieldWrapper
describe('forgeDbxSectionFieldWrapper()', () => {
  it('should create a section field with the correct type', () => {
    const field = forgeDbxSectionFieldWrapper({ fields: [] });
    expect(field.type).toBe(FORGE_SECTION_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key with _section_ prefix', () => {
    const field = forgeDbxSectionFieldWrapper({ fields: [] });
    expect(field.key).toContain('_section_');
  });

  it('should use a custom key when provided', () => {
    const field = forgeDbxSectionFieldWrapper({ key: 'my_section', fields: [] });
    expect(field.key).toBe('my_section');
  });

  it('should pass header config through props', () => {
    const field = forgeDbxSectionFieldWrapper({ header: 'Title', hint: 'Hint', icon: 'info', h: 2, fields: [] });
    expect(field.props?.headerConfig.header).toBe('Title');
    expect(field.props?.headerConfig.hint).toBe('Hint');
    expect(field.props?.headerConfig.icon).toBe('info');
    expect(field.props?.headerConfig.h).toBe(2);
  });

  it('should default heading level to 3', () => {
    const field = forgeDbxSectionFieldWrapper({ header: 'Test', fields: [] });
    expect(field.props?.headerConfig.h).toBe(3);
  });

  it('should pass child fields through props', () => {
    const childFields = [{ key: 'a', type: 'input' as const, label: 'A' }];
    const field = forgeDbxSectionFieldWrapper({ fields: childFields });
    expect(field.props?.fields).toBe(childFields);
  });

  it('should not set subsection by default', () => {
    const field = forgeDbxSectionFieldWrapper({ fields: [] });
    expect(field.props?.subsection).toBeUndefined();
  });

  it('should set subsection when specified', () => {
    const field = forgeDbxSectionFieldWrapper({ subsection: true, fields: [] });
    expect(field.props?.subsection).toBe(true);
  });

  it('should default heading to 4 when subsection is true', () => {
    const field = forgeDbxSectionFieldWrapper({ subsection: true, header: 'Sub', fields: [] });
    expect(field.props?.headerConfig.h).toBe(4);
  });

  it('should set elevate when specified', () => {
    const field = forgeDbxSectionFieldWrapper({ elevate: true, fields: [] });
    expect(field.props?.elevate).toBe(true);
  });
});

// MARK: forgeDbxSubsectionFieldWrapper
describe('forgeDbxSubsectionFieldWrapper()', () => {
  it('should create a section field with subsection true', () => {
    const field = forgeDbxSubsectionFieldWrapper({ fields: [] });
    expect(field.type).toBe(FORGE_SECTION_FIELD_TYPE_NAME);
    expect(field.props?.subsection).toBe(true);
  });

  it('should default heading level to 4', () => {
    const field = forgeDbxSubsectionFieldWrapper({ header: 'Test', fields: [] });
    expect(field.props?.headerConfig.h).toBe(4);
  });
});

// MARK: forgeWithClassName
describe('forgeWithClassName()', () => {
  it('should return a copy of the field with className set', () => {
    const field = { key: 'test', type: 'input' as const, label: 'Test' };
    const styled = forgeWithClassName(field, 'my-class');
    expect((styled as unknown as Record<string, unknown>)['className']).toBe('my-class');
    expect(styled.key).toBe('test');
  });

  it('should not mutate the original field', () => {
    const field = { key: 'test', type: 'input' as const, label: 'Test' };
    forgeWithClassName(field, 'my-class');
    expect((field as unknown as Record<string, unknown>)['className']).toBeUndefined();
  });
});

// MARK: forgeToggleWrapper
describe('forgeToggleWrapper()', () => {
  it('should create a row field', () => {
    const row = forgeToggleWrapper({ fields: [] });
    expect(row.type).toBe('row');
  });

  it('should contain a toggle field and a content group', () => {
    const row = forgeToggleWrapper({
      fields: [{ key: 'a', type: 'input' as const, label: 'A' }]
    });
    expect(row.fields.length).toBe(2);

    const toggleField = row.fields[0] as Record<string, unknown>;
    expect(toggleField['type']).toBe('toggle');

    const contentGroup = row.fields[1] as Record<string, unknown>;
    expect(contentGroup['type']).toBe('group');
  });

  it('should auto-generate a toggle key with _toggle_ prefix', () => {
    const row = forgeToggleWrapper({ fields: [] });
    const toggleField = row.fields[0] as Record<string, unknown>;
    expect((toggleField['key'] as string).startsWith('_toggle_')).toBe(true);
  });

  it('should use a custom toggle key when provided', () => {
    const row = forgeToggleWrapper({ key: 'myToggle', fields: [] });
    const toggleField = row.fields[0] as Record<string, unknown>;
    expect(toggleField['key']).toBe('myToggle');
  });

  it('should set toggle label', () => {
    const row = forgeToggleWrapper({ label: 'Show more', fields: [] });
    const toggleField = row.fields[0] as Record<string, unknown>;
    expect(toggleField['label']).toBe('Show more');
  });

  it('should default toggle value to false', () => {
    const row = forgeToggleWrapper({ fields: [] });
    const toggleField = row.fields[0] as Record<string, unknown>;
    expect(toggleField['value']).toBe(false);
  });

  it('should set toggle value to true when defaultOpen is true', () => {
    const row = forgeToggleWrapper({ fields: [], defaultOpen: true });
    const toggleField = row.fields[0] as Record<string, unknown>;
    expect(toggleField['value']).toBe(true);
  });

  it('should set hidden logic on the content group', () => {
    const row = forgeToggleWrapper({ key: 'myToggle', fields: [] });
    const contentGroup = row.fields[1] as Record<string, unknown>;
    const logic = contentGroup['logic'] as Array<{ type: string; condition: Record<string, unknown> }>;

    expect(logic).toBeDefined();
    expect(logic.length).toBe(1);
    expect(logic[0].type).toBe('hidden');
    expect(logic[0].condition).toEqual({
      type: 'fieldValue',
      fieldPath: 'myToggle',
      operator: 'equals',
      value: false
    });
  });

  it('should set className on the outer row', () => {
    const row = forgeToggleWrapper({ fields: [], className: 'my-wrapper' });
    expect((row as unknown as Record<string, unknown>)['className']).toBe('my-wrapper');
  });

  it('should use default className when not provided', () => {
    const row = forgeToggleWrapper({ fields: [] });
    expect((row as unknown as Record<string, unknown>)['className']).toBe('dbx-forge-toggle-wrapper');
  });
});

// MARK: forgeExpandField
describe('forgeExpandField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeExpandField({ key: 'expand1' });
    expect(field.type).toBe(FORGE_EXPAND_FIELD_TYPE_NAME);
  });

  it('should use the provided key', () => {
    const field = forgeExpandField({ key: 'myExpand' });
    expect(field.key).toBe('myExpand');
  });

  it('should default value to false', () => {
    const field = forgeExpandField({ key: 'expand1' });
    expect(field.value).toBe(false);
  });

  it('should set value to true when defaultOpen is true', () => {
    const field = forgeExpandField({ key: 'expand1', defaultOpen: true });
    expect(field.value).toBe(true);
  });

  it('should default buttonType to text', () => {
    const field = forgeExpandField({ key: 'expand1' });
    expect(field.props?.buttonType).toBe('text');
  });

  it('should use custom buttonType', () => {
    const field = forgeExpandField({ key: 'expand1', buttonType: 'button' });
    expect(field.props?.buttonType).toBe('button');
  });

  it('should set expandLabel from label', () => {
    const field = forgeExpandField({ key: 'expand1', label: 'Show more' });
    expect(field.props?.expandLabel).toBe('Show more');
  });
});

// MARK: forgeExpandWrapper
describe('forgeExpandWrapper()', () => {
  it('should create a row field', () => {
    const row = forgeExpandWrapper({ fields: [] });
    expect(row.type).toBe('row');
  });

  it('should contain an expand field and a content group', () => {
    const row = forgeExpandWrapper({
      fields: [{ key: 'a', type: 'input' as const, label: 'A' }]
    });
    expect(row.fields.length).toBe(2);

    const expandField = row.fields[0] as Record<string, unknown>;
    expect(expandField['type']).toBe(FORGE_EXPAND_FIELD_TYPE_NAME);

    const contentGroup = row.fields[1] as Record<string, unknown>;
    expect(contentGroup['type']).toBe('group');
  });

  it('should auto-generate an expand key with _expand_ prefix', () => {
    const row = forgeExpandWrapper({ fields: [] });
    const expandField = row.fields[0] as Record<string, unknown>;
    expect((expandField['key'] as string).startsWith('_expand_')).toBe(true);
  });

  it('should use a custom expand key when provided', () => {
    const row = forgeExpandWrapper({ key: 'myExpand', fields: [] });
    const expandField = row.fields[0] as Record<string, unknown>;
    expect(expandField['key']).toBe('myExpand');
  });

  it('should set hidden logic on the content group', () => {
    const row = forgeExpandWrapper({ key: 'myExpand', fields: [] });
    const contentGroup = row.fields[1] as Record<string, unknown>;
    const logic = contentGroup['logic'] as Array<{ type: string; condition: Record<string, unknown> }>;

    expect(logic).toBeDefined();
    expect(logic.length).toBe(1);
    expect(logic[0].type).toBe('hidden');
    expect(logic[0].condition).toEqual({
      type: 'fieldValue',
      fieldPath: 'myExpand',
      operator: 'equals',
      value: false
    });
  });

  it('should pass buttonType to expand field', () => {
    const row = forgeExpandWrapper({ fields: [], buttonType: 'button' });
    const expandField = row.fields[0] as Record<string, unknown>;
    const props = expandField['props'] as { buttonType: string };
    expect(props.buttonType).toBe('button');
  });

  it('should use default className when not provided', () => {
    const row = forgeExpandWrapper({ fields: [] });
    expect((row as unknown as Record<string, unknown>)['className']).toBe('dbx-forge-expand-wrapper');
  });

  it('should use custom className when provided', () => {
    const row = forgeExpandWrapper({ fields: [], className: 'my-expand' });
    expect((row as unknown as Record<string, unknown>)['className']).toBe('my-expand');
  });
});

// MARK: forgeInfoButtonField
describe('forgeInfoButtonField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeInfoButtonField({
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.type).toBe(FORGE_INFO_BUTTON_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key', () => {
    const field = forgeInfoButtonField({
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.key).toContain('_info_button_');
  });

  it('should pass onInfoClick through props', () => {
    const fn = () => {
      // noop
    };
    const field = forgeInfoButtonField({ onInfoClick: fn });
    expect(field.props?.onInfoClick).toBe(fn);
  });

  it('should pass ariaLabel through props', () => {
    const field = forgeInfoButtonField({
      onInfoClick: () => {
        /* noop */
      },
      ariaLabel: 'Help'
    });
    expect(field.props?.ariaLabel).toBe('Help');
  });
});

// MARK: forgeWorkingField
describe('forgeWorkingField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeWorkingField({ watchFieldKey: 'username' });
    expect(field.type).toBe(FORGE_WORKING_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key', () => {
    const field = forgeWorkingField({ watchFieldKey: 'username' });
    expect(field.key).toContain('_working_');
  });

  it('should pass watchFieldKey through props', () => {
    const field = forgeWorkingField({ watchFieldKey: 'username' });
    expect(field.props?.watchFieldKey).toBe('username');
  });
});

// MARK: forgeInfoFieldWrapper
describe('forgeInfoFieldWrapper()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeInfoFieldWrapper({
      fields: [],
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.type).toBe(FORGE_INFO_WRAPPER_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key with _info_wrapper_ prefix', () => {
    const field = forgeInfoFieldWrapper({
      fields: [],
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.key).toContain('_info_wrapper_');
  });

  it('should use a custom key when provided', () => {
    const field = forgeInfoFieldWrapper({
      key: '_my_info',
      fields: [],
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.key).toBe('_my_info');
  });

  it('should pass onInfoClick through props', () => {
    const fn = () => {
      // noop
    };
    const field = forgeInfoFieldWrapper({ fields: [], onInfoClick: fn });
    expect(field.props?.onInfoClick).toBe(fn);
  });

  it('should pass ariaLabel through props', () => {
    const field = forgeInfoFieldWrapper({
      fields: [],
      onInfoClick: () => {
        /* noop */
      },
      ariaLabel: 'Help'
    });
    expect(field.props?.ariaLabel).toBe('Help');
  });

  it('should pass child fields through props', () => {
    const childFields = [{ key: 'a', type: 'input' as const, label: 'A' }];
    const field = forgeInfoFieldWrapper({
      fields: childFields,
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.props?.fields).toBe(childFields);
  });

  it('should initialize value as empty object', () => {
    const field = forgeInfoFieldWrapper({
      fields: [],
      onInfoClick: () => {
        /* noop */
      }
    });
    expect(field.value).toEqual({});
  });
});

// MARK: forgeStyleWrapper
describe('forgeStyleWrapper()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeStyleWrapper({ fields: [] });
    expect(field.type).toBe(FORGE_STYLE_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key with _style_ prefix', () => {
    const field = forgeStyleWrapper({ fields: [] });
    expect(field.key).toContain('_style_');
  });

  it('should use a custom key when provided', () => {
    const field = forgeStyleWrapper({ key: '_my_style', fields: [] });
    expect(field.key).toBe('_my_style');
  });

  it('should pass classGetter through props', () => {
    const field = forgeStyleWrapper({ fields: [], classGetter: 'my-class' });
    expect(field.props?.classGetter).toBe('my-class');
  });

  it('should pass styleGetter through props', () => {
    const styles = { background: 'red' };
    const field = forgeStyleWrapper({ fields: [], styleGetter: styles });
    expect(field.props?.styleGetter).toBe(styles);
  });

  it('should pass child fields through props', () => {
    const childFields = [{ key: 'a', type: 'input' as const, label: 'A' }];
    const field = forgeStyleWrapper({ fields: childFields });
    expect(field.props?.fields).toBe(childFields);
  });

  it('should initialize value as empty object', () => {
    const field = forgeStyleWrapper({ fields: [] });
    expect(field.value).toEqual({});
  });
});

// MARK: forgeWorkingFieldWrapper
describe('forgeWorkingFieldWrapper()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeWorkingFieldWrapper({ fields: [] });
    expect(field.type).toBe(FORGE_WORKING_WRAPPER_FIELD_TYPE_NAME);
  });

  it('should auto-generate a key with _working_wrapper_ prefix', () => {
    const field = forgeWorkingFieldWrapper({ fields: [] });
    expect(field.key).toContain('_working_wrapper_');
  });

  it('should use a custom key when provided', () => {
    const field = forgeWorkingFieldWrapper({ key: '_my_working', fields: [] });
    expect(field.key).toBe('_my_working');
  });

  it('should pass child fields through props', () => {
    const childFields = [{ key: 'a', type: 'input' as const, label: 'A' }];
    const field = forgeWorkingFieldWrapper({ fields: childFields });
    expect(field.props?.fields).toBe(childFields);
  });

  it('should initialize value as empty object', () => {
    const field = forgeWorkingFieldWrapper({ fields: [] });
    expect(field.value).toEqual({});
  });
});

// MARK: forgeFormFieldWrapper
describe('forgeFormFieldWrapper()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeFormFieldWrapper({ fields: [] });
    expect(field.type).toBe(FORGE_FORM_FIELD_WRAPPER_TYPE_NAME);
  });

  it('should auto-generate a key with _formfield_ prefix', () => {
    const field = forgeFormFieldWrapper({ fields: [] });
    expect(field.key).toContain('_formfield_');
  });

  it('should use a custom key when provided', () => {
    const field = forgeFormFieldWrapper({ key: '_my_field', fields: [] });
    expect(field.key).toBe('_my_field');
  });

  it('should set label at the field level', () => {
    const field = forgeFormFieldWrapper({ label: 'My Label', fields: [] });
    expect(field.label).toBe('My Label');
  });

  it('should default label to empty string', () => {
    const field = forgeFormFieldWrapper({ fields: [] });
    expect(field.label).toBe('');
  });

  it('should pass hint through props', () => {
    const field = forgeFormFieldWrapper({ hint: 'A hint', fields: [] });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should pass child fields through props', () => {
    const childFields = [{ key: 'a', type: 'input' as const, label: 'A' }];
    const field = forgeFormFieldWrapper({ fields: childFields as any });
    expect(field.props?.fields).toBe(childFields);
  });

  it('should initialize value as empty object', () => {
    const field = forgeFormFieldWrapper({ fields: [] });
    expect(field.value).toEqual({});
  });
});
