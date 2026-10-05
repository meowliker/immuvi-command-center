export const QA_DESTINATIONS = Object.freeze([
  Object.freeze({ productId:'qa-sample-astrorekha', listId:'1301130000002447', workspaceId:'9016762494', libraryDocId:'8cq1r3y-44896', libraryTrackerPageId:'8cq1r3y-118036' }),
  Object.freeze({ productId:'prod-1788597766070', listId:'901616537792', workspaceId:'9016762494', libraryDocId:'8cq1r3y-43256', libraryTrackerPageId:'8cq1r3y-112156' }),
]);

export function qaDestination(productId) {
  return QA_DESTINATIONS.find(d=>d.productId===productId) || null;
}

export function qaDestinationForList(listId) {
  return QA_DESTINATIONS.find(d=>d.listId===String(listId)) || null;
}

export function assertQaProductList(productId, listId) {
  const destination=qaDestinationForList(listId);
  if (!destination || (destination.productId==='prod-1788597766070' && productId!==destination.productId)
    || (productId==='prod-1788597766070' && destination.productId!==productId)) {
    throw new Error('This product is not authorized for that QA ClickUp destination.');
  }
  return destination;
}
