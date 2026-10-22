import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html', 'public/immuvi-command-center.html']) {
  test(`${file}: saved photo tasks remain visible without approved taxonomy or duplicate cards`, async () => {
    const source = await readFile(file, 'utf8');
    const names = ['_isBoundaryQuarantinedAd','_isBoundaryQuarantinedAction',
      '_apNormalizeTaskNameForMatch','_apActionOwnClickUpId','_apAdOwnClickUpId',
      '_apActionAdNamesAgree','_apActionSourceLinkLooksCorrupt','_apResolveCellIdentity',
      '_apParseInspoLinksFromDesc','apResolveCard','apResolveAllCards','apApplyFilters'];
    const ad = {id:'photo-ad', formatName:'PHOTO-001', _clickupId:'same-task',
      adType:'Photo', status:'In Production', angle:'Offer', persona:'Pending audience',
      _tags:['app-created'], _fromInspoId:'INS-001', createdAt:1000,
      _customFields:{'angle tag':'Offer','persona tag':'Pending audience'}};
    const action = {id:'photo-action', sourceAdId:ad.id, _clickupId:ad._clickupId,
      title:ad.formatName, sourceAngle:ad.angle, sourcePersona:ad.persona,
      angle:ad.angle, persona:ad.persona, format:'Photo'};
    const context = vm.createContext({ADS:[ad], MANUAL_ACTIONS:[action],
      ANGLES:[], PERSONAS:[], INSPIRATIONS:[{id:'INS-001',_needsPersonaReview:true}],
      CELL_CREATIVE_ASSIGNMENTS:{}, PRODUCT_BOUNDARY_QUARANTINE:{ads:{},actions:{}},
      _oneScaleEnsureLaunchTaskFields:()=>({}), apAgeStateForRow:()=>({state:'neutral'}),
      _bestStatusChangeAt:()=>1000, _apDateRange:()=>null, _apIsDismissed:()=>false,
      _apState:{filters:{statuses:[],funnels:[],adTypes:[],sources:[],includeAdopted:false}},
      _lazyPromoteVirtual:()=>{throw Error('Existing tasks must not be duplicated');},
      _writeAdRowDirect:()=>{throw Error('Read-side must not write');},
      _writeManualActionRowDirect:()=>{throw Error('Read-side must not write');}});
    for (const name of names) {
      const start=source.indexOf('function '+name+'(');
      assert.ok(start>=0,name);
      vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),context);
    }
    const before=JSON.stringify({ad,action});
    for (const includeAdopted of [false,true]) {
      context._apState.filters.includeAdopted=includeAdopted;
      context._apState.filters.adTypes=['Photo'];
      const rows=context.apApplyFilters(context.apResolveAllCards());
      assert.equal(rows.length,1);
      assert.equal(rows[0].display.title,'PHOTO-001');
      assert.equal(rows[0].display.status,'In Production');
      assert.equal(rows[0].display.adType,'Photo');
      assert.equal(rows[0].display.persona,'Pending audience');
    }
    assert.equal(JSON.stringify({ad,action}),before);
    context.PRODUCT_BOUNDARY_QUARANTINE.ads[ad.id]=true;
    assert.equal(context.apResolveAllCards().length,0,'Wrong-product safeguards stay intact');
  });
}
