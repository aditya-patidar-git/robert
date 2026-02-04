/**
 * Load .env before any other application code runs.
 * Must be the first import in the entry point so process.env is populated
 * before tool/module singletons (e.g. FileSearchTool, WebSearchTool) read it.
 * Single responsibility: env loading only.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });
