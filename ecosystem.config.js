module.exports = {
  apps: [
    {
      name: "app-proativo-frontend",
      script: "serve",
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      }
    },
    {
      name: "app-proativo-backend",
      script: "backend/services/processarmensagem.py",
      interpreter: "./venv/bin/python",
      env: {
        PORT: 6969
      }
    }
  ]
};
