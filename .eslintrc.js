const enabledRuleParams = {
  // Core ESLint rules
  'accessor-pairs': [],
  'array-bracket-spacing': [],
  'arrow-parens': [`as-needed`],
  'arrow-spacing': [],
  'block-spacing': [],
  'brace-style': [`stroustrup`],
  'camelcase': [],
  'comma-dangle': [`always-multiline`],
  'comma-spacing': [],
  'comma-style': [],
  'complexity': [7],
  'consistent-return': [],
  'curly': [`all`],
  'dot-location': [`property`],
  'dot-notation': [{ allowPattern: `^(if|then)$` }],
  'eol-last': [`always`],
  'eqeqeq': [`always`, { null: `ignore` }],
  'func-call-spacing': [],
  'getter-return': [],
  'grouped-accessor-pairs': [`getBeforeSet`],
  'guard-for-in': [],
  'indent': [2, { SwitchCase: 1 }],
  'key-spacing': [],
  'keyword-spacing': [],
  'linebreak-style': [],
  'new-parens': [],
  'no-array-constructor': [],
  'no-bitwise': [],
  'no-confusing-arrow': [{ allowParens: true }],
  'no-else-return': [{ allowElseIf: false }],
  'no-irregular-whitespace': [],
  'no-lonely-if': [],
  'no-loop-func': [],
  'no-mixed-operators': [],
  'no-multi-spaces': [],
  'no-new-object': [],
  'no-prototype-builtins': [],
  'no-return-assign': [],
  'no-shadow': [{ builtinGlobals: false }],
  'no-template-curly-in-string': [],
  'no-trailing-spaces': [],
  'no-unused-vars': [{ args: `none` }],
  'no-var': [],
  'object-curly-spacing': [`always`],
  'object-shorthand': [`always`, { avoidQuotes: true }],
  'prefer-arrow-callback': [],
  'prefer-const': [{ destructuring: `all` }],
  'prefer-rest-params': [],
  'prefer-template': [],
  'quotes': [`backtick`, { allowTemplateLiterals: true }],
  'radix': [],
  'semi': [],
  'space-before-blocks': [],
  'space-before-function-paren': [{
    anonymous: `never`,
    named: `never`,
    asyncArrow: `always`,
  }],
  'space-in-parens': [],
  'space-infix-ops': [],
  'spaced-comment': [`always`],
  'template-curly-spacing': [],

  // eslint-plugin-jsdoc
  'jsdoc/check-alignment': [],
  'jsdoc/check-indentation': [],
  'jsdoc/check-param-names': [],
  'jsdoc/check-syntax': [],
  'jsdoc/check-tag-names': [],
  'jsdoc/check-types': [],
  'jsdoc/implements-on-classes': [],
  'jsdoc/require-jsdoc': [{
    enableFixer: false,
    require: {
      FunctionDeclaration: true,
      MethodDefinition: true,
      ClassDeclaration: true,
      ArrowFunctionExpression: false,
      FunctionExpression: false,
    },
  }],
  'jsdoc/require-param': [],
  'jsdoc/require-param-description': [],
  'jsdoc/require-param-name': [],
  'jsdoc/require-param-type': [],
  'jsdoc/require-returns': [],
  'jsdoc/require-returns-check': [],
  'jsdoc/require-returns-description': [],
  'jsdoc/require-returns-type': [],
  'jsdoc/valid-types': [],

  // eslint-plugin-promise
  'promise/no-callback-in-promise': [],
  'promise/no-nesting': [],
  'promise/no-promise-in-callback': [],
  'promise/no-return-in-finally': [],
  'promise/prefer-await-to-then': [],
  'promise/valid-params': [],

  // eslint-plugin-vue
  'vue/component-definition-name-casing': [],
  'vue/component-name-in-template-casing': [`PascalCase`, {
    registeredComponentsOnly: false,
  }],
  'vue/component-tags-order': [{
    order: [`template`, `style`, `script`],
  }],
  'vue/html-closing-bracket-newline': [{
    singleline: `never`,
    multiline: `never`,
  }],
  'vue/html-closing-bracket-spacing': [],
  'vue/match-component-file-name': [{
    extensions: [`vue`],
    shouldMatchCase: true,
  }],
  'vue/max-attributes-per-line': [{ singleline: 3 }],
  'vue/no-deprecated-scope-attribute': [],
  'vue/no-deprecated-slot-attribute': [],
  'vue/no-deprecated-slot-scope-attribute': [],
  'vue/no-empty-component-block': [],
  'vue/no-mutating-props': [],
  'vue/no-unused-properties': [{
    groups: [`props`, `data`, `computed`, `methods`, `setup`],
  }],
  'vue/prop-name-casing': [],
  'vue/require-direct-export': [],
  'vue/v-for-delimiter-style': [`of`],
  'vue/v-on-function-call': [`always`],
  'vue/v-slot-style': [`shorthand`],
  'vue/valid-v-slot': [],
};

const vueCoreExtensionRules = [
  `array-bracket-newline`,
  `array-bracket-spacing`,
  `arrow-spacing`,
  `block-spacing`,
  `brace-style`,
  `camelcase`,
  `comma-dangle`,
  `comma-spacing`,
  `comma-style`,
  `dot-location`,
  `dot-notation`,
  `eqeqeq`,
  `func-call-spacing`,
  `key-spacing`,
  `keyword-spacing`,
  `max-len`,
  `no-empty-pattern`,
  `no-extra-parens`,
  `no-irregular-whitespace`,
  `no-restricted-syntax`,
  `no-sparse-arrays`,
  `no-useless-concat`,
  `object-curly-newline`,
  `object-curly-spacing`,
  `object-property-newline`,
  `operator-linebreak`,
  `prefer-template`,
  `space-in-parens`,
  `space-infix-ops`,
  `space-unary-ops`,
  `template-curly-spacing`,
];

const warnRules = [
  `complexity`,
  `no-loop-func`,
  `jsdoc/require-jsdoc`,
  `vue/no-mutating-props`,
];

const disabledRules = [
  `no-console`,
  `jsdoc/newline-after-description`,
  `jsdoc/no-undefined-types`,
  `jsdoc/require-description`,
  `jsdoc/require-description-complete-sentence`,
  `promise/always-return`,
  `security/detect-child-process`,
  `security/detect-non-literal-fs-filename`,
  `security/detect-non-literal-require`,
  `security/detect-object-injection`,
  `vue/multiline-html-element-content-newline`,
  `vue/singleline-html-element-content-newline`,
];

for (const ruleName of vueCoreExtensionRules) {
  if (ruleName in enabledRuleParams) {
    enabledRuleParams[`vue/${ruleName}`] = enabledRuleParams[ruleName];
  }
}

module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  plugins: [
    `array-func`,
    `jsdoc`,
    `json`,
    `markdown`,
    `nuxt`,
    `promise`,
    `security`,
    `vue`,
  ],
  extends: [
    `eslint:recommended`,
    `plugin:array-func/all`,
    `plugin:jsdoc/recommended`,
    `plugin:json/recommended`,
    `plugin:nuxt/recommended`,
    `plugin:promise/recommended`,
    `plugin:security/recommended`,
    `plugin:vue/recommended`,
  ],
  rules: {
    ...Object.fromEntries(
      Object.entries(enabledRuleParams).map(([ruleName, params]) => [
        ruleName,
        [warnRules.includes(ruleName) ? `warn` : `error`, ...params],
      ]),
    ),
    ...Object.fromEntries(
      disabledRules.map(ruleName => [ruleName, `off`]),
    ),
  },
  settings: {
    jsdoc: {
      mode: `typescript`,
      tagNamePreference: {
        augments: `extends`,
        class: `constructor`,
        file: `fileoverview`,
        fires: `emits`,
        linkcode: `link`,
        linkplain: `link`,
        overview: `fileoverview`,
      },
      preferredTypes: {
        array: `Array`,
        boolean: `Boolean`,
        number: `Number`,
        object: `Object`,
        string: `String`,
        '<>': `.<>`,
        '[]': `Array.<>`,
      },
    },
  },
  overrides: [
    {
      files: [`**/*.md`],
      rules: {
        'no-undef': `off`,
        'no-unused-vars': `off`,
        'require-jsdoc': `off`,
      },
    },
    {
      files: [`**/*.vue`, `**/*.json`],
    },
  ],
};
