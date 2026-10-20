// Análise estática (manutenibilidade, ISO/IEC 25010:2023). Rodada no CI.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'resultados/**', '.lighthouseci/**', 'apps-script/**', 'assets/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      complexity: ['warn', 20],
      'max-depth': ['warn', 5],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['testes/**/*.mjs', 'testes-regras/**/*.mjs', 'ferramentas/**/*.mjs', '*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] },
  },
];
