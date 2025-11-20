import { Worker, Job } from 'bullmq';
import { MockDexRouter } from './services/mockDex';
import IORedis from 'ioredis';

const redisConnection = new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });
const router = new MockDexRouter();

export const orderWorker = new Worker('order-queue', async (job: Job) => {
    const { orderId, tokenIn, amount } = job.data;
    console.log(`[Worker] Processing Order ${orderId}`);

    // 1. Update Status: Routing
    await job.updateProgress({ orderId, status: 'routing', stage: 'Fetching quotes from Raydium & Meteora...' });
    
    // Call Mock Router
    const bestRoute = await router.findBestRoute(tokenIn, amount);

    // 2. Update Status: Executing
    await job.updateProgress({ 
        orderId, 
        status: 'executing', 
        stage: `Route found: ${bestRoute.dex} @ $${bestRoute.price.toFixed(2)}. Building Transaction...` 
    });

    // Call Mock Execution
    const txHash = await router.executeSwap(bestRoute.dex);

    // 3. Final Result
    // In a real app, you would save to Postgres here.
    return {
        status: 'completed',
        txHash,
        finalPrice: bestRoute.price,
        dex: bestRoute.dex
    };

}, { 
    connection: redisConnection,
    concurrency: 5 // Can handle 5 orders at once
});