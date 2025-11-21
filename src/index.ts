/**
 * Production entry point - runs both server and worker in the same process
 * This is required for Render's free tier which doesn't support background workers
 */

import './server';
import './worker';

console.log('Starting Eterna Order Execution Engine...');
console.log('Server and Worker running in the same process');
