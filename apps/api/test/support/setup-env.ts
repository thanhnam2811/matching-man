// Set required environment variables before any module imports.
// ConfigModule.forRoot({ validate }) runs at module-load time when AppModule is
// imported, so these must be in place before the first `import` of any file that
// transitively imports AppModule.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://admin:password@127.0.0.1:5432/matching_hub?schema=public";
process.env.DASHBOARD_ADMIN_TOKEN ??= "test-dashboard-token";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";
