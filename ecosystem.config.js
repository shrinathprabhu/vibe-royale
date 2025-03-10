module.exports = {
  apps: [
    {
      name: "vibe-royale",
      script: "dist/server/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 5601,
      },
    },
  ],
};
