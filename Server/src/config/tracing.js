import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { env } from './env.js';
import { logger } from './logger.js';

const traceContext = new AsyncLocalStorage();

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
    return trace.getActiveSpan()?.spanContext().traceId || traceContext.getStore()?.traceId || null;
}

export function createTraceId() {
    return randomBytes(16).toString('hex');
}

export function getOrCreateTraceId(preferredTraceId = null) {
    return getActiveTraceId() || preferredTraceId || createTraceId();
}

export function runWithTraceId(traceId, callback) {
    return traceContext.run({ traceId }, callback);
}

export function recordAuditTrace(name, attributes = {}) {
    const span = trace.getActiveSpan();
    if (!span) return null;

    span.addEvent(name, attributes);
    return span.spanContext().traceId;
}
