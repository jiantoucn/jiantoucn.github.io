const DB_NAME = 'ProBoardDB';
const STORE_NAME = 'snapshots';

export class Storage {
    constructor() {
        this.db = null;
        this.initDB();
    }
    
    initDB() {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onupgradeneeded = (e) => {
            this.db = e.target.result;
            if (!this.db.objectStoreNames.contains(STORE_NAME)) {
                this.db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (e) => {
            this.db = e.target.result;
            console.log('Storage initialized');
        };
        
        request.onerror = (e) => {
            console.error('Storage error', e);
        };
    }
    
    saveSnapshot(blob) {
        if (!this.db) return;
        
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const record = {
            id: 'autosave_latest',
            data: blob,
            timestamp: Date.now()
        };
        
        store.put(record);
    }
    
    loadSnapshot(callback) {
        if (!this.db) return; // Retry later if not ready
        
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('autosave_latest');
        
        request.onsuccess = () => {
            if (request.result) {
                callback(request.result.data);
            }
        };
    }
}
