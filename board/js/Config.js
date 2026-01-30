export const Config = {
    DEFAULT_WIDTH: 1920,
    DEFAULT_HEIGHT: 1080,
    MAX_WIDTH: 5000,
    MAX_HEIGHT: 5000,
    BACKGROUND_COLOR: '#ffffff',
    HISTORY_LIMIT: 20, // Undo/Redo limit (if implemented)
    EXPORT_QUALITY: 0.9,
    ZOOM_MIN: 0.1,
    ZOOM_MAX: 5.0
};

export const ToolType = {
    BRUSH: 'brush',
    ERASER: 'eraser',
    MOVE: 'move',
    SHAPE: 'shape', // Future
    TEXT: 'text'   // Future
};
