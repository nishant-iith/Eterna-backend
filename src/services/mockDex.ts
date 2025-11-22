import type { DexQuote } from '../types';

export class MockDexRouter {

    // Simulate fetching a price from a DEX
    private async getQuote(dex: 'Raydium' | 'Meteora', basePrice: number): Promise<DexQuote> {
        // Artificial Network Delay (200ms - 500ms)
        const delay = Math.floor(Math.random() * 300) + 200;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Add random variance (2-5% difference) as per assignment
        // Raydium: -2% to +2%, Meteora: -1% to +4%
        const varianceRange = dex === 'Raydium' ? 0.04 : 0.05;
        const varianceOffset = dex === 'Raydium' ? -0.02 : -0.01;
        const variance = 1 + (Math.random() * varianceRange + varianceOffset);
        const price = basePrice * variance;

        return { dex, price, fee: 0.003 }; // 0.3% fee
    }

    // The main function called by the worker
    async findBestRoute(tokenIn: string, amount: number) {
        const baseMarketPrice = 150.00; // Mock price of SOL

        // Fetch from both "simultaneously"
        const [raydium, meteora] = await Promise.all([
            this.getQuote('Raydium', baseMarketPrice),
            this.getQuote('Meteora', baseMarketPrice)
        ]);

        console.log(`Quotes: Raydium ($${raydium.price.toFixed(2)}), Meteora ($${meteora.price.toFixed(2)})`);

        // Return the DEX with the higher price (we're selling tokenIn to get more tokenOut)
        const bestRoute = raydium.price > meteora.price ? raydium : meteora;

        return {
            bestRoute,
            quotes: { raydium, meteora }
        };
    }

    // Simulate the actual transaction on Solana
    async executeSwap(dexName: string): Promise<string> {
        // 2-second delay for "Confirming Transaction..."
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate fake Tx Hash
        return '5Kj...' + Math.random().toString(36).substring(2, 15);
    }
}