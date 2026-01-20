// js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化 Live2D
    Live2DController.init('canvas');

    // 2. 默认加载模型
    const defaultUrl = document.getElementById('model-url').value;
    if (defaultUrl) {
        Live2DController.loadModel(defaultUrl, 'status-text');
    }

    // 3. 绑定事件
    bindEvents();

    // 4. 注册 PWA
    registerSW();
});

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
                // 更新 Live2D
                Live2DController.update(riggedFace);
                
                // 更新 UI 调试信息
                updateDebugUI(riggedFace);
            });
            statusText.innerText = "摄像头正在运行 (v1.26)";
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
        const head = face.head;
        html += `[FACE]
Pitch: ${head.degrees.x.toFixed(1)}°
Yaw:   ${head.degrees.y.toFixed(1)}°
Roll:  ${head.degrees.z.toFixed(1)}°
Mouth: ${face.mouth.y.toFixed(2)} (${face.mouth.shape.A.toFixed(2)}, ${face.mouth.shape.I.toFixed(2)})
Eye L: ${face.eye.l.toFixed(2)}
Eye R: ${face.eye.r.toFixed(2)}
Pupil: X=${face.pupil ? face.pupil.x.toFixed(2) : 'N/A'}, Y=${face.pupil ? face.pupil.y.toFixed(2) : 'N/A'}
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
                 html += `\n[POSE] Calc Failed (Visible but not solved)`;
             } else {
                 html += `\n[POSE] Calc Failed (Shoulders not visible)`;
             }
        } else {
             html += `\n[POSE] Not Detected (Move further back)`;
        }
    }

    // 原始数据状态
    const raw = riggedData.raw || {};
    html += `\n[RAW] Face: ${raw.faceLandmarks ? 'OK' : 'NO'}, Pose: ${raw.poseLandmarks ? 'OK' : 'NO'}`;
    
    if (window.performance && window.performance.memory) {
        const mem = window.performance.memory;
        const used = (mem.usedJSHeapSize / 1048576).toFixed(1);
        const total = (mem.totalJSHeapSize / 1048576).toFixed(1);
        html += `\n[MEM] ${used} / ${total} MB`;
    }

    debugEl.innerText = html;
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
