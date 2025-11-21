import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const app = Fastify({ logger: true });
const redisConnection = new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });

// Setup Queue
const orderQueue = new Queue('order-queue', { connection: redisConnection });
const queueEvents = new QueueEvents('order-queue', { connection: redisConnection });

// Start Server
const start = async () => {
    try {
        await app.register(websocket);

        // Register static file plugin
        const path = require('path');
        const fs = require('fs');
        const fastifyStatic = require('@fastify/static');

        await app.register(fastifyStatic, {
            root: path.join(__dirname, '../public'),
            prefix: '/'
        });

        // Serve frontend at root
        app.get('/', async (request, reply) => {
            const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');
            reply.type('text/html').send(html);
        });

        // 1. HTTP Endpoint: Submit Order
        app.post('/api/orders/execute', async (request, reply) => {
            const { tokenIn, tokenOut, amount } = request.body as any;
            const orderId = uuidv4();

            // Add to BullMQ with retry configuration
            await orderQueue.add('trade', { orderId, tokenIn, tokenOut, amount }, {
                attempts: 3, // Retry up to 3 times
                backoff: {
                    type: 'exponential', // Exponential backoff
                    delay: 2000, // Initial delay: 2s, then 4s, then 8s
                }
            });

            return { orderId, status: 'pending', message: 'Order queued. Connect to WS for updates.' };
        });

        // 2. WebSocket Endpoint: Live Updates
        app.get('/orders/:id/ws', { websocket: true }, (socket, req) => {
            const orderId = (req.params as any).id;
            console.log(`Client connected for order: ${orderId}`);

            // Send initial connection confirmation
            socket.send(JSON.stringify({
                status: 'connected',
                orderId,
                message: 'WebSocket connected. Listening for updates...'
            }));

            // Listen for "progress" events from the Worker
            const onProgress = ({ jobId, data }: any) => {
                if (data?.orderId === orderId && socket.readyState === 1) {
                    console.log(`Sending progress to client:`, data);
                    socket.send(JSON.stringify(data));
                }
            };

            // Listen for "completed" events
            const onCompleted = async ({ jobId, returnvalue }: any) => {
                // Fetch the job to check if it's for this orderId
                const job = await orderQueue.getJob(jobId);
                if (job && job.data?.orderId === orderId && socket.readyState === 1) {
                    console.log(`Sending completion to client for order ${orderId}:`, returnvalue);
                    socket.send(JSON.stringify({ status: 'confirmed', data: returnvalue }));
                }
            };

            // Listen for "failed" events
            const onFailed = async ({ jobId, failedReason }: any) => {
                // Fetch the job to check if it's for this orderId
                const job = await orderQueue.getJob(jobId);
                if (job && job.data?.orderId === orderId && socket.readyState === 1) {
                    console.log(`Sending failure to client for order ${orderId}:`, failedReason);
                    socket.send(JSON.stringify({
                        status: 'failed',
                        error: failedReason,
                        message: 'Order failed after 3 retry attempts'
                    }));
                }
            };

            queueEvents.on('progress', onProgress);
            queueEvents.on('completed', onCompleted);
            queueEvents.on('failed', onFailed);

            // Cleanup listeners on disconnect
            socket.on('close', () => {
                console.log(`Client disconnected for order: ${orderId}`);
                queueEvents.off('progress', onProgress);
                queueEvents.off('completed', onCompleted);
                queueEvents.off('failed', onFailed);
            });

            socket.on('error', (err: Error) => {
                console.error(`WebSocket error for order ${orderId}:`, err);
            });
        });

        await app.listen({ port: 3000 });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();