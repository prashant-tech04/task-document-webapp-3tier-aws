// config.js
// In AWS, NGINX proxies /api to the App ALB, so the default works as is.
// For local development (backend on port 3000) use:
//   API_BASE: 'http://localhost:3000/api'
window.APP_CONFIG = {
  API_BASE: '/api'
};
