// Utilidades básicas para la extensión
const Utils = {
  log: (...args) => console.log('[AccountManager]', ...args),
  error: (...args) => console.error('[AccountManager ERROR]', ...args)
};

if (typeof module !== 'undefined') {
  module.exports = Utils;
}