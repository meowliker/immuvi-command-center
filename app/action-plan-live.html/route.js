import { serveLegacyHtml } from '../../lib/serve-legacy-html.js';

export async function GET() {
  return serveLegacyHtml('actionPlan');
}
