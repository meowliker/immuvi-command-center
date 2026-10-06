import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const context = vm.createContext({AD_TYPES: ['Photo', 'Video', 'Carousel', 'UGC']});
  vm.runInContext(html.slice(html.indexOf('function normalizeToOption('),
    html.indexOf('function normalizeInspirationCta(')), context);
  test(file + ': text source stays Text, never Photo or Video', () => {
    assert.equal(context.deriveInspirationMediaKind({mediaKind: 'text', is_video: false}), 'text');
    assert.equal(context.normalizeInspirationAdType({media_kind: 'text', ad_type: 'Video'}), 'Text');
    assert.equal(context.normalizeInspirationAdType({media_kind: 'video', ad_type: 'Photo'}), 'Video');
    assert.equal(context.normalizeInspirationAdType({media_kind: 'image', ad_type: 'Video'}), 'Photo');
    assert.equal(context.normalizeInspirationAdType({media_kind: 'carousel', ad_type: 'Video'}), 'Carousel');
  });
  test(file + ': source evidence survives result import; new options are scoped to text rows', () => {
    assert.match(html, /ins\.textEvidence = data\.text_evidence/);
    for (const label of ['Text Post', 'Text', 'Not applicable']) {
      assert.ok(html.includes("ins.mediaKind === 'text' ? ['" + label + "'] : []"));
    }
  });
}
