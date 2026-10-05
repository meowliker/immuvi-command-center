import test from 'node:test';
import assert from 'node:assert/strict';
import {QA_DESTINATIONS,qaDestination,qaDestinationForList,assertQaProductList} from '../../lib/domain/qa-destinations.js';
test('approved QA product destinations are exact and immutable',()=>{
 assert.equal(QA_DESTINATIONS.length,2);
 for(const d of QA_DESTINATIONS){assert.equal(qaDestination(d.productId),d);assert.equal(qaDestinationForList(d.listId),d);assert.ok(Object.isFrozen(d));}
 assert.equal(qaDestination('prod-1778009469915'),null);
 assert.equal(qaDestinationForList('901613447211'),null);
});
test('Kids list cannot be borrowed by another product or vice versa',()=>{
 assert.equal(assertQaProductList('prod-1788597766070','901616537792').libraryDocId,'8cq1r3y-43256');
 assert.throws(()=>assertQaProductList('qa-sample-astrorekha','901616537792'));
 assert.throws(()=>assertQaProductList('prod-1788597766070','1301130000002447'));
 assert.throws(()=>assertQaProductList('prod-1788597766070','901613447211'));
 assert.equal(assertQaProductList('existing-qa-fixture','1301130000002447').listId,'1301130000002447');
});
