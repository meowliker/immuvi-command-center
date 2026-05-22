#!/usr/bin/env bash
set -e
set -a; source ~/.classify-inspiration.env; set +a
echo "--- Insert ---"
curl -sf -X POST "${SUPABASE_URL}/rest/v1/task_video_winners" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"ad_id":"TEST-001","drive_file_id":"test-file-1","file_name":"V1.mp4","notes":"smoke test"}' \
  | python3 -c "import json,sys; r=json.load(sys.stdin)[0]; assert r['ad_id']=='TEST-001'; print('OK insert id=',r['id'])"

echo "--- Select ---"
curl -sf "${SUPABASE_URL}/rest/v1/task_video_winners?ad_id=eq.TEST-001" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | python3 -c "import json,sys; rs=json.load(sys.stdin); assert len(rs)==1; print('OK select count=',len(rs))"

echo "--- Delete cleanup ---"
curl -sf -X DELETE "${SUPABASE_URL}/rest/v1/task_video_winners?ad_id=eq.TEST-001" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
echo "OK delete"
