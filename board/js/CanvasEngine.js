import { BrushTool, EraserTool, MoveTool } from './Tools.js';
import { ToolType } from './Config.js';

export class CanvasEngine {
    constructor(layerManager, eventManager) {
        this.layerManager = layerManager;
        this.events = eventManager;
        
        // 状态
        this.brushSize = 10;
        this.brushColor = '#000000';
        this.brushOpacity = 1.0;
        this.brushStyle = 'pen'; // Default
        this.currentToolType = ToolType.BRUSH;
        this.isDrawing = false;
        this.zoom = 1.0;
        
        // 工具实例
        this.tools = {
            [ToolType.BRUSH]: new BrushTool(this),
            [ToolType.ERASER]: new EraserTool(this),
            [ToolType.MOVE]: new MoveTool(this)
        };
        
        // 绑定事件
        this.initEvents();
    }
    
    initEvents() {
        const canvas = this.layerManager.displayCanvas;
        
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointermove', this.onPointerMove.bind(this)); // Document to catch drag out
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        // 阻止默认触摸操作（如滚动）
        canvas.style.touchAction = 'none';
    }
    
    getPointerPos(e) {
        const rect = this.layerManager.displayCanvas.getBoundingClientRect();
        const scaleX = this.layerManager.width / rect.width;
        const scaleY = this.layerManager.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
            pressure: e.pressure !== undefined ? e.pressure : 0.5,
            tiltX: e.tiltX || 0,
            tiltY: e.tiltY || 0
        };
    }
    
    onPointerDown(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return; // 只允许左键
        
        this.isDrawing = true;
        this.layerManager.displayCanvas.setPointerCapture(e.pointerId);
        
        const { x, y, pressure, tiltX, tiltY } = this.getPointerPos(e);
        const tool = this.tools[this.currentToolType];
        
        if (tool) {
            tool.onDown(x, y, pressure, tiltX, tiltY);
        }
    }
    
    onPointerMove(e) {
        if (!this.isDrawing) return;
        
        const { x, y, pressure, tiltX, tiltY } = this.getPointerPos(e);
        const tool = this.tools[this.currentToolType];
        
        if (tool) {
            tool.onMove(x, y, pressure, tiltX, tiltY);
        }
    }
    
    onPointerUp(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.layerManager.displayCanvas.releasePointerCapture(e.pointerId);
        
        const { x, y } = this.getPointerPos(e);
        const tool = this.tools[this.currentToolType];
        
        if (tool) {
            tool.onUp(x, y);
        }
    }
    
    setTool(type) {
        if (this.tools[type] || type === ToolType.MOVE) {
            this.currentToolType = type;
            this.events.emit('toolChanged', type);
        }
    }
    
    setBrushSize(size) {
        this.brushSize = size;
    }
    
    setBrushColor(color) {
        this.brushColor = color;
    }
    
    setBrushOpacity(opacity) {
        this.brushOpacity = opacity;
    }

    setBrushStyle(style) {
        this.brushStyle = style;
    }
}
