import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('audio language is evidence-based and transcript times cannot exceed the source',()=>{
  const result=execFileSync('python3',['-c',`
import sys
sys.path.insert(0, 'scripts')
from private_inspiration_audio import confident_language, timed_segments
assert confident_language({'hi':0.566,'sa':0.155,'ur':0.118}) == 'hi'
assert confident_language({'en':0.95,'hi':0.03}) == 'en'
assert confident_language({'hi':0.4,'sa':0.35}) is None
assert confident_language({'en':0.51,'de':0.49}) is None
assert confident_language({}) is None
assert timed_segments([{'start':0,'end':17.1,'text':'verified'}],17)[0]['time'] == '0:00.00-0:17.00'
for start,end in [(12,23),(-1,2),(3,2),(17,18),(float('nan'),3)]:
    try:
        timed_segments([{'start':start,'end':end,'text':'bad'}],17)
        raise AssertionError('Invalid timing accepted')
    except ValueError:
        pass
print('passed')
`],{encoding:'utf8'});
  assert.equal(result.trim(),'passed');
});
