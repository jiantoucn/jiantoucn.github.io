// js/live2d-controller.js
window.Live2DController = {
    app: null,
    currentModel: null,
    lastRiggedData: null,
    
    // 平滑状态存储
    lastEyeL: 1,
    lastEyeR: 1,
    lastPupilX: 0,
    lastPupilY: 0,

    lerp: function(start, end, amt) {
        return (1 - amt) * start + amt * end;
    },

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

        // 交互控制 (缩放 + 拖动)
        const view = this.app.view;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let modelStartX = 0;
        let modelStartY = 0;

        // 滚轮缩放
        view.addEventListener('wheel', (e) => {
            if (!this.currentModel) return;
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            let newScale = this.currentModel.scale.x + delta;
            newScale = Math.max(0.05, Math.min(newScale, 5.0));
            this.currentModel.scale.set(newScale);
        }, { passive: false });

        // 鼠标拖动
        view.addEventListener('mousedown', (e) => {
            if (!this.currentModel) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            modelStartX = this.currentModel.x;
            modelStartY = this.currentModel.y;
        });
        window.addEventListener('mousemove', (e) => {
            if (isDragging && this.currentModel) {
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                this.currentModel.position.set(modelStartX + dx, modelStartY + dy);
            }
        });
        window.addEventListener('mouseup', () => { isDragging = false; });
        
        // 触摸控制
        let initialDistance = 0;
        let initialScale = 1;
        let touchMode = 'none'; // 'drag' or 'zoom'

        view.addEventListener('touchstart', (e) => {
            if (!this.currentModel) return;
            
            if (e.touches.length === 1) {
                // 单指拖动
                touchMode = 'drag';
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                modelStartX = this.currentModel.x;
                modelStartY = this.currentModel.y;
            } else if (e.touches.length === 2) {
                // 双指缩放
                touchMode = 'zoom';
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialDistance = Math.sqrt(dx * dx + dy * dy);
                initialScale = this.currentModel.scale.x;
            }
        });

        view.addEventListener('touchmove', (e) => {
            if (!this.currentModel) return;
            e.preventDefault();

            if (touchMode === 'drag' && e.touches.length === 1) {
                const dx = e.touches[0].clientX - dragStartX;
                const dy = e.touches[0].clientY - dragStartY;
                this.currentModel.position.set(modelStartX + dx, modelStartY + dy);
            } else if (touchMode === 'zoom' && e.touches.length === 2) {
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
        
        view.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                touchMode = 'none';
            } else if (e.touches.length === 1) {
                // 如果从双指变成单指，切换回拖动模式，重置起始点以防跳变
                touchMode = 'drag';
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
                modelStartX = this.currentModel.x;
                modelStartY = this.currentModel.y;
            }
        });
        
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
            'ParamEyeBallX': ['ParamEyeBallX', 'PARAM_EYE_BALL_X', 'ParamEyeBallX'],
            'ParamEyeBallY': ['ParamEyeBallY', 'PARAM_EYE_BALL_Y', 'ParamEyeBallY'],
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
        
        // 眼睛 (添加阈值处理，确保能完全闭合)
        // Kalidokit 虽然有 smoothBlink，但有时输出不够低
        const clampEye = (val) => {
            if (val < 0.2) return 0; // 强制闭眼阈值
            // 重新映射 0.2~1.0 -> 0.0~1.0
            return (val - 0.2) / 0.8;
        };

        this.lastEyeL = this.lerp(this.lastEyeL, clampEye(eye.l), 0.5);
        this.lastEyeR = this.lerp(this.lastEyeR, clampEye(eye.r), 0.5);

        setParam('ParamEyeLOpen', this.lastEyeL);
        setParam('ParamEyeROpen', this.lastEyeR);
        
        if (riggedFace.pupil) {
            this.lastPupilX = this.lerp(this.lastPupilX, riggedFace.pupil.x, 0.5);
            this.lastPupilY = this.lerp(this.lastPupilY, riggedFace.pupil.y, 0.5);
            // 放大眼球移动效果，使其更明显
            setParam('ParamEyeBallX', this.lastPupilX * 2.0);
            setParam('ParamEyeBallY', this.lastPupilY * 2.0);
        }
        
        // 嘴巴
        setParam('ParamMouthOpenY', mouth.y);
        setParam('ParamMouthForm', mouth.x); 
        
        // 身体跟随 / 姿态控制
        if (riggedPose && riggedPose.Spine) {
            const toDegrees = (rad) => rad * 180 / Math.PI;
            const spine = riggedPose.Spine;
            // 映射 Pose 旋转到身体参数 (根据经验调整系数)
            setParam('ParamBodyAngleX', toDegrees(spine.y) * 1.5); 
            setParam('ParamBodyAngleY', toDegrees(spine.x) * 1.0);
            setParam('ParamBodyAngleZ', toDegrees(spine.z) * 1.0);

            // 艾玛手臂控制 (实验性)
            // 检测手腕是否高于肩膀
            // 注意: Kalidokit 的坐标系中 Y 轴向上为正? 不，Kalidokit 输出的是旋转角度。
            // 我们需要用原始 Landmarks 来判断位置，或者看 Kalidokit 是否有相关输出。
            // 这里我们无法直接访问原始 Landmarks，只能依赖传入的 data.pose (riggedPose)
            // Kalidokit Pose 包含 RightArm, LeftArm 等旋转信息
            
            // 简单的抬手检测：检查上臂旋转
            // LeftUpperArm.z 如果很大，说明抬起来了
            if (riggedPose.LeftUpperArm) {
                // Z 轴旋转通常对应抬起
                // 归一化到 0-1
                let armZ = Math.abs(riggedPose.LeftUpperArm.z); 
                // 阈值判断
                let lift = Math.max(0, Math.min(1, (armZ - 0.5) * 2));
                setParam('Param23', lift); // 抬手
            }

        } else {
            // 回退：仅使用头部数据带动身体
            // 增加系数让它更明显
            setParam('ParamBodyAngleX', head.degrees.y * 1.0); // 0.5 -> 1.0
            setParam('ParamBodyAngleY', head.degrees.x * 1.0);
            setParam('ParamBodyAngleZ', head.degrees.z * 1.0);
        }

        // 呼吸
        setParam('ParamBreath', (Date.now() % 1000) / 1000);
    }
};
