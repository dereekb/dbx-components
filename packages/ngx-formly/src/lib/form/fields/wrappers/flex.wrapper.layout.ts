import { FormlyFieldConfig } from '@ngx-formly/core';

export type FormFlexLayoutSize = 1 | 2 | 3 | 4 | 5 | 6;

export interface FieldFlexLayoutGroupFieldConfig {
  field: FormlyFieldConfig;
  size?: FormFlexLayoutSize;
  retainSizeOnSmallScreen?: boolean;
}

export interface FieldFlexLayoutGroupFieldConfigDefaults extends Omit<FieldFlexLayoutGroupFieldConfig, 'field'> { }

export function flexLayoutWrapper(fieldConfigs: FieldFlexLayoutGroupFieldConfig[], { size: defaultSize = 2, retainSizeOnSmallScreen }: FieldFlexLayoutGroupFieldConfigDefaults = {}): FormlyFieldConfig {
  const defaultRetainSizeOnSmallScreen = retainSizeOnSmallScreen;

  return {
    wrappers: ['flex'],
    fieldGroupClassName: 'form-flex-section-group',
    // fieldGroupClassName: 'field-layout-group',
    fieldGroup: fieldConfigs.map((config) => {
      const { field, size = defaultSize, retainSizeOnSmallScreen = defaultRetainSizeOnSmallScreen } = config;

      let className = `form-flex-${size}`;

      if (retainSizeOnSmallScreen != false) {
        className = className + ' form-flex-responsive';
      }

      return {
        ...field,
        className
      };
    })
  };
}
