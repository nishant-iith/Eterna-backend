export interface OrderRequest {
    tokenIn: string;   // e.g., SOL
    tokenOut: string;  // e.g., USDC
    amount: number;    // e.g., 5.0
}

export interface OrderState {
    orderId: string;
    status: 'pending' | 'routing' | 'executing' | 'completed' | 'failed';
    stage?: string;    // Descriptive text for UI
    data?: any;        // Transaction hash, final price, etc.
}

export interface DexQuote {
    dex: 'Raydium' | 'Meteora';
    price: number;
    fee: number;
}