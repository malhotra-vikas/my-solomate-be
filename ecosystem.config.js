module.exports = {
  apps: [
    {
      name: "solomate",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};

