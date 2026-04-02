module.exports = {
  apps: [
    {
      name: "VITE-APP",
      script: "serve",
      env: {
        PM2_SERVE_PATH: "./dist",
        PM2_SERVE_PORT: 3000,
        PM2_SERVE_SPA: "true"
      }
    },
    {
      name: "PYTHON-APP",
      script: "./venv/bin/python",
      args: "backend/services/processarmensagem.py",
      interpreter: "none",
      env: {
        PORT: 6969
      }
    },
    {
      name: "TICKET-APP",
      script: "./venv/bin/python",
      args: "backend/services/processarticket.py",
      interpreter: "none",
      env: {
        PORT: 6970
      }
    }
  ]
};