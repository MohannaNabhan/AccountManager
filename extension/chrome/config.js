const CONFIG = {
  SERVER_URL: 'http://localhost:8765',
  ENDPOINTS: {
    STATUS: '/status',
    SHOW_APP: '/show-app'
  }
};

if (typeof module !== 'undefined') {
  module.exports = CONFIG;
}