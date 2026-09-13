import './config/tracing.js';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';
import { startBackgroundProcessing } from './shared/background-jobs.js';

const PORT = env.PORT || 5000;
let server;
let stopBackgroundProcessing;

async function bootstrap() {
    try {
        // Verify DB connectivity
        await connectDatabase();

        server = app.listen(PORT, () => {
            logger.info({ port: PORT, environment: env.NODE_ENV }, 'Server started');
        });
        stopBackgroundProcessing = startBackgroundProcessing();
    } catch (error) {
        logger.fatal({ err: error }, 'Failed to start server');
        await disconnectDatabase();
        process.exit(1);
    }
}

async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown signal received');

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    stopBackgroundProcessing?.();

    await disconnectDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    logger.fatal({ err: error }, 'Unhandled promise rejection');
    process.exit(1);
});

bootstrap();