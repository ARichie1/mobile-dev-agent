#!/usr/bin/env node
import { main } from './cli/main.js';
const controller = new AbortController();
const cancel = () => controller.abort();
process.on('SIGINT', cancel);
process.on('SIGTERM', cancel);
try { process.exitCode = await main(process.argv.slice(2), process.cwd(), undefined, undefined, undefined, controller.signal); }
finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
