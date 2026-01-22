// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const cameraStatus = document.getElementById('status-text');
    if(cameraStatus) {
        cameraStatus.innerText = "v1.39.4 - 摄像头未启动";
    }

    // 1. 初始化 Live2D
    Live2DController.init('canvas');

    // 2. 默认加载模型
    // 修改：默认不加载任何模型，等待用户选择
    // const defaultUrl = document.getElementById('model-url').value;
    // if (defaultUrl) {
    //    Live2DController.loadModel(defaultUrl, 'status-text');
    // }

    // 3. 绑定事件
    bindEvents();

    // 4. 注册 PWA
    registerSW();

    // 5. 初始化 PeerJS (仅用于左侧 ID 显示，不显示右侧弹窗)
    initPeerJS();

    // 6. 预加载常用模型 (后台静默加载)
    setTimeout(() => {
        const preloadModels = [
            'models/希罗/希罗.model3.json',
            'models/艾玛/艾玛.model3.json'
        ];

        console.log("开始预加载模型...");
        
        preloadModels.reduce((promise, url) => {
            return promise.then(() => {
                console.log(`正在预加载: ${url}`);
                return Live2DController.prefetchModelAssets(url, () => {});
            });
        }, Promise.resolve()).then(() => {
             console.log("所有模型预加载完成");
        }).catch(err => {
             console.warn("模型预加载失败:", err);
        });

    }, 2000); // 延迟 2 秒执行，优先保证页面渲染
});

function initPeerJS() {
    // 生成随机短 ID (例如: PC-1234)
    const randomId = 'PC-' + Math.floor(Math.random() * 9000 + 1000);
    
    // 初始化 Peer
    const peer = new Peer(randomId, {
        debug: 1,
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    const idDisplay = document.getElementById('peer-id-display');
    const statusDisplay = document.getElementById('remote-status');
    
    if (idDisplay) {
        idDisplay.innerText = "初始化中...";
        idDisplay.addEventListener('click', () => {
             navigator.clipboard.writeText(randomId);
             const original = idDisplay.innerText;
             idDisplay.innerText = "已复制!";
             setTimeout(() => idDisplay.innerText = original, 1000);
        });
    }

    peer.on('open', (id) => {
        console.log('My Peer ID is: ' + id);
        if (idDisplay) idDisplay.innerText = id;
        if (statusDisplay) statusDisplay.innerText = "等待手机连接...";
    });
    
    peer.on('connection', (conn) => {
        console.log('Remote connected:', conn.peer);
        if (statusDisplay) {
            statusDisplay.innerText = "✅ 设备已连接";
            statusDisplay.style.color = "#0f0";
        }
        
        // 自动禁用本地摄像头按钮，避免冲突
        const camBtn = document.getElementById('btn-camera');
        if (camBtn && !camBtn.disabled) {
            camBtn.innerText = "📷 远程接管中";
            camBtn.disabled = true;
        }

        conn.on('data', (data) => {
            // 构造兼容的 riggedData 对象
            const riggedData = {
                face: data.face,
                pose: data.pose,
                raw: {}, 
                fps: '-- (Remote)' 
            };
            
            Live2DController.update(riggedData);
            updateDebugUI(riggedData);
        });
        
        conn.on('close', () => {
            if (statusDisplay) {
                statusDisplay.innerText = "❌ 连接断开";
                statusDisplay.style.color = "#ffaa00";
            }
            // 恢复本地摄像头按钮
            if (camBtn) {
                camBtn.innerText = "📷 开启摄像头";
                camBtn.disabled = false;
            }
        });
    });
    
    peer.on('error', (err) => {
        console.error('PeerJS Error:', err);
        if (statusDisplay) statusDisplay.innerText = "离线模式";
    });
}

function bindEvents() {
    // 预设选择改变
    const presetSelect = document.getElementById('preset-select');
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            const url = e.target.value;
            if (url) {
                document.getElementById('model-url').value = url;
                // 自动触发加载
                Live2DController.loadModel(url, 'status-text');
            }
        });
    }

    // 网络加载按钮
    document.getElementById('btn-load').addEventListener('click', () => {
        const url = document.getElementById('model-url').value;
        if (url) Live2DController.loadModel(url, 'status-text');
    });

    // 摄像头按钮
    document.getElementById('btn-camera').addEventListener('click', async () => {
        const statusText = document.getElementById('status-text');
        statusText.innerText = "正在初始化摄像头...";
        
        try {
            await CameraController.init('video-preview', 'output-canvas', (riggedFace) => {
                try {
                    Live2DController.update(riggedFace);
                    updateDebugUI(riggedFace);
                } catch (err) {
                    console.error('Rigged data handling error:', err);
                    const debugEl = document.getElementById('debug-container');
                    if (debugEl) debugEl.innerText = `数据处理错误: ${err.message}`;
                }
            });
            statusText.innerText = "摄像头正在运行 (v1.39.4)";
            document.getElementById('btn-camera').disabled = true;
            
            // 显示监控面板
            const monitorPanel = document.getElementById('monitor-panel');
            if (monitorPanel) monitorPanel.style.display = 'flex';
            
        } catch (err) {
            statusText.innerText = "摄像头启动失败: " + err.message;
        }
    });

    // 刷新按钮
    document.getElementById('btn-refresh').addEventListener('click', () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        }
        window.location.reload(true);
    });

    // 窗口缩放
    window.onresize = () => {
        Live2DController.resizeModel();
    };

    // 绑定骨骼显示设置
    const cbFace = document.getElementById('cb-face');
    const cbPose = document.getElementById('cb-pose');
    const cbHands = document.getElementById('cb-hands');
    
    const updateDrawConfig = () => {
        if (window.CameraController && CameraController.setDrawConfig) {
            CameraController.setDrawConfig({
                showFace: cbFace.checked,
                showPose: cbPose.checked,
                showHands: cbHands.checked
            });
        }
    };

    if (cbFace) cbFace.addEventListener('change', updateDrawConfig);
    if (cbPose) cbPose.addEventListener('change', updateDrawConfig);
    if (cbHands) cbHands.addEventListener('change', updateDrawConfig);

    // 摄像头画面点击放大/缩小
    const videoContainer = document.getElementById('video-container');
    const closeBtn = document.getElementById('video-close-btn');

    if (videoContainer) {
        videoContainer.addEventListener('click', () => {
            videoContainer.classList.toggle('expanded');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡
            videoContainer.classList.remove('expanded');
        });
    }

    // 监控面板折叠
    const monitorHeader = document.getElementById('monitor-header');
    const monitorPanel = document.getElementById('monitor-panel');
    if (monitorHeader && monitorPanel) {
        monitorHeader.addEventListener('click', () => {
            monitorPanel.classList.toggle('collapsed');
        });
    }

    const senderBtn = document.getElementById('btn-sender');
    if (senderBtn) {
        senderBtn.addEventListener('click', () => {
            window.open('sender.html', '_blank');
        });
    }

    // ----------------------------------------------------
    // 新增：UI 交互逻辑 (v1.36.0)
    // ----------------------------------------------------
    const uiLayer = document.getElementById('ui-layer');
    const btnToggleUI = document.getElementById('btn-toggle-ui');
    
    // 1. 显隐切换
    if (btnToggleUI && uiLayer) {
        btnToggleUI.addEventListener('click', () => {
            if (uiLayer.style.opacity === '0') {
                uiLayer.style.opacity = '1';
                uiLayer.style.pointerEvents = 'auto';
                // uiLayer.style.transform = 'scale(1)'; // 不重置缩放，只处理透明度
            } else {
                uiLayer.style.opacity = '0';
                uiLayer.style.pointerEvents = 'none';
            }
        });
    }

    // 2. 菜单缩放 (修改为按钮控制)
    // 修复：改用 zoom 而不是 transform: scale，因为 transform 在 OBS 中会导致点击坐标错位
    const btnScaleUp = document.getElementById('btn-scale-up');
    const btnScaleDown = document.getElementById('btn-scale-down');
    const scaleVal = document.getElementById('scale-val');
    
    let currentScale = 1.0;

    const updateScale = () => {
        // 使用 zoom 属性 (非标准但 Chrome/OBS 支持良好且不破坏点击坐标)
        if (uiLayer) uiLayer.style.zoom = currentScale;
        if (scaleVal) scaleVal.innerText = Math.round(currentScale * 100) + '%';
    };

    if (btnScaleUp) {
        btnScaleUp.addEventListener('click', () => {
            if (currentScale < 1.5) {
                currentScale += 0.1;
                updateScale();
            }
        });
    }

    if (btnScaleDown) {
        btnScaleDown.addEventListener('click', () => {
            if (currentScale > 0.5) {
                currentScale -= 0.1;
                updateScale();
            }
        });
    }

    // 4. 摄像头分辨率切换
    const resSelect = document.getElementById('cam-resolution');
    if (resSelect) {
        resSelect.addEventListener('change', async (e) => {
            const val = e.target.value;
            const [w, h] = val.split('x').map(Number);
            
            if (w && h && window.CameraController) {
                // 暂时禁用防止连点
                resSelect.disabled = true;
                const originalText = resSelect.options[resSelect.selectedIndex].text;
                resSelect.options[resSelect.selectedIndex].text = "切换中...";
                
                try {
                    await CameraController.setResolution(w, h);
                } catch(err) {
                    console.error("Resolution switch failed", err);
                    alert("切换分辨率失败，可能是摄像头不支持或被占用");
                } finally {
                    resSelect.disabled = false;
                    resSelect.options[resSelect.selectedIndex].text = originalText;
                }
            }
        });
    }

    // 5. 模型精度切换
    const complexitySelect = document.getElementById('cam-complexity');
    if (complexitySelect) {
        complexitySelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && window.CameraController) {
                CameraController.setModelComplexity(val);
            }
        });
    }

    // 6. FPS 限制切换
    const fpsLimitSelect = document.getElementById('cam-fps-limit');
    if (fpsLimitSelect) {
        fpsLimitSelect.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && window.CameraController) {
                CameraController.setFpsLimit(val);
            }
        });
    }

    // 7. 精细面部追踪切换
    const refineFaceCheck = document.getElementById('cam-refine');
    if (refineFaceCheck) {
        refineFaceCheck.addEventListener('change', (e) => {
            if (window.CameraController) {
                CameraController.setRefineFace(e.target.checked);
            }
        });
    }

    // 3. 背景颜色切换
    const btnBgDefault = document.getElementById('btn-bg-default');
    const btnBgTransparent = document.getElementById('btn-bg-transparent');
    const btnBgGreen = document.getElementById('btn-bg-green');
    const canvas = document.getElementById('canvas');

    // 辅助函数：重置所有按钮边框
    const resetBgBtns = () => {
        [btnBgDefault, btnBgTransparent, btnBgGreen].forEach(btn => {
            if(btn) btn.style.border = 'none';
        });
    };

    if (btnBgDefault) {
        btnBgDefault.addEventListener('click', () => {
            document.body.style.background = '#222'; // 默认深灰
            if (canvas) canvas.style.background = '';
            resetBgBtns();
            btnBgDefault.style.border = '2px solid white';
        });
    }

    if (btnBgTransparent) {
        btnBgTransparent.addEventListener('click', () => {
            document.body.style.background = 'transparent'; // 透明
            if (canvas) canvas.style.background = 'transparent';
            resetBgBtns();
            btnBgTransparent.style.border = '2px solid white';
        });
    }

    if (btnBgGreen) {
        btnBgGreen.addEventListener('click', () => {
            document.body.style.background = '#00ff00'; // 绿幕
            if (canvas) canvas.style.background = '#00ff00';
            resetBgBtns();
            btnBgGreen.style.border = '2px solid white';
        });
    }
}

// 调试 UI 更新函数
function updateDebugUI(riggedData) {
    const debugEl = document.getElementById('debug-container');
    const fpsEl = document.getElementById('fps-display');
    
    // 优先更新 FPS
    if (fpsEl) {
        fpsEl.innerText = `FPS: ${riggedData.fps || '--'}`;
    }

    if (!debugEl) return;
    
    const face = riggedData.face;
    const pose = riggedData.pose;
    
    let html = '';

    if (face) {
        const head = face.head || {};
        const headDeg = head.degrees || {};
        const mouth = face.mouth || {};
        const mouthShape = mouth.shape || {};
        const eye = face.eye || {};
        const mouthY = Number.isFinite(mouth.y) ? mouth.y.toFixed(2) : 'N/A';
        const mouthA = Number.isFinite(mouthShape.A) ? mouthShape.A.toFixed(2) : 'N/A';
        const mouthI = Number.isFinite(mouthShape.I) ? mouthShape.I.toFixed(2) : 'N/A';
        const eyeL = Number.isFinite(eye.l) ? eye.l.toFixed(2) : 'N/A';
        const eyeR = Number.isFinite(eye.r) ? eye.r.toFixed(2) : 'N/A';
        const headX = Number.isFinite(headDeg.x) ? headDeg.x.toFixed(1) : 'N/A';
        const headY = Number.isFinite(headDeg.y) ? headDeg.y.toFixed(1) : 'N/A';
        const headZ = Number.isFinite(headDeg.z) ? headDeg.z.toFixed(1) : 'N/A';
        const pupilX = face.pupil && Number.isFinite(face.pupil.x) ? face.pupil.x.toFixed(2) : 'N/A';
        const pupilY = face.pupil && Number.isFinite(face.pupil.y) ? face.pupil.y.toFixed(2) : 'N/A';

        html += `[FACE]
Pitch: ${headX}°
Yaw:   ${headY}°
Roll:  ${headZ}°
Mouth: ${mouthY} (${mouthA}, ${mouthI})
Eye L: ${eyeL}
Eye R: ${eyeR}
Pupil: X=${pupilX}, Y=${pupilY}
`;
    } else {
        html += `[FACE] Not Detected\n`;
    }

    if (pose) {
        // 简单的脊柱数据展示
        const spine = pose.Spine;
        if (spine) {
            html += `
[POSE]
Body X: ${(spine.y * 180 / Math.PI).toFixed(1)}°
Body Y: ${(spine.x * 180 / Math.PI).toFixed(1)}°
Body Z: ${(spine.z * 180 / Math.PI).toFixed(1)}°
`;
        }
    } else {
        // 根据原始数据判断原因
        if (riggedData.raw && riggedData.raw.poseLandmarks) {
             // 检查肩膀可见性 (Landmarks 11 & 12)
             const lm = riggedData.raw.poseLandmarks;
             const leftShoulder = lm[11];
             const rightShoulder = lm[12];
             const isVisible = (p) => p && p.visibility > 0.5;
             
             if (isVisible(leftShoulder) && isVisible(rightShoulder)) {
                 html += `\n[POSE] Calc Failed (Visible but not solved - Adjust lighting/angle)`;
             } else {
                 html += `\n[POSE] Calc Failed (Shoulders not visible)`;
             }
        } else {
             html += `\n[POSE] Not Detected (Move further back)`;
        }
    }

    // 手势数据
    if (riggedData.gesture) {
        const l = riggedData.gesture.left;
        const r = riggedData.gesture.right;
        if (l != null || r != null) {
            html += `\n[GESTURE] L: ${l != null ? l : '-'} | R: ${r != null ? r : '-'}`;
        }
    }

    // 原始数据状态
    const raw = riggedData.raw || {};
    html += `\n[RAW] Face: ${raw.faceLandmarks ? 'OK' : 'NO'}, Pose: ${raw.poseLandmarks ? 'OK' : 'NO'}`;
    
    // 硬件信息 (CPU/GPU)
    // 注意：Web环境无法获取实时CPU/GPU使用率，仅能获取静态信息和JS内存
    const cpuCores = navigator.hardwareConcurrency || '?';
    const gpuName = getGPUModel();
    
    html += `\n[HW] CPU: ${cpuCores} Cores`;
    html += `\n[HW] GPU: ${gpuName}`;

    if (window.performance && window.performance.memory) {
        const mem = window.performance.memory;
        const used = (mem.usedJSHeapSize / 1048576).toFixed(1);
        const total = (mem.totalJSHeapSize / 1048576).toFixed(1);
        const limit = (mem.jsHeapSizeLimit / 1048576).toFixed(0);
        html += `\n[MEM] JS Heap: ${used} / ${total} MB (Limit: ${limit} MB)`;
    }

    debugEl.innerText = html;
}

// 缓存 GPU 信息，避免重复创建 Context
let _cachedGPUModel = null;
function getGPUModel() {
    if (_cachedGPUModel) return _cachedGPUModel;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                _cachedGPUModel = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            } else {
                _cachedGPUModel = gl.getParameter(gl.RENDERER);
            }
            
            // 简化名称，去除冗余信息
            if (_cachedGPUModel) {
                _cachedGPUModel = _cachedGPUModel.replace(/ANGLE \(/, '').replace(/\)/, '');
                // 截断过长的显卡名称
                if (_cachedGPUModel.length > 30) {
                     _cachedGPUModel = _cachedGPUModel.substring(0, 27) + '...';
                }
            }
        }
    } catch (e) {
        console.warn('GPU Info retrieval failed', e);
    }

    _cachedGPUModel = _cachedGPUModel || 'Unknown GPU';
    return _cachedGPUModel;
}

async function handleZipUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusText = document.getElementById('status-text');
    statusText.innerText = "正在解压模型...";

    try {
        const zip = await JSZip.loadAsync(file);
        let modelFileEntry = null;
        let modelDir = '';

        // 寻找 .model3.json (优先) 或 .model.json
        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (relativePath.endsWith('.model3.json')) {
                modelFileEntry = entry;
                break;
            }
            if (relativePath.endsWith('.model.json')) { // 兼容 Cubism 2
                modelFileEntry = entry;
            }
        }
        
        // 重新遍历获取目录 (因为上面可能只找到了文件)
        if (modelFileEntry) {
             const lastSlashIndex = modelFileEntry.name.lastIndexOf('/');
             if (lastSlashIndex !== -1) {
                 modelDir = modelFileEntry.name.substring(0, lastSlashIndex + 1);
             }
        }

        if (!modelFileEntry) {
            alert('压缩包内未找到 .model3.json 或 .model.json 文件');
            statusText.innerText = "解压失败: 未找到模型文件";
            return;
        }

        // 转换 Blob
        const fileMap = new Map();
        const conversionPromises = [];

        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (relativePath.startsWith(modelDir)) {
                const cleanPath = relativePath.substring(modelDir.length);
                const p = entry.async('blob').then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    fileMap.set(cleanPath, blobUrl);
                    fileMap.set('./' + cleanPath, blobUrl);
                });
                conversionPromises.push(p);
            }
        }

        await Promise.all(conversionPromises);

        // 解析 JSON 并替换路径
        const jsonStr = await modelFileEntry.async('string');
        const settings = JSON.parse(jsonStr);

        function replacePaths(obj) {
            if (typeof obj === 'string') {
                if (fileMap.has(obj)) return fileMap.get(obj);
                return obj;
            }
            if (Array.isArray(obj)) return obj.map(replacePaths);
            if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                for (const key in obj) newObj[key] = replacePaths(obj[key]);
                return newObj;
            }
            return obj;
        }

        const patchedSettings = replacePaths(settings);
        patchedSettings.url = fileMap.get(modelFileEntry.name.substring(modelDir.length)) || "model.json";

        console.log('加载 ZIP 模型配置:', patchedSettings);
        await Live2DController.loadModel(patchedSettings, 'status-text');
        
        statusText.innerText = "ZIP 模型加载成功";

    } catch (err) {
        console.error(err);
        statusText.innerText = "ZIP 处理失败: " + err.message;
        alert('ZIP 解析失败: ' + err.message);
    }
}

function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
}
