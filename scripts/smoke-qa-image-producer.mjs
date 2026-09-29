import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { qaServiceKey } from './qa-service-config.mjs';
import { QA_SUPABASE_URL } from '../lib/qa-supabase-env.js';
if(!process.argv.includes('--generate-one'))throw new Error('Pass --generate-one to explicitly request one native QA test image.');
const db=createClient(QA_SUPABASE_URL,qaServiceKey({fromCli:true}),{auth:{persistSession:false,autoRefreshToken:false}});
const productId='qa-sample-astrorekha',adId='qa-sample-e2fd9960-252e-4d77-8aee-a92a96e6c19d';
const {data:creative,error}=await db.from('ads').select('*').eq('id',adId).eq('product_id',productId).single();
if(error||!creative)throw new Error('Expected isolated QA sample is unavailable.');
const admin=await db.from('profiles').select('id').eq('role','admin').eq('is_active',true).eq('must_change_password',false).limit(1).single();
if(admin.error)throw new Error('No active QA operator for the labeled smoke test.');
const id=randomUUID();
const inserted=await db.from('qa_image_runs').insert({id,product_id:productId,ad_id:adId,requested_by:admin.data.id,
  request:{testRun:true,initiatedBy:'Codex QA verification requested in chat',creative,references:[],memory:{},options:{count:1,
    productName:'AstroRekha',offer:'',market:'India',forbiddenAliases:'',referenceIds:[],referenceUrl:'',
    instruction:'QA verification image. Make a polished square static creative for AstroRekha, based on this brief. Use only the exact short copy "AstroRekha" and "Explore your story". No factual guarantees, pricing, discounts or invented testimonials. No reference image is supplied for this smoke test.'}}});
if(inserted.error)throw new Error(inserted.error.message);
console.log(`Queued one labeled QA smoke-test image: ${id}. Creative status and ClickUp are unchanged.`);
