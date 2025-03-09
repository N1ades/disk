const env = {
}

module.exports = {
    setEnv(name, value) {
        env[name] = value;
    },
    apps: [
        {
            cwd: __dirname,
            name: "disk",
            script: "npm",
            // args: "upload/index.js",
            args: "start",
            exp_backoff_restart_delay: 100,
            env
        },
    ],
};
