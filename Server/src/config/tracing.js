import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { env } from './env.js';
import { logger } from './logger.js';

const exporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
    : undefined;

const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: exporter,
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

sdk.start();

if (exporter) {
    logger.info({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }, 'OpenTelemetry tracing enabled');
}

process.once('SIGTERM', async () => {
    await sdk.shutdown();
});

export function getActiveTraceId() {
    return trace.getActiveSpan()?.spanContext().traceId || null;
}

export function recordAuditTrace(name, attributes = {}) {
    const span = trace.getActiveSpan();
    if (!span) return null;

    span.addEvent(name, attributes);
    return span.spanContext().traceId;
}
