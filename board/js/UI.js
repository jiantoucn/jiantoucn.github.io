import { ToolType } from './Config.js';

export class UI {
    constructor(layerManager, canvasEngine, eventManager) {
        this.layerManager = layerManager;
        this.engine = canvasEngine;
        this.events = eventManager;
        
        this.initDOM();
        this.bindEvents();
        this.renderLayerList(); // Initial render
    }
    
    initDOM() {
        // Tools
        this.toolBtns = document.querySelectorAll('.tool-btn');
        this.brushSizeInput = document.getElementById('brush-size');
        this.brushOpacityInput = document.getElementById('brush-opacity');
        this.brushColorInput = document.getElementById('brush-color');
        this.brushStyleInput = document.getElementById('brush-style');
        
        // Layers
        this.layerListEl = document.getElementById('layer-list');
        this.btnAddLayer = document.getElementById('btn-add-layer');
        this.btnDeleteLayer = document.getElementById('btn-delete-layer');
        this.btnMergeLayer = document.getElementById('btn-merge-layer');
        this.layerOpacityInput = document.getElementById('layer-opacity');
        
        // Top Bar
        this.btnExport = document.getElementById('btn-export');
        this.modalExport = document.getElementById('modal-export');
        this.btnExportConfirm = document.getElementById('btn-export-confirm');
        this.btnExportCancel = document.getElementById('btn-export-cancel');
    }
    
    bindEvents() {
        // Tool Selection
        this.toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.engine.setTool(tool);
                
                // Update UI
                this.toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.getElementById('tool-status').textContent = `工具: ${btn.title}`;
            });
        });
        
        // Brush Settings
        this.brushSizeInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('brush-size-val').textContent = val;
            this.engine.setBrushSize(val);
        });
        
        this.brushOpacityInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('brush-opacity-val').textContent = val;
            this.engine.setBrushOpacity(val / 100);
        });
        
        this.brushColorInput.addEventListener('input', (e) => {
            this.engine.setBrushColor(e.target.value);
        });
        
        this.brushStyleInput.addEventListener('change', (e) => {
            this.engine.setBrushStyle(e.target.value);
        });

        // Layer Actions
        this.btnAddLayer.addEventListener('click', () => {
            this.layerManager.addLayer();
        });
        
        this.btnDeleteLayer.addEventListener('click', () => {
            if (this.layerManager.activeLayerId) {
                this.layerManager.deleteLayer(this.layerManager.activeLayerId);
            }
        });

        this.btnMergeLayer.addEventListener('click', () => {
             this.layerManager.mergeDown();
        });
        
        this.layerOpacityInput.addEventListener('input', (e) => {
            if (this.layerManager.activeLayerId) {
                this.layerManager.setLayerOpacity(this.layerManager.activeLayerId, e.target.value / 100);
            }
        });
        
        // Export
        this.btnExport.addEventListener('click', () => {
            this.modalExport.classList.remove('hidden');
        });
        
        this.btnExportCancel.addEventListener('click', () => {
            this.modalExport.classList.add('hidden');
        });
        
        this.btnExportConfirm.addEventListener('click', () => {
            const format = document.getElementById('export-format').value;
            const quality = parseFloat(document.getElementById('export-quality').value);
            this.handleExport(format, quality);
            this.modalExport.classList.add('hidden');
        });
        
        // Listen to Engine Events
        this.events.on('layerChanged', () => this.renderLayerList());
        this.events.on('layerSelected', () => this.updateLayerUI());
    }
    
    renderLayerList() {
        this.layerListEl.innerHTML = '';
        const layers = [...this.layerManager.layers].reverse(); // Show top layer at top of list
        
        layers.forEach((layer, index) => {
            // Actual index in the manager (reversed)
            const realIndex = this.layerManager.layers.length - 1 - index;
            
            const el = document.createElement('div');
            el.className = `layer-item ${layer.id === this.layerManager.activeLayerId ? 'active' : ''}`;
            el.draggable = true;
            el.dataset.id = layer.id;
            el.dataset.index = realIndex;
            
            // Visibility Toggle
            const visBtn = document.createElement('div');
            visBtn.className = 'layer-visibility';
            visBtn.textContent = layer.visible ? '👁️' : '⚪';
            visBtn.onclick = (e) => {
                e.stopPropagation();
                this.layerManager.setLayerVisibility(layer.id, !layer.visible);
                this.renderLayerList(); // Re-render to update icon
            };
            
            // Thumbnail (Simple placeholder for now, ideally draw canvas scaled down)
            const thumb = document.createElement('canvas');
            thumb.className = 'layer-thumb';
            thumb.width = 40;
            thumb.height = 30;
            const thumbCtx = thumb.getContext('2d');
            thumbCtx.drawImage(layer.canvas, 0, 0, 40, 30);
            
            // Name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'layer-name';
            nameSpan.textContent = layer.name;
            nameSpan.ondblclick = (e) => {
                e.stopPropagation();
                const newName = prompt('重命名图层', layer.name);
                if (newName) {
                    layer.name = newName;
                    this.renderLayerList();
                }
            };
            
            el.appendChild(visBtn);
            el.appendChild(thumb);
            el.appendChild(nameSpan);
            
            // Click to select
            el.onclick = () => {
                this.layerManager.selectLayer(layer.id);
                this.renderLayerList(); // Update active class
            };
            
            // Drag and Drop
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', realIndex);
                e.dataTransfer.effectAllowed = 'move';
            });
            
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.style.borderTop = '2px solid #007acc';
            });
            
            el.addEventListener('dragleave', () => {
                el.style.borderTop = '1px solid transparent';
            });
            
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.style.borderTop = '1px solid transparent';
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = realIndex;
                
                if (fromIndex !== toIndex) {
                    this.layerManager.reorderLayer(fromIndex, toIndex);
                }
            });
            
            this.layerListEl.appendChild(el);
        });
        
        this.updateLayerUI();
    }
    
    updateLayerUI() {
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            this.layerOpacityInput.value = layer.opacity * 100;
        }
        
        // Update Status Bar
        document.getElementById('canvas-size-status').textContent = `${this.layerManager.width} x ${this.layerManager.height}px`;
    }
    
    handleExport(format, quality) {
        const link = document.createElement('a');
        link.download = `drawing_${Date.now()}.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
        link.href = this.layerManager.displayCanvas.toDataURL(format, quality);
        link.click();
    }
}
