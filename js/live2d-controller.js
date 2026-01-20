// js/live2d-controller.js
window.Live2DController = {
    app: null,
    currentModel: null,
    lastRiggedData: null,

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

        // 缩放控制
        const view = this.app.view;
        // 滚轮缩放
        view.addEventListener('wheel', (e) => {
            if (!this.currentModel) return;
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            let newScale = this.currentModel.scale.x + delta;
            newScale = Math.max(0.05, Math.min(newScale, 5.0));
            this.currentModel.scale.set(newScale);
        }, { passive: false });

        // 双指缩放
        let initialDistance = 0;
        let initialScale = 1;
        view.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2 && this.currentModel) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialDistance = Math.sqrt(dx * dx + dy * dy);
                initialScale = this.currentModel.scale.x;
            }
        });
        view.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && this.currentModel) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (initialDistance > 0) {
                    const scaleFactor = distance / initialDistance;
                    let newScale = initialScale * scaleFactor;
                    newScale = Math.max(0.05, Math.min(newScale, 5.0));
                    this.currentModel.scale.set(newScale);
                }
            }
        }, { passive: false });
        
        // 全局更新循环：确保面捕数据每帧都被应用
        this.app.ticker.add(() => {
            if (this.currentModel && this.lastRiggedData) {
                this.applyRiggedData(this.currentModel, this.lastRiggedData);
            }
        });
        
        console.log("Pixi initialized");
    },
    setLoadProgress: function(percent, loaded, total, label) {
        const progressEl = document.getElementById('load-progress');
        const barEl = document.getElementById('load-progress-bar');
        const textEl = document.getElementById('load-progress-text');
        if (!progressEl || !barEl || !textEl) return;
        if (percent === null) {
            progressEl.style.display = 'none';
            textEl.style.display = 'none';
            barEl.style.width = '0%';
            textEl.innerText = '';
            return;
        }
        progressEl.style.display = 'block';
        textEl.style.display = 'block';
        const fallbackPercent = loaded > 0 ? 20 : 5;
        const safePercent = Number.isFinite(percent) && total > 0 ? Math.max(0, Math.min(100, percent)) : fallbackPercent;
        barEl.style.width = safePercent + '%';
        if (total && total > 0 && Number.isFinite(loaded)) {
            textEl.innerText = `${label || '正在加载'} ${this.formatBytes(loaded)} / ${this.formatBytes(total)} (${Math.round(safePercent)}%)`;
            return;
        }
        textEl.innerText = `${label || '正在加载'}`;
    },
    formatBytes: function(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    },
    normalizeUrl: function(source) {
        try {
            return new URL(source, window.location.href).toString();
        } catch (e) {
            return null;
        }
    },
    collectModelAssetUrls: function(modelJson, baseUrl) {
        if (!modelJson || !modelJson.FileReferences) return [];
        const refs = modelJson.FileReferences;
        const assets = new Set();
        const addFile = (file) => {
            if (file && typeof file === 'string') assets.add(new URL(file, baseUrl).toString());
        };
        addFile(refs.Moc);
        addFile(refs.Physics);
        addFile(refs.DisplayInfo);
        addFile(refs.MotionSync);
        if (Array.isArray(refs.Textures)) {
            refs.Textures.forEach(addFile);
        }
        if (refs.Motions && typeof refs.Motions === 'object') {
            Object.values(refs.Motions).forEach((motionGroup) => {
                if (Array.isArray(motionGroup)) {
                    motionGroup.forEach((motion) => {
                        if (motion && typeof motion === 'object') {
                            addFile(motion.File);
                            addFile(motion.Sound);
                        }
                    });
                }
            });
        }
        if (refs.Expressions && Array.isArray(refs.Expressions)) {
            refs.Expressions.forEach((exp) => {
                if (exp && typeof exp === 'object') addFile(exp.File);
            });
        }
        return Array.from(assets);
    },
    fetchWithProgress: async function(url, progress, label) {
        const response = await fetch(url, { cache: 'force-cache' });
        const responseClone = response.clone();
        if (!response.ok) throw new Error(`资源加载失败: ${response.status} ${response.statusText}`);
        const total = Number(response.headers.get('content-length')) || 0;
        if (total > 0) {
            progress.total += total;
        }
        if (progress.onUpdate) {
            const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
            progress.onUpdate(percent, progress.loaded, progress.total, label);
        }
        if (response.body && response.body.getReader) {
            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;
            while (true) {
                const result = await reader.read();
                if (result.done) break;
                const value = result.value;
                received += value.length;
                progress.loaded += value.length;
                chunks.push(value);
                if (progress.onUpdate) {
                    const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
                    progress.onUpdate(percent, progress.loaded, progress.total, label);
                }
            }
            if (total === 0) {
                progress.total += received;
                if (progress.onUpdate) {
                    const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
                    progress.onUpdate(percent, progress.loaded, progress.total, label);
                }
            }
            const buffer = new Uint8Array(received);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }
            if ('caches' in window) {
                const cache = await caches.open('live2d-model-cache-v1');
                cache.put(url, responseClone).catch(() => {});
            }
            return buffer.buffer;
        }
        const arrayBuffer = await response.arrayBuffer();
        const size = arrayBuffer.byteLength;
        progress.loaded += size;
        if (total === 0) {
            progress.total += size;
        }
        if (progress.onUpdate) {
            const percent = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
            progress.onUpdate(percent, progress.loaded, progress.total, label);
        }
        if ('caches' in window) {
            const cache = await caches.open('live2d-model-cache-v1');
            cache.put(url, responseClone).catch(() => {});
        }
        return arrayBuffer;
    },
    prefetchModelAssets: async function(source, onUpdate) {
        const modelUrl = this.normalizeUrl(source);
        if (!modelUrl) return;
        const progress = { loaded: 0, total: 0, onUpdate };
        const modelBuffer = await this.fetchWithProgress(modelUrl, progress, '读取模型信息');
        const text = new TextDecoder().decode(modelBuffer);
        const modelJson = JSON.parse(text);
        const baseUrl = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1);
        const assets = this.collectModelAssetUrls(modelJson, baseUrl);
        if (assets.length === 0) return;
        const concurrency = 3;
        let index = 0;
        const worker = async () => {
            while (index < assets.length) {
                const current = assets[index];
                index += 1;
                await this.fetchWithProgress(current, progress, '预加载模型资源');
            }
        };
        const workers = [];
        for (let i = 0; i < concurrency; i += 1) {
            workers.push(worker());
        }
        await Promise.all(workers);
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
            this.setLoadProgress(0, 0, 0, '准备加载');
            if (this.currentModel) {
                this.app.stage.removeChild(this.currentModel);
                this.currentModel.destroy();
                this.currentModel = null;
            }

            console.log("Starting model load...");
            try {
                await this.prefetchModelAssets(source, (percent, loaded, total, label) => {
                    this.setLoadProgress(percent, loaded, total, label);
                });
            } catch (e) {
                console.warn(e);
            }
            const model = await Live2DModel.from(source);
            
            // 禁用自动空闲动画，防止模型自己乱动
            if (model.internalModel.motionManager) {
                model.internalModel.motionManager.idleMotionPaused = true;
            }
            
            // 禁用默认的鼠标跟随，避免冲突
            model.autoInteract = false;

            this.currentModel = model;
            this.app.stage.addChild(model);

            this.resizeModel(); 
            
            model.visible = true;
            model.alpha = 1;

            if(statusText) statusText.innerText = "模型加载成功";
            this.setLoadProgress(100, 1, 1, '加载完成');
            setTimeout(() => this.setLoadProgress(null), 800);
            console.log("Model loaded:", model);
        } catch (e) {
            console.error(e);
            if(statusText) statusText.innerText = "模型加载失败: " + e.message;
            this.setLoadProgress(null);
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

    update: function(data) {
        if (!data) return;
        
        // 确保 data 结构一致
        if (data.face || data.pose) {
            this.lastRiggedData = data;
        } else if (data.head) {
             // 兼容旧接口（如果直接传了 face rig 对象）
             this.lastRiggedData = { face: data, pose: null };
        }
    },

    applyRiggedData: function(model, data) {
        if (!model || !model.internalModel || !data) return;

        // 参数别名映射表 (适配不规范模型)
        const PARAM_ALIASES = {
            'ParamAngleX': ['ParamAngleX', 'PARAM_ANGLE_X', 'Param85'], // Param85: 艾玛
            'ParamAngleY': ['ParamAngleY', 'PARAM_ANGLE_Y', 'Param86'], // Param86: 艾玛
            'ParamAngleZ': ['ParamAngleZ', 'PARAM_ANGLE_Z', 'Param87'], // Param87: 艾玛
            'ParamBodyAngleX': ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X', 'ParamBodyAngleX'],
            'ParamBodyAngleY': ['ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y', 'ParamBodyAngleY'],
            'ParamBodyAngleZ': ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z', 'ParamBodyAngleZ'],
            'ParamEyeLOpen': ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN', 'ParamEyeLOpen'],
            'ParamEyeROpen': ['ParamEyeROpen', 'PARAM_EYE_R_OPEN', 'ParamEyeROpen'],
            'ParamMouthOpenY': ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpenY']
        };

        const core = model.internalModel.coreModel;
        const riggedFace = data.face;
        const riggedPose = data.pose;
        
        // 如果连面部数据都没有，就无法驱动大部分参数
        if (!riggedFace) return;

        const head = riggedFace.head;
        const eye = riggedFace.eye;
        const mouth = riggedFace.mouth;

        // 兼容 Cubism 4 (setParameterValueById) 和 Cubism 2 (setParamFloat)
        // 支持多别名映射
        const setParam = (id, value) => {
            const aliases = PARAM_ALIASES[id] || [id];
            aliases.forEach(alias => {
                if (core.setParameterValueById) {
                    // Cubism 4
                    core.setParameterValueById(alias, value);
                } else if (core.setParamFloat) {
                    // Cubism 2
                    if (core.getParamIndex) {
                        const index = core.getParamIndex(alias);
                        if (index !== -1) {
                            core.setParamFloat(index, value);
                            return;
                        }
                    }
                    try { core.setParamFloat(alias, value); } catch(e) {}
                }
            });
        };


        // 头部旋转
        setParam('ParamAngleX', head.degrees.y); 
        setParam('ParamAngleY', head.degrees.x);
        setParam('ParamAngleZ', head.degrees.z);
        
        // 眼睛
        setParam('ParamEyeLOpen', eye.l);
        setParam('ParamEyeROpen', eye.r);
        
        if (riggedFace.pupil) {
            setParam('ParamEyeBallX', riggedFace.pupil.x);
            setParam('ParamEyeBallY', riggedFace.pupil.y);
        }
        
        // 嘴巴
        setParam('ParamMouthOpenY', mouth.y);
        setParam('ParamMouthForm', mouth.x); 
        
        // 身体跟随 / 姿态控制
        if (riggedPose && riggedPose.Spine) {
            const toDegrees = (rad) => rad * 180 / Math.PI;
            const spine = riggedPose.Spine;
            // 映射 Pose 旋转到身体参数 (根据经验调整系数)
            // Spine.y (Yaw) -> ParamBodyAngleX (Twist)
            // Spine.x (Pitch) -> ParamBodyAngleY (Lean F/B)
            // Spine.z (Roll) -> ParamBodyAngleZ (Lean L/R)
            
            // 注意：Kalidokit 的坐标系可能需要调整方向
            setParam('ParamBodyAngleX', toDegrees(spine.y) * 1.5); 
            setParam('ParamBodyAngleY', toDegrees(spine.x) * 1.0);
            setParam('ParamBodyAngleZ', toDegrees(spine.z) * 1.0);
        } else {
            // 回退：仅使用头部数据带动身体
            setParam('ParamBodyAngleX', head.degrees.y * 0.5);
            setParam('ParamBodyAngleY', head.degrees.x * 0.5);
            setParam('ParamBodyAngleZ', head.degrees.z * 0.5);
        }

        // 呼吸
        setParam('ParamBreath', (Date.now() % 1000) / 1000);
    }
};
