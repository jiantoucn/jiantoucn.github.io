// js/live2d-controller.js
window.Live2DController = {
    app: null,
    currentModel: null,
    lastRiggedFace: null,

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
            
            // 禁用自动空闲动画，防止模型自己乱动
            if (model.internalModel.motionManager) {
                model.internalModel.motionManager.idleMotionPaused = true;
            }
            
            // 禁用默认的鼠标跟随，避免冲突
            model.autoInteract = false;

            // 关键：在模型更新循环中应用我们的面捕数据
            model.on('update', () => {
                if (this.lastRiggedFace) {
                    this.applyFaceData(model, this.lastRiggedFace);
                }
            });
            
            this.currentModel = model;
            this.app.stage.addChild(model);

            this.resizeModel(); 
            
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
        this.lastRiggedFace = riggedFace;
    },

    applyFaceData: function(model, riggedFace) {
        if (!model || !model.internalModel) return;

        const core = model.internalModel.coreModel;
        const head = riggedFace.head;
        const eye = riggedFace.eye;
        const mouth = riggedFace.mouth;

        // 兼容 Cubism 4 (setParameterValueById) 和 Cubism 2 (setParamFloat)
        const setParam = (id, value) => {
            if (core.setParameterValueById) {
                core.setParameterValueById(id, value);
            } else if (core.setParamFloat) {
                // Cubism 2 ID 映射
                let v2Id = id;
                const map = {
                    'ParamAngleX': 'PARAM_ANGLE_X',
                    'ParamAngleY': 'PARAM_ANGLE_Y',
                    'ParamAngleZ': 'PARAM_ANGLE_Z',
                    'ParamEyeLOpen': 'PARAM_EYE_L_OPEN',
                    'ParamEyeROpen': 'PARAM_EYE_R_OPEN',
                    'ParamEyeBallX': 'PARAM_EYE_BALL_X',
                    'ParamEyeBallY': 'PARAM_EYE_BALL_Y',
                    'ParamMouthOpenY': 'PARAM_MOUTH_OPEN_Y',
                    'ParamMouthForm': 'PARAM_MOUTH_FORM',
                    'ParamBodyAngleX': 'PARAM_BODY_ANGLE_X',
                    'ParamBodyAngleY': 'PARAM_BODY_ANGLE_Y',
                    'ParamBodyAngleZ': 'PARAM_BODY_ANGLE_Z'
                };
                if (map[id]) v2Id = map[id];
                
                let index = -1;
                if (core.getParamIndex) index = core.getParamIndex(v2Id);
                
                if (index !== -1) core.setParamFloat(index, value);
                else try { core.setParamFloat(v2Id, value); } catch(e) {}
            }
        };

        // 设置参数
        // 注意：Live2D 参数通常需要每帧设置，因为 internalModel 会在更新开始时重置它们
        setParam('ParamAngleX', head.degrees.y); 
        setParam('ParamAngleY', head.degrees.x);
        setParam('ParamAngleZ', head.degrees.z);
        setParam('ParamEyeLOpen', 1 - eye.l);
        setParam('ParamEyeROpen', 1 - eye.r);
        
        if (riggedFace.pupil) {
            setParam('ParamEyeBallX', riggedFace.pupil.x);
            setParam('ParamEyeBallY', riggedFace.pupil.y);
        }
        
        setParam('ParamMouthOpenY', mouth.y);
        setParam('ParamMouthForm', mouth.x); 
        setParam('ParamBodyAngleX', head.degrees.y * 0.5);
        setParam('ParamBodyAngleY', head.degrees.x * 0.5);
        setParam('ParamBodyAngleZ', head.degrees.z * 0.5);
    }
};
