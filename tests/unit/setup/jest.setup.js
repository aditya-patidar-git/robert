/**
 * Jest setup file for unit tests.
 * Runs before each test file.
 * Loads robert-agent-service/.env so RUN_INTEGRATION_TESTS and Twilio/OpenAI vars are available.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../robert-agent-service/.env') });
