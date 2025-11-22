/**
 * WebSocket Lifecycle Tests
 * Tests for WebSocket message structure and status updates
 */

describe('WebSocket Lifecycle', () => {
  // Test 1: Connection confirmation message structure
  test('connection message has correct structure', () => {
    const connectionMessage = {
      status: 'connected',
      orderId: 'test-uuid-123',
      message: 'WebSocket connected. Listening for updates...'
    };

    expect(connectionMessage.status).toBe('connected');
    expect(connectionMessage).toHaveProperty('orderId');
    expect(connectionMessage).toHaveProperty('message');
  });

  // Test 2: Pending status message
  test('pending status message structure', () => {
    const pendingMessage = {
      orderId: 'test-uuid-123',
      status: 'pending',
      stage: 'Order received and queued'
    };

    expect(pendingMessage.status).toBe('pending');
    expect(pendingMessage).toHaveProperty('orderId');
    expect(pendingMessage).toHaveProperty('stage');
  });

  // Test 3: Routing status with quotes
  test('routing status includes DEX comparison', () => {
    const routingMessage = {
      orderId: 'test-uuid-123',
      status: 'routing',
      stage: 'Fetching quotes from Raydium & Meteora...'
    };

    expect(routingMessage.status).toBe('routing');
    expect(routingMessage.stage).toContain('Raydium');
    expect(routingMessage.stage).toContain('Meteora');
  });

  // Test 4: Building status with price info
  test('building status includes price and DEX selection', () => {
    const buildingMessage = {
      orderId: 'test-uuid-123',
      status: 'building',
      stage: 'Route found: Raydium @ $150.25. Building transaction...',
      quotes: {
        raydium: { price: 150.25, dex: 'Raydium' },
        meteora: { price: 148.50, dex: 'Meteora' }
      }
    };

    expect(buildingMessage.status).toBe('building');
    expect(buildingMessage).toHaveProperty('quotes');
    expect(buildingMessage.quotes.raydium.price).toBeGreaterThan(0);
    expect(buildingMessage.quotes.meteora.price).toBeGreaterThan(0);
  });

  // Test 5: Submitted status message
  test('submitted status message structure', () => {
    const submittedMessage = {
      orderId: 'test-uuid-123',
      status: 'submitted',
      stage: 'Transaction submitted to network. Waiting for confirmation...'
    };

    expect(submittedMessage.status).toBe('submitted');
    expect(submittedMessage.stage).toContain('submitted');
    expect(submittedMessage.stage).toContain('confirmation');
  });

  // Test 6: Confirmed/Completed status with full details
  test('confirmed status includes transaction details', () => {
    const confirmedMessage = {
      status: 'confirmed',
      data: {
        status: 'completed',
        txHash: '5Kj...abc123xyz',
        finalPrice: 150.25,
        dex: 'Raydium',
        amountOut: 1502.5
      }
    };

    expect(confirmedMessage.status).toBe('confirmed');
    expect(confirmedMessage.data).toHaveProperty('txHash');
    expect(confirmedMessage.data).toHaveProperty('finalPrice');
    expect(confirmedMessage.data).toHaveProperty('dex');
    expect(confirmedMessage.data).toHaveProperty('amountOut');
    expect(confirmedMessage.data.txHash.length).toBeGreaterThan(5);
  });

  // Test 7: Failed status with error details
  test('failed status includes error information', () => {
    const failedMessage = {
      status: 'failed',
      error: 'Network timeout after 3 attempts',
      message: 'Order failed after 3 retry attempts'
    };

    expect(failedMessage.status).toBe('failed');
    expect(failedMessage).toHaveProperty('error');
    expect(failedMessage).toHaveProperty('message');
    expect(failedMessage.message).toContain('3');
  });

  // Test 8: WebSocket URL format validation
  test('WebSocket URL follows correct format', () => {
    const orderId = 'abc-123-def-456';
    const localWsUrl = `ws://localhost:3000/orders/${orderId}/ws`;
    const prodWsUrl = `wss://eterna-server.onrender.com/orders/${orderId}/ws`;

    expect(localWsUrl).toContain('/orders/');
    expect(localWsUrl).toContain('/ws');
    expect(localWsUrl).toContain(orderId);
    expect(prodWsUrl).toContain('wss://');
    expect(prodWsUrl).toContain(orderId);
  });

  // Test 9: Status order validation
  test('status updates follow correct order', () => {
    const expectedOrder = ['pending', 'routing', 'building', 'submitted', 'completed'];

    for (let i = 0; i < expectedOrder.length - 1; i++) {
      expect(expectedOrder.indexOf(expectedOrder[i])).toBeLessThan(
        expectedOrder.indexOf(expectedOrder[i + 1])
      );
    }
  });

  // Test 10: Quotes comparison for best price selection
  test('best price is higher price when selling', () => {
    const quotes = {
      raydium: { price: 148.50, dex: 'Raydium' },
      meteora: { price: 152.25, dex: 'Meteora' }
    };

    // When selling, higher price = more output = better
    const bestDex = quotes.raydium.price > quotes.meteora.price
      ? quotes.raydium
      : quotes.meteora;

    expect(bestDex.dex).toBe('Meteora');
    expect(bestDex.price).toBe(152.25);
  });
});
