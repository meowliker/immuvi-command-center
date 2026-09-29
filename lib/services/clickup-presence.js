export async function saveClickUpPresenceIdentity(db, userId, identity) {
  if (!userId || !identity?.id || typeof identity.name !== 'string' || !identity.name.trim()) {
    throw new Error('ClickUp user identity could not be verified.');
  }
  const { error } = await db.from('qa_clickup_identities').upsert({
    user_id: userId, clickup_user_id: String(identity.id), name: identity.name.trim().slice(0, 200),
  }, { onConflict: 'user_id,clickup_user_id' });
  if (error) throw new Error('Could not save the verified ClickUp name for online presence. Retry key verification.');
}
