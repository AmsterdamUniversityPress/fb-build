module.exports = (api) => {
  api.cache.forever ()
  return {
    presets: [[
      '@babel/env',
      {
        // --- false = output es modules.
        modules: false,
        targets: {
        },
      },
    ]],
    plugins: [
      'alleycat-stick-transforms',
      // --- reduce code size and avoid namespace pollution (e.g. global
      // polyfills; be sure to add @babel/runtime to runtime deps).
      '@babel/transform-runtime',
    ],
  }
}
