import { Worker, Job } from 'bullmq';
import { MockDexRouter } from './services/mockDex';
import { saveOrder } from './db/connection';
import IORedis from 'ioredis';

const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});
const router = new MockDexRouter();

export const orderWorker = new Worker('order-queue', async (job: Job) => {
    const { orderId, tokenIn, tokenOut, amount } = job.data;
    const attemptNumber = job.attemptsMade + 1;

    console.log(`[Worker] Processing Order ${orderId} (Attempt ${attemptNumber}/3)`);

    try {
        // Save initial order to database
        await saveOrder({
            orderId,
            tokenIn,
            tokenOut,
            amountIn: amount,
            status: 'pending',
        });

        // Artificial delay to test WebSocket (for testing purposes)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 1. Update Status: Routing
        await job.updateProgress({ orderId, status: 'routing', stage: 'Fetching quotes from Raydium & Meteora...' });

        // Call Mock Router (returns both quotes and best route)
        const routingResult = await router.findBestRoute(tokenIn, amount);
        const bestRoute = routingResult.bestRoute;
        const quotes = routingResult.quotes;

        // 2. Update Status: Building (include price comparison)
        await job.updateProgress({
            orderId,
            status: 'building',
            stage: `Route found: ${bestRoute.dex} @ $${bestRoute.price.toFixed(2)}. Building transaction...`,
            quotes: quotes  // Send both DEX quotes
        });

        // Simulate building transaction
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Update Status: Submitted
        await job.updateProgress({
            orderId,
            status: 'submitted',
            stage: 'Transaction submitted to network. Waiting for confirmation...'
        });

        // Call Mock Execution (confirmation)
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
            dex: bestRoute.dex,
            amountOut  // Include output amount
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Error processing order ${orderId} (Attempt ${attemptNumber}):`, errorMessage);

        // Update progress to show error
        await job.updateProgress({
            orderId,
            status: 'failed',
            stage: `Error: ${errorMessage}`,
            error: errorMessage,
            attempt: attemptNumber
        });

        // If this is the last attempt, save as failed in database
        if (attemptNumber >= 3) {
            await saveOrder({
                orderId,
                tokenIn,
                tokenOut,
                amountIn: amount,
                status: 'failed',
            });
            console.error(`[Worker] Order ${orderId} permanently failed after 3 attempts`);
        }

        // Re-throw error to trigger BullMQ retry
        throw error;
    }

}, {
    connection: redisConnection,
    concurrency: 10, // Can handle up to 10 orders concurrently
});

// Listen for failed jobs (after all retries exhausted)
orderWorker.on('failed', async (job, err) => {
    if (job) {
        const { orderId } = job.data;
        console.error(`[Worker] Job ${job.id} (Order ${orderId}) failed permanently:`, err.message);

        // Send final failure notification via progress
        await job.updateProgress({
            orderId,
            status: 'failed',
            stage: 'Order failed after 3 attempts',
            error: err.message
        });
    }
});

// Log successful completions
orderWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
});