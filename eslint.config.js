// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores(['dist/*', 'supabase/functions/**']),
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // React Native Animated refs and hydration effects are intentionally imperative.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'import/no-unresolved': 'off',
    },
  }
]);
