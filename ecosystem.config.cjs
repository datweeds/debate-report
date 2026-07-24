module.exports = {
  apps: [
    {
      name: 'debate-report',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/david/debate-report',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },
    },
  ],
};
