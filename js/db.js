const DB_NAME = 'autoBestandDB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('movements')) {
        db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems(db) {
  return requestToPromise(getStore(db, 'items', 'readonly').getAll());
}

export async function addItem(db, item) {
  return requestToPromise(getStore(db, 'items', 'readwrite').add(item));
}

export async function updateItem(db, item) {
  await requestToPromise(getStore(db, 'items', 'readwrite').put(item));
}

export async function deleteItem(db, id) {
  await requestToPromise(getStore(db, 'items', 'readwrite').delete(id));
}

export async function addMovement(db, movement) {
  return requestToPromise(getStore(db, 'movements', 'readwrite').add(movement));
}

export async function getAllMovements(db) {
  return requestToPromise(getStore(db, 'movements', 'readonly').getAll());
}

export async function getMovementsForItem(db, itemId) {
  const all = await getAllMovements(db);
  return all.filter((m) => m.itemId === itemId);
}

export async function replaceAllData(db, items, movements) {
  const tx = db.transaction(['items', 'movements'], 'readwrite');
  const itemsStore = tx.objectStore('items');
  const movementsStore = tx.objectStore('movements');
  await requestToPromise(itemsStore.clear());
  await requestToPromise(movementsStore.clear());
  for (const item of items) await requestToPromise(itemsStore.put(item));
  for (const movement of movements) await requestToPromise(movementsStore.put(movement));
}
