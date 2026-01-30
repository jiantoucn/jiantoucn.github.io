import { Config } from './Config.js';
import { EventManager } from './EventManager.js';
import { LayerManager } from './LayerManager.js';
import { CanvasEngine } from './CanvasEngine.js';
import { UI } from './UI.js';
import { Storage } from './Storage.js';

class App {
    constructor() {
        this.events = new EventManager();
        this.layerManager = new LayerManager(this.events, Config.DEFAULT_WIDTH, Config.DEFAULT_HEIGHT);
        this.engine = new CanvasEngine(this.layerManager, this.events);
        this.ui = new UI(this.layerManager, this.engine, this.events);
        this.storage = new Storage();
        
        this.initGlobalEvents();
        
        // Initial render
        this.layerManager.render();
        
        // Check for autosave
        setTimeout(() => this.checkAutoSave(), 1000); // Wait for DB
        
        console.log('ProBoard initialized v1.0.0');
    }
    
    checkAutoSave() {
        if (this.storage.db) {
            this.storage.loadSnapshot((blob) => {
                if (confirm('发现未保存的画布存档，是否恢复？')) {
                    const img = new Image();
                    img.src = URL.createObjectURL(blob);
                    img.onload = () => {
                        this.importImage(img, '恢复的存档');
                    };
                }
            });
        } else {
            setTimeout(() => this.checkAutoSave(), 1000);
        }
    }
    
    initGlobalEvents() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Handle Image Drop
        document.body.addEventListener('drop', this.handleDrop.bind(this), false);
        
        // Auto-save loop (IndexedDB)
        setInterval(() => {
            this.layerManager.displayCanvas.toBlob((blob) => {
                if (blob && this.storage) {
                    this.storage.saveSnapshot(blob);
                    console.log('Auto-saved to IndexedDB');
                }
            });
        }, 30000);
    }
    
    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length > 0) {
            this.handleFiles(files);
        }
    }
    
    handleFiles(files) {
        ([...files]).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => {
                    const img = new Image();
                    img.src = reader.result;
                    img.onload = () => {
                        this.importImage(img, file.name);
                    };
                };
            }
        });
    }
    
    importImage(img, name) {
        // Create new layer
        const layer = this.layerManager.addLayer(name || 'Imported Image');
        
        // Draw image centered
        const ctx = layer.ctx;
        const x = (this.layerManager.width - img.width) / 2;
        const y = (this.layerManager.height - img.height) / 2;
        
        ctx.drawImage(img, x, y);
        
        // Refresh
        this.layerManager.render();
        this.events.emit('layerChanged'); // Force UI update
    }
}

// Start App
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
