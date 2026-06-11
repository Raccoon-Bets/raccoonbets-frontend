import { type Config } from 'stylelint'

const config: Config = {
  extends: ['stylelint-config-standard'],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['**/*.scss'],
      customSyntax: 'postcss-scss',
    },
  ],
  rules: {
    'at-rule-descriptor-value-no-unknown': null,
    'declaration-property-value-no-unknown': null,
    'import-notation': null,
    'no-invalid-position-at-import-rule': null,
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['deep', 'global', 'slotted'] },
    ],
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'use',
          'mixin',
          'include',
          'extend',
          'if',
          'else',
          'each',
          'for',
          'forward',
        ],
      },
    ],
  },
}

export default config
