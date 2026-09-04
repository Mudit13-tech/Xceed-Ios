module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  // Injected at build time by the `define` in vite.config.js, so it exists in
  // the bundle but nowhere eslint can infer it from.
  globals: { __APP_VERSION__: 'readonly' },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],

  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
    'no-unused-vars': 'off',
  },
};
