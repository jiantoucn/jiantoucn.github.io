import { ToolType } from './Config.js';

export class BaseTool {
    constructor(engine) {
        this.engine = engine;
    }
    
    onDown(x, y, pressure, tiltX, tiltY) {}
    onMove(x, y, pressure, tiltX, tiltY) {}
    onUp(x, y) {}
}

export class BrushTool extends BaseTool {
    constructor(engine) {
        super(engine);
        this.lastX = 0;
        this.lastY = 0;
    }
    
    onDown(x, y, pressure, tiltX, tiltY) {
        this.lastX = x;
        this.lastY = y;
        this.draw(x, y, pressure, tiltX, tiltY);
    }
    
    onMove(x, y, pressure, tiltX, tiltY) {
        this.draw(x, y, pressure, tiltX, tiltY);
        this.lastX = x;
        this.lastY = y;
    }
    
    onUp(x, y) {
        // End stroke
    }
    
    draw(x, y, pressure, tiltX, tiltY) {
        const ctx = this.engine.layerManager.getActiveLayer().ctx;
        
        // 计算倾斜因子 (0-90度)
        const tiltMagnitude = Math.sqrt((tiltX || 0)**2 + (tiltY || 0)**2);
        const tiltFactor = 1 + (tiltMagnitude / 90); 
        
        // 样式处理
        let size = this.engine.brushSize;
        let opacity = this.engine.brushOpacity;
        const style = this.engine.brushStyle;
        const p = pressure || 0.5;

        if (style === 'pen') {
            // 钢笔: 压感显著影响粗细，不透明度稳定
            size = size * p * 2 * tiltFactor;
        } else if (style === 'pencil') {
            // 铅笔: 压感影响不透明度更多，粗细变化较小，较细
            size = Math.max(1, size * 0.5 * (0.8 + p * 0.2) * tiltFactor); // 最小1px
            opacity = opacity * p; 
        } else if (style === 'marker') {
            // 马克笔: 粗细稳定，压感影响流量(不透明度叠加感)
            size = size * tiltFactor;
            opacity = opacity * (0.5 + p * 0.5);
        } else {
            // 默认
            size = size * p * 2 * tiltFactor;
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.engine.brushColor;
        ctx.lineWidth = size;
        ctx.globalAlpha = opacity;
        
        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        this.engine.layerManager.render();
    }
}

export class EraserTool extends BaseTool {
    constructor(engine) {
        super(engine);
        this.lastX = 0;
        this.lastY = 0;
    }
    
    onDown(x, y, pressure, tiltX, tiltY) {
        this.lastX = x;
        this.lastY = y;
        this.erase(x, y, pressure);
    }
    
    onMove(x, y, pressure, tiltX, tiltY) {
        this.erase(x, y, pressure);
        this.lastX = x;
        this.lastY = y;
    }
    
    erase(x, y, pressure) {
        const ctx = this.engine.layerManager.getActiveLayer().ctx;
        const size = this.engine.brushSize; 
        
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;
        
        ctx.beginPath();
        ctx.moveTo(this.lastX, this.lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        ctx.restore();
        
        this.engine.layerManager.render();
    }
}

export class MoveTool extends BaseTool {
    constructor(engine) {
        super(engine);
        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;
        this.layer = null;
    }
    
    onDown(x, y) {
        this.startX = x;
        this.startY = y;
        this.layer = this.engine.layerManager.getActiveLayer();
        if (!this.layer) return;
        
        this.snapshot = document.createElement('canvas');
        this.snapshot.width = this.layer.width;
        this.snapshot.height = this.layer.height;
        this.snapshot.getContext('2d').drawImage(this.layer.canvas, 0, 0);
    }
    
    onMove(x, y) {
        if (!this.layer || !this.snapshot) return;
        
        const dx = x - this.startX;
        const dy = y - this.startY;
        
        this.layer.clear();
        this.layer.ctx.drawImage(this.snapshot, dx, dy);
        this.engine.layerManager.render();
    }
    
    onUp(x, y) {
        this.snapshot = null;
        this.layer = null;
    }
}
