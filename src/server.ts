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

        // 1. HTTP Endpoint: Submit Order
        app.post('/orders', async (request, reply) => {
            const { tokenIn, tokenOut, amount } = request.body as any;
            const orderId = uuidv4();

            // Add to BullMQ
            await orderQueue.add('trade', { orderId, tokenIn, tokenOut, amount });

            return { orderId, status: 'pending', message: 'Order queued. Connect to WS for updates.' };
        });

        // 2. WebSocket Endpoint: Live Updates
        app.get('/orders/:id/ws', { websocket: true }, (connection, req) => {
            const orderId = (req.params as any).id;
            console.log(`Client connected for order: ${orderId}`);

            // Listen for "progress" events from the Worker
            const onProgress = ({ jobId, data }: any) => {
                // In real production, verify jobId matches orderId mapping
                if (data?.orderId === orderId) {
                    connection.socket.send(JSON.stringify(data));
                }
            };

            // Listen for "completed" events
            const onCompleted = ({ jobId, returnvalue }: any) => {
                // Ideally check if this job matches the order
                connection.socket.send(JSON.stringify({ status: 'confirmed', data: returnvalue }));
            };

            queueEvents.on('progress', onProgress);
            queueEvents.on('completed', onCompleted);

            // Cleanup listeners on disconnect
            connection.socket.on('close', () => {
                queueEvents.off('progress', onProgress);
                queueEvents.off('completed', onCompleted);
            });
        });

        await app.listen({ port: 3000 });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();