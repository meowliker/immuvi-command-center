import legacyHandler from '../../../api/clickup.js';
import { runLegacyHandler } from '../../../lib/legacy-route-adapter.js';

export const GET = (request) => runLegacyHandler(legacyHandler, request);
export const POST = (request) => runLegacyHandler(legacyHandler, request);
export const PUT = (request) => runLegacyHandler(legacyHandler, request);
export const PATCH = (request) => runLegacyHandler(legacyHandler, request);
export const DELETE = (request) => runLegacyHandler(legacyHandler, request);
export const OPTIONS = (request) => runLegacyHandler(legacyHandler, request);
