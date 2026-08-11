module.exports = {
  root: true,
  parser: '@babel/eslint-parser',
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'standard',
    'standard-react'
  ],
  env: { es6: true },
  plugins: ['react', 'react-native', 'react-hooks'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    requireConfigFile: false
  },
  rules: {
    'no-case-declarations': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react/display-name': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-closing-bracket-location': 0,
    allowTemplateLiterals: 0,
    'react/jsx-closing-tag-location': 0,
    'react/jsx-handler-names': [
      'error',
      {
        eventHandlerPrefix: '(handle|on)',
        eventHandlerPropPrefix: '(handle|on)'
      }
    ],
    'no-async-promise-executor': 0,
    'no-undef': 'error',
    'react-native/no-unused-styles': 2,
    'no-unused-vars': 'error',
    'react/prop-types': 0,
    'no-console': 0,
    'react/sort-comp': 2,
    'react/no-string-refs': 0,
    indent: [2, 2, { SwitchCase: 1 }],
    'react/jsx-first-prop-new-line': [1, 'multiline'],
    'react/jsx-max-props-per-line': [
      1,
      {
        maximum: 1,
        when: 'multiline'
      }
    ],
    'react/jsx-wrap-multilines': [
      1,
      {
        declaration: 'parens-new-line',
        assignment: 'parens-new-line',
        return: 'parens-new-line',
        arrow: 'parens-new-line',
        condition: 'parens-new-line',
        logical: 'parens-new-line',
        prop: 'parens-new-line'
      }
    ]
    // 'object-curly-newline': ['error', {
    //   ObjectExpression: 'never',
    //   ObjectPattern: {
    //     multiline: true
    //   },
    //   ImportDeclaration: 'never',
    //   ExportDeclaration: {
    //     multiline: true
    //   }
    // }]
  },
  globals: {
    fetch: true,
    enquire: true,
    FontFaceObserver: true,
    imagesloaded: true,
    Modernizr: true,
    ISIOS: false,
    ISMAC: false,
    __DEV__: true,
    BigInt: true
  },
  overrides: [
    {
      files: ['*.js'],
      rules: { 'react/jsx-handler-names': 0 }
    }
  ]
}
