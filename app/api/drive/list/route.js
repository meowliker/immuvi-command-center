import legacyHandler from '../../../../api/drive/list.js';
import { runLegacyHandler } from '../../../../lib/legacy-route-adapter.js';

export const GET = (request) => runLegacyHandler(legacyHandler, request);
