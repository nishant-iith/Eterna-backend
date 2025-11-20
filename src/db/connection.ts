import { Pool } from 'pg';

// Create a connection pool
export const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'admin',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'order_db',
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Function to save order to database
export async function saveOrder(orderData: {
    orderId: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    amountOut?: number;
    price?: number;
    status: string;
    txHash?: string;
    dexName?: string;
}) {
    const query = `
        INSERT INTO orders (order_id, token_in, token_out, amount_in, amount_out, price, status, tx_hash, dex_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (order_id)
        DO UPDATE SET
            amount_out = EXCLUDED.amount_out,
            price = EXCLUDED.price,
            status = EXCLUDED.status,
            tx_hash = EXCLUDED.tx_hash,
            dex_name = EXCLUDED.dex_name
        RETURNING *;
    `;

    const values = [
        orderData.orderId,
        orderData.tokenIn,
        orderData.tokenOut,
        orderData.amountIn,
        orderData.amountOut || null,
        orderData.price || null,
        orderData.status,
        orderData.txHash || null,
        orderData.dexName || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}
