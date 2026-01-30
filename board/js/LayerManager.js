import { EventManager } from './EventManager.js';

class Layer {
    constructor(id, name, width, height) {
        this.id = id;
        this.name = name;
        this.width = width;
        this.height = height;
        this.opacity = 1.0;
        this.visible = true;
        this.blendMode = 'source-over';
        
        // 每个图层都有自己的 Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // 初始化背景透明
        this.clear();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
    
    resize(width, height) {
        // 保存内容
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        tempCanvas.getContext('2d').drawImage(this.canvas, 0, 0);
        
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        
        // 恢复内容
        this.ctx.drawImage(tempCanvas, 0, 0);
    }
}

export class LayerManager {
    constructor(eventManager, width, height) {
        this.events = eventManager;
        this.width = width;
        this.height = height;
        this.layers = [];
        this.activeLayerId = null;
        this.layerCounter = 1;
        
        // 主合成画布 (Display)
        this.displayCanvas = document.createElement('canvas');
        this.displayCanvas.width = width;
        this.displayCanvas.height = height;
        this.displayCtx = this.displayCanvas.getContext('2d', { alpha: true }); // 确保支持透明
        
        // 绑定到DOM
        const container = document.getElementById('canvas-container');
        this.displayCanvas.className = 'drawing-canvas';
        container.appendChild(this.displayCanvas);
        
        // 初始图层
        this.addLayer('背景层');
        // 填充白色背景
        const bgLayer = this.getLayer(this.layers[0].id);
        bgLayer.ctx.fillStyle = '#ffffff';
        bgLayer.ctx.fillRect(0, 0, width, height);
    }
    
    addLayer(name = null) {
        const id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const layerName = name || `图层 ${this.layerCounter++}`;
        const newLayer = new Layer(id, layerName, this.width, this.height);
        
        // 新图层添加在当前选中图层之上，或者最顶层
        let index = this.layers.length;
        if (this.activeLayerId) {
            const activeIndex = this.layers.findIndex(l => l.id === this.activeLayerId);
            if (activeIndex !== -1) {
                index = activeIndex + 1;
            }
        }
        
        this.layers.splice(index, 0, newLayer);
        this.activeLayerId = id;
        
        this.events.emit('layerChanged', { layers: this.layers, activeId: this.activeLayerId });
        this.render(); // 重新合成
        return newLayer;
    }
    
    deleteLayer(id) {
        if (this.layers.length <= 1) return; // 至少保留一个图层
        
        const index = this.layers.findIndex(l => l.id === id);
        if (index === -1) return;
        
        this.layers.splice(index, 1);
        
        // 如果删除的是当前图层，选择下一个
        if (id === this.activeLayerId) {
            const newIndex = Math.max(0, index - 1);
            this.activeLayerId = this.layers[newIndex].id;
        }
        
        this.events.emit('layerChanged', { layers: this.layers, activeId: this.activeLayerId });
        this.render();
    }
    
    selectLayer(id) {
        const layer = this.getLayer(id);
        if (layer) {
            this.activeLayerId = id;
            this.events.emit('layerSelected', { id });
        }
    }
    
    getLayer(id) {
        return this.layers.find(l => l.id === id);
    }
    
    getActiveLayer() {
        return this.getLayer(this.activeLayerId);
    }
    
    setLayerOpacity(id, opacity) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.opacity = opacity;
            this.render();
        }
    }
    
    setLayerVisibility(id, visible) {
        const layer = this.getLayer(id);
        if (layer) {
            layer.visible = visible;
            this.render();
        }
    }
    
    reorderLayer(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.layers.length || 
            toIndex < 0 || toIndex >= this.layers.length) return;
            
        const [movedLayer] = this.layers.splice(fromIndex, 1);
        this.layers.splice(toIndex, 0, movedLayer);
        
        this.events.emit('layerChanged', { layers: this.layers, activeId: this.activeLayerId });
        this.render();
    }

    mergeDown() {
        const index = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (index <= 0) return; // 已经在最底层，无法向下合并
        
        const topLayer = this.layers[index];
        const bottomLayer = this.layers[index - 1];
        
        // 将上层绘制到下层
        bottomLayer.ctx.globalAlpha = topLayer.opacity;
        bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
        bottomLayer.ctx.drawImage(topLayer.canvas, 0, 0);
        
        // 恢复下层Context状态
        bottomLayer.ctx.globalAlpha = 1.0;
        bottomLayer.ctx.globalCompositeOperation = 'source-over';
        
        // 删除上层
        this.deleteLayer(topLayer.id);
        
        // 选中合并后的图层
        this.selectLayer(bottomLayer.id);
        this.render();
    }
    
    // 核心渲染循环：将所有图层合成到 DisplayCanvas
    render() {
        // 清空主画布
        this.displayCtx.clearRect(0, 0, this.width, this.height);
        
        // 绘制棋盘格背景（表示透明）- 可选，这里假设CSS处理了背景
        
        // 从下向上绘制
        for (const layer of this.layers) {
            if (!layer.visible) continue;
            
            this.displayCtx.globalAlpha = layer.opacity;
            this.displayCtx.globalCompositeOperation = layer.blendMode;
            this.displayCtx.drawImage(layer.canvas, 0, 0);
        }
        
        // 重置
        this.displayCtx.globalAlpha = 1.0;
        this.displayCtx.globalCompositeOperation = 'source-over';
    }
}
