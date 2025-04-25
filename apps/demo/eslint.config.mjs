import baseAngularLibraryConfig from '../../eslint.config.angular.mjs';

/**
 * This configuration is for the app and checks for the demo, doc, and app prefixes in the angular selectors
 */
export default [
  ...baseAngularLibraryConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: ['demo', 'doc', 'app'],
          style: 'camelCase'
        }
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['demo', 'doc', 'app'],
          style: 'kebab-case'
        }
      ]
    }
  }
];
