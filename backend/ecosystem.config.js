module.exports = {
  apps: [
    {
      name: 'ai-financer',
      script: 'dist/index.js',
      cwd: '/root/ai-financer/backend',
      env: {
        NODE_ENV: 'production',
        AI_PROVIDER: 'deepseek',
        AI_MODE: 'deepseek',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
        DEEPSEEK_FAST_MODEL: 'deepseek-chat',
        DEEPSEEK_MODEL: 'deepseek-chat',
        DEEPSEEK_REASONING_MODEL: 'deepseek-reasoner',
        AI_FAST_TIMEOUT_MS: '8000',
        AI_LLM_TIMEOUT_MS: '12000',
        AI_TIMEOUT_MS: '10000',
      },
    },
  ],
};
