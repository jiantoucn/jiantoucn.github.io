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
        let riggedFace = data.face;
        const riggedPose = data.pose;
        
        if (!riggedFace && riggedPose && riggedPose.Spine) {
            const spine = riggedPose.Spine;
            riggedFace = {
                head: {
                    degrees: {
                        x: (spine.x || 0) * 180 / Math.PI,
                        y: (spine.y || 0) * 180 / Math.PI,
                        z: (spine.z || 0) * 180 / Math.PI
                    }
                },
                eye: { l: 1, r: 1 },
                mouth: { x: 0, y: 0 }
            };
        }

        if (!riggedFace) return;

        const head = riggedFace.head;
        const eye = riggedFace.eye;
        const mouth = riggedFace.mouth;

        // 平滑处理参数 (Lerp)
    // 改进的自适应平滑：根据参数类型和变化幅度动态调整
    const lerp = (current, target, baseFactor, isAngle = false) => {
        const diff = Math.abs(target - current);
        
        // 动态系数计算
        let dynamicFactor = baseFactor;
        
        if (isAngle) {
            // 角度参数 (范围大 -30~30)
            // 增加死区防止微小抖动
            if (diff < 0.5) dynamicFactor = 0.05;      // 极小变动：非常慢的平滑 (防抖)
            else if (diff > 5.0) dynamicFactor = 0.6;  // 剧烈变动：快速响应
            else dynamicFactor = 0.15;                 // 正常变动：较慢平滑 (增加重量感)
        } else {
            // 0-1 参数 (眼睛/嘴巴)
            // 需要高响应速度，但必须防止抽搐
            if (diff > 0.4) dynamicFactor = 0.7;       // 快速眨眼/张嘴
            else if (diff < 0.1) dynamicFactor = 0.05; // 增加静止阈值 (0.05 -> 0.1)，减少微小抖动
            else dynamicFactor = 0.15;                 // 普通微动更平滑 (0.2 -> 0.15)
        }
        
        return current + (target - current) * dynamicFactor;
    };

    // 状态保持
    if (!this.lastParam) this.lastParam = {}; 

    // 辅助函数：设置参数值（带平滑）
    const setParam = (id, value, weight = 1.0, isAngle = false) => {
        if (!model) return;
        
        // 应用平滑
        const lastValue = this.lastParam[id] !== undefined ? this.lastParam[id] : value;
        // 针对不同参数使用不同的基础系数
        const baseFactor = isAngle ? 0.15 : 0.4;
        const smoothedValue = lerp(lastValue, value, baseFactor, isAngle);
        
        this.lastParam[id] = smoothedValue;

        const ids = PARAM_ALIASES[id] || [id];
        
        // 尝试设置每一个别名，直到成功
        for (const aliasId of ids) {
             // Cubism 4
             if (model.internalModel && model.internalModel.coreModel) {
                 const paramIndex = model.internalModel.coreModel.getParameterIndex(aliasId);
                 if (paramIndex !== -1) {
                     model.internalModel.coreModel.setParameterValueByIndex(paramIndex, smoothedValue, weight);
                     return;
                 }
             }
             // Cubism 2
             else if (model.internalModel && model.internalModel.setParamFloat) {
                 try {
                    model.internalModel.setParamFloat(aliasId, smoothedValue, weight);
                 } catch(e) {}
             }
        }
    };


    // 头部旋转 (标记为角度参数)
    setParam('ParamAngleX', head.degrees.y, 1.0, true); 
    setParam('ParamAngleY', head.degrees.x, 1.0, true);
    setParam('ParamAngleZ', head.degrees.z, 1.0, true);
    
    // 身体旋转
    // 优先使用 Pose 数据，但为了防止 Pose 数据微弱导致身体不动，
    // 我们强制混合头部数据来驱动身体 (这在 VTuber 软件中很常见)
    let bodyX = 0, bodyY = 0, bodyZ = 0;
    
    // 1. 获取基础 Pose 数据 (如果存在)
    if (riggedPose && riggedPose.Spine) {
        // Spine 输出是弧度，转换为角度
        bodyX = riggedPose.Spine.y * 180 / Math.PI; // Yaw (左右转)
        bodyY = riggedPose.Spine.x * 180 / Math.PI; // Pitch (前后俯仰)
        bodyZ = riggedPose.Spine.z * 180 / Math.PI; // Roll (左右摆动)
    }

    // 2. 混合头部数据 (增强身体跟随感)
    // 即使有 Pose 数据，头部大幅度动作也应该带动身体
    // 如果 Pose 数据丢失 (例如只有头部被检测到)，则完全依赖头部数据
    
    // 混合权重: 如果有 Pose，Pose 占 40%，Head 占 60% (因为 Head 数据通常更稳定且幅度大)
    // 如果没有 Pose，Head 占 100%
    const hasPose = (riggedPose && riggedPose.Spine);
    const poseWeight = hasPose ? 0.4 : 0.0;
    const headWeight = hasPose ? 0.6 : 0.8; // 如果没有 Pose，稍微降低一点系数防止身体动得太夸张

    bodyX = (bodyX * poseWeight) + (head.degrees.y * headWeight); 
    bodyY = (bodyY * poseWeight) + (head.degrees.x * headWeight);
    bodyZ = (bodyZ * poseWeight) + (head.degrees.z * headWeight);

    // 3. 应用参数设置 (调整幅度)
    // 身体参数通常需要较大的输入才能产生明显的动作
    // 艾玛模型的 BodyAngleX/Z 响应可能需要增强
    setParam('ParamBodyAngleX', bodyX * 2.0, 1.0, true); // 1.5 -> 2.0 (增强左右转响应)
    setParam('ParamBodyAngleY', bodyY * 1.2, 1.0, true); // 1.0 -> 1.2
    setParam('ParamBodyAngleZ', bodyZ * 1.5, 1.0, true); // 1.0 -> 1.5 (增强左右晃动响应)
    
    // 眼睛
    const clampEye = (val) => {
        if (val < 0.2) return 0;
        return (val - 0.2) / 0.8;
    };

    // 眼睛独立平滑 (0-1类型)
    this.lastEyeL = lerp(this.lastEyeL, clampEye(eye.l), 0.5, false);
    this.lastEyeR = lerp(this.lastEyeR, clampEye(eye.r), 0.5, false);

    setParam('ParamEyeLOpen', this.lastEyeL, 1.0, false);
    setParam('ParamEyeROpen', this.lastEyeR, 1.0, false);
    
    if (riggedFace.pupil) {
        // 瞳孔 X/Y 通常范围 -1~1
        this.lastPupilX = lerp(this.lastPupilX, riggedFace.pupil.x, 0.4, false);
            this.lastPupilY = lerp(this.lastPupilY, riggedFace.pupil.y, 0.5);
            // 放大眼球移动效果，使其更明显
            setParam('ParamEyeBallX', this.lastPupilX * 2.0);
            setParam('ParamEyeBallY', this.lastPupilY * 2.0);
        }
        
        // 嘴巴
        setParam('ParamMouthOpenY', mouth.y);
        setParam('ParamMouthForm', mouth.x); 
        
        // 艾玛手臂控制 (实验性)
        if (riggedPose && riggedPose.LeftUpperArm) {
             // Z 轴旋转通常对应抬起
             // 归一化到 0-1
             let armZ = Math.abs(riggedPose.LeftUpperArm.z); 
             // 阈值判断
             let lift = Math.max(0, Math.min(1, (armZ - 0.5) * 2));
             setParam('Param23', lift); // 抬手
        }

        // 呼吸
        setParam('ParamBreath', (Date.now() % 1000) / 1000);
    }
};
