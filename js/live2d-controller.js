// js/live2d-controller.js
window.Live2DController = {
    app: null,
    currentModel: null,

    init: function(canvasId) {
        const { Application, Live2DModel } = PIXI;
        
        // 注册 Ticker
        if (PIXI.live2d && PIXI.live2d.Live2DModel) {
            PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
        }

        this.app = new Application({
            view: document.getElementById(canvasId),
            autoStart: true,
            resizeTo: window,
            backgroundColor: 0x202020
        });
        
        console.log("Pixi initialized");
    },

    loadModel: async function(source, statusElementId) {
        const statusText = document.getElementById(statusElementId);
        if(statusText) statusText.innerText = "正在加载模型...";
        
        const { Live2DModel } = PIXI.live2d || {};
        if (!Live2DModel) {
            if(statusText) statusText.innerText = "错误: Live2DModel 未加载";
            return;
        }

        try {
            if (this.currentModel) {
                this.app.stage.removeChild(this.currentModel);
                this.currentModel.destroy();
                this.currentModel = null;
            }

            console.log("Starting model load...");
            const model = await Live2DModel.from(source);
            
            this.currentModel = model;
            this.app.stage.addChild(model);

            this.resizeModel(); // 使用独立的 resize 方法
            
            model.visible = true;
            model.alpha = 1;

            if(statusText) statusText.innerText = "模型加载成功";
            console.log("Model loaded:", model);
        } catch (e) {
            console.error(e);
            if(statusText) statusText.innerText = "模型加载失败: " + e.message;
        }
    },

    resizeModel: function() {
        if (!this.currentModel) return;
        
        const model = this.currentModel;
        const bounds = model.getLocalBounds();
        const modelWidth = bounds.width || model.width || 800;
        const modelHeight = bounds.height || model.height || 800;
        
        let scaleX = (window.innerWidth * 0.4) / modelWidth;
        let scaleY = (window.innerHeight * 0.8) / modelHeight;
        let scale = Math.min(scaleX, scaleY);
        
        if (!Number.isFinite(scale) || scale <= 0) {
            scale = 0.25;
            console.warn("模型尺寸异常，使用默认缩放 0.25");
        }
        
        model.scale.set(scale);
        model.pivot.set(bounds.x + modelWidth / 2, bounds.y + modelHeight / 2);
        model.position.set(window.innerWidth / 2, window.innerHeight / 2 + 100);
    },

    update: function(riggedFace) {
        if (!this.currentModel || !this.currentModel.internalModel) return;

        const core = this.currentModel.internalModel.coreModel;
        const head = riggedFace.head;
        const eye = riggedFace.eye;
        const mouth = riggedFace.mouth;

        if(core.setParameterValueById) {
            core.setParameterValueById('ParamAngleX', head.degrees.y); 
            core.setParameterValueById('ParamAngleY', head.degrees.x);
            core.setParameterValueById('ParamAngleZ', head.degrees.z);
            core.setParameterValueById('ParamEyeLOpen', 1 - eye.l);
            core.setParameterValueById('ParamEyeROpen', 1 - eye.r);
            if (riggedFace.pupil) {
                core.setParameterValueById('ParamEyeBallX', riggedFace.pupil.x);
                core.setParameterValueById('ParamEyeBallY', riggedFace.pupil.y);
            }
            core.setParameterValueById('ParamMouthOpenY', mouth.y);
            core.setParameterValueById('ParamMouthForm', 0.3 + mouth.x);
            core.setParameterValueById('ParamBodyAngleX', head.degrees.y * 0.5);
            core.setParameterValueById('ParamBodyAngleY', head.degrees.x * 0.5);
            core.setParameterValueById('ParamBodyAngleZ', head.degrees.z * 0.5);
        }
    }
};
