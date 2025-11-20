CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE,
    token_in VARCHAR(10) NOT NULL,
    token_out VARCHAR(10) NOT NULL,
    amount_in DECIMAL(20, 8) NOT NULL,
    amount_out DECIMAL(20, 8),
    price DECIMAL(20, 8),
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed'
    tx_hash VARCHAR(100),
    dex_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);