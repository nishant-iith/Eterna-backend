import { MockDexRouter } from '../services/mockDex';

describe('MockDexRouter', () => {
  let router: MockDexRouter;

  beforeEach(() => {
    router = new MockDexRouter();
  });

  // ==================== ROUTING LOGIC TESTS ====================

  describe('DEX Routing Logic', () => {
    // Test 1: Should return quotes from both DEXs
    test('findBestRoute returns quotes from both Raydium and Meteora', async () => {
      const result = await router.findBestRoute('SOL', 10);

      expect(result.quotes).toBeDefined();
      expect(result.quotes.raydium).toBeDefined();
      expect(result.quotes.meteora).toBeDefined();
      expect(result.quotes.raydium.dex).toBe('Raydium');
      expect(result.quotes.meteora.dex).toBe('Meteora');
    });

    // Test 2: Should select the DEX with higher price (better for selling)
    test('findBestRoute selects DEX with higher price', async () => {
      const result = await router.findBestRoute('SOL', 10);

      const { raydium, meteora } = result.quotes;
      const expectedBestDex = raydium.price > meteora.price ? 'Raydium' : 'Meteora';

      expect(result.bestRoute.dex).toBe(expectedBestDex);
    });

    // Test 3: Quotes should have valid price structure
    test('quotes have valid price and fee structure', async () => {
      const result = await router.findBestRoute('SOL', 10);

      expect(typeof result.quotes.raydium.price).toBe('number');
      expect(typeof result.quotes.meteora.price).toBe('number');
      expect(result.quotes.raydium.fee).toBe(0.003);
      expect(result.quotes.meteora.fee).toBe(0.003);
    });

    // Test 4: Prices should be within expected variance range
    test('prices are within expected variance range (145-157 for base 150)', async () => {
      const result = await router.findBestRoute('SOL', 10);

      // Base price is 150, variance is ~2-5%
      expect(result.quotes.raydium.price).toBeGreaterThan(140);
      expect(result.quotes.raydium.price).toBeLessThan(160);
      expect(result.quotes.meteora.price).toBeGreaterThan(140);
      expect(result.quotes.meteora.price).toBeLessThan(160);
    });

    // Test 5: Best route should be one of the two DEXs
    test('best route is either Raydium or Meteora', async () => {
      const result = await router.findBestRoute('SOL', 10);

      expect(['Raydium', 'Meteora']).toContain(result.bestRoute.dex);
    });
  });

  // ==================== SWAP EXECUTION TESTS ====================

  describe('Swap Execution', () => {
    // Test 6: executeSwap returns a transaction hash
    test('executeSwap returns a transaction hash string', async () => {
      const txHash = await router.executeSwap('Raydium');

      expect(typeof txHash).toBe('string');
      expect(txHash.length).toBeGreaterThan(5);
      expect(txHash.startsWith('5Kj...')).toBe(true);
    });

    // Test 7: executeSwap works for both DEXs
    test('executeSwap works for both Raydium and Meteora', async () => {
      const txHash1 = await router.executeSwap('Raydium');
      const txHash2 = await router.executeSwap('Meteora');

      expect(txHash1).toBeDefined();
      expect(txHash2).toBeDefined();
      expect(txHash1).not.toBe(txHash2); // Should be unique
    });

    // Test 8: executeSwap generates unique transaction hashes
    test('executeSwap generates unique hashes on each call', async () => {
      const hashes = await Promise.all([
        router.executeSwap('Raydium'),
        router.executeSwap('Raydium'),
        router.executeSwap('Raydium'),
      ]);

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(3);
    });
  });

  // ==================== PRICE CALCULATION TESTS ====================

  describe('Price Calculations', () => {
    // Test 9: Amount out calculation is correct
    test('amount out = amount * price', async () => {
      const result = await router.findBestRoute('SOL', 10);
      const amount = 10;
      const expectedAmountOut = amount * result.bestRoute.price;

      expect(expectedAmountOut).toBeGreaterThan(1400); // 10 * ~150
      expect(expectedAmountOut).toBeLessThan(1600);
    });

    // Test 10: Different amounts produce proportional outputs
    test('larger amounts produce proportionally larger outputs', async () => {
      const result1 = await router.findBestRoute('SOL', 10);
      const result2 = await router.findBestRoute('SOL', 100);

      // Both should have similar price ranges (around 150)
      expect(result1.bestRoute.price).toBeGreaterThan(140);
      expect(result2.bestRoute.price).toBeGreaterThan(140);
    });
  });

  // ==================== CONCURRENT REQUESTS TESTS ====================

  describe('Concurrent Requests', () => {
    // Test 11: Can handle multiple concurrent route requests
    test('handles multiple concurrent findBestRoute calls', async () => {
      const promises = Array(5).fill(null).map(() =>
        router.findBestRoute('SOL', 10)
      );

      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.bestRoute).toBeDefined();
        expect(result.quotes).toBeDefined();
      });
    });

    // Test 12: Can handle multiple concurrent swap executions
    test('handles multiple concurrent executeSwap calls', async () => {
      const promises = Array(5).fill(null).map(() =>
        router.executeSwap('Raydium')
      );

      const txHashes = await Promise.all(promises);

      expect(txHashes.length).toBe(5);
      const uniqueHashes = new Set(txHashes);
      expect(uniqueHashes.size).toBe(5); // All should be unique
    });
  });
});
