import { Worker, Job } from 'bullmq';
import { MockDexRouter } from './services/mockDex';
import { saveOrder } from './db/connection';
import IORedis from 'ioredis';

const redisConnection = new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });
const router = new MockDexRouter();

export const orderWorker = new Worker('order-queue', async (job: Job) => {
    const { orderId, tokenIn, tokenOut, amount } = job.data;
    console.log(`[Worker] Processing Order ${orderId}`);

    // Save initial order to database
    await saveOrder({
        orderId,
        tokenIn,
        tokenOut,
        amountIn: amount,
        status: 'pending',
    });

    // Artificial delay to test WebSocket
    await new Promise(resolve => setTimeout(resolve, 2000));

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

    // Calculate amount out (simplified calculation)
    const amountOut = amount * bestRoute.price;

    // Save completed order to database
    await saveOrder({
        orderId,
        tokenIn,
        tokenOut,
        amountIn: amount,
        amountOut,
        price: bestRoute.price,
        status: 'completed',
        txHash,
        dexName: bestRoute.dex,
    });

    console.log(`[Worker] Order ${orderId} completed and saved to database`);

    // 3. Final Result
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