// js/main.js - v2.0.11

document.addEventListener('DOMContentLoaded', () => {
    console.log("Main.js v2.0.11 loaded");

    // 强制检查 Service Worker 更新
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for(let registration of registrations) {
                // 添加 catch 避免未捕获的 Promise 错误触发全局弹窗
                registration.update().catch(err => {
                    console.log('SW update check:', err.message);
                });
            }
        });
    }
    const uiState = {
        sidebarOpen: true,
        monitorOpen: false,
        uiHidden: false,
        transparentMode: false
    };

    // DOM 元素
    const els = {
        sidebar: document.getElementById('sidebar'),
        monitorPanel: document.getElementById('monitor-panel'),
        monitorContent: document.getElementById('monitor-content'),
        uiContainer: document.getElementById('ui-container'),
        toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
        hideUiBtn: document.getElementById('hide-ui-btn'),
        statusText: document.getElementById('status-text'),
        statusDot: document.getElementById('status-dot'),
        debugInfo: document.getElementById('debug-info'),
        fpsDisplay: document.getElementById('fps-display'),
        toast: document.getElementById('toast'),
        btnCamera: document.getElementById('btn-camera')
    };

    // 初始化 Live2D
    Live2DController.init('canvas');

    // 默认不自动加载任何模型，等待用户选择
    // 但下拉菜单默认选中艾玛，方便用户直接点击加载
    setTimeout(() => {
        const defaultModel = document.getElementById('model-select').value;
        if (defaultModel) {
            loadModelFromUrl(defaultModel);
        }
    }, 500);

    // =========================================================================
    // UI 交互逻辑
    // =========================================================================

    // 1. 侧边栏切换
    els.toggleSidebarBtn.addEventListener('click', () => {
        uiState.sidebarOpen = !uiState.sidebarOpen;
        els.sidebar.classList.toggle('collapsed', !uiState.sidebarOpen);
    });

    // 2. 隐藏所有 UI
    els.hideUiBtn.addEventListener('click', () => {
        uiState.uiHidden = true;
        els.uiContainer.classList.add('hidden');
        els.toggleSidebarBtn.style.opacity = '0';
        els.toggleSidebarBtn.style.pointerEvents = 'none'; // 防止隐藏后还能点击
        
        showToast('UI 已隐藏，双击屏幕任意位置恢复');
    });

    // 双击恢复 UI (绑定到 window 以确保捕获)
    window.addEventListener('dblclick', (e) => {
        if (uiState.uiHidden) {
            uiState.uiHidden = false;
            els.uiContainer.classList.remove('hidden');
            els.toggleSidebarBtn.style.opacity = '1';
            els.toggleSidebarBtn.style.pointerEvents = 'auto';
            showToast('UI 已显示');
        }
    });

    // 3. 监控面板折叠
    document.getElementById('monitor-toggle').addEventListener('click', () => {
        const content = els.monitorContent;
        if (content.style.display === 'none') {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    });

    // 4. 透明背景切换
    document.getElementById('btn-bg-transparent').addEventListener('click', () => {
        uiState.transparentMode = !uiState.transparentMode;
        document.body.classList.toggle('transparent', uiState.transparentMode);
        
        if (uiState.transparentMode) {
            showToast('已切换为透明背景 (OBS)');
        } else {
            showToast('已切换为深色背景');
        }
    });

    // 5. 刷新按钮
    document.getElementById('btn-refresh').addEventListener('click', () => {
        showToast('正在清理缓存并刷新...');
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) registration.unregister();
            });
        }
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) caches.delete(name);
            });
        }
        setTimeout(() => {
            window.location.reload(true);
        }, 500);
    });

    // 6. 跳转发送端
    document.getElementById('btn-sender').addEventListener('click', () => {
        window.open('sender.html', '_blank');
    });

    // =========================================================================
    // 模型加载逻辑
    // =========================================================================

    // 下拉选择加载
    document.getElementById('model-select').addEventListener('change', (e) => {
        const url = e.target.value;
        if (url) loadModelFromUrl(url);
    });

    // URL 加载
    document.getElementById('btn-load-selected').addEventListener('click', () => {
        const url = document.getElementById('model-select').value;
        if (url) {
            loadModelFromUrl(url);
        } else {
            showToast('请先选择一个模型');
        }
    });

    // ZIP 上传 (已移除)
    // document.getElementById('file-upload').addEventListener('change', handleZipUpload);

    async function loadModelFromUrl(url) {
        showLoading(true);
        updateStatus('正在加载模型...', 'active');
        try {
            await Live2DController.loadModel(url, 'status-text'); // status-text 逻辑保留兼容
            updateStatus('模型加载完成', 'active');
            showToast('模型加载成功');
        } catch (err) {
            console.error(err);
            updateStatus('加载失败', 'error');
            showToast('加载失败: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    // =========================================================================
    // 摄像头逻辑
    // =========================================================================

    els.btnCamera.addEventListener('click', async () => {
        updateStatus('正在初始化摄像头...', 'active');
        els.btnCamera.disabled = true;
        
        try {
            await CameraController.init('video-preview', 'output-canvas', (riggedFace) => {
                try {
                    Live2DController.update(riggedFace);
                    updateDebugUI(riggedFace);
                } catch (err) {
                    console.error('Data update error:', err);
                }
            });
            
            updateStatus('摄像头运行中', 'active');
            els.btnCamera.innerText = '📷 启动';
            els.btnCamera.disabled = false;
            
            // 显示监控面板
            els.monitorPanel.style.display = 'flex';
            uiState.monitorOpen = true;
            
        } catch (err) {
            console.error(err);
            updateStatus('摄像头启动失败', 'error');
            els.btnCamera.disabled = false;
            showToast('摄像头错误: ' + err.message);
        }
    });

    // 关闭摄像头
    document.getElementById('btn-close-camera').addEventListener('click', async () => {
        if (window.CameraController) {
            await CameraController.stop();
            updateStatus('摄像头已关闭', 'normal');
            els.monitorPanel.style.display = 'none';
            uiState.monitorOpen = false;
            showToast('摄像头已关闭');
        }
    });

    // 分辨率切换
    document.getElementById('cam-resolution').addEventListener('change', (e) => {
        if (window.CameraController) {
            const [w, h] = e.target.value.split('x').map(Number);
            CameraController.setResolution(w, h); // 需要在 CameraController 中实现或确认
            showToast(`分辨率切换至 ${w}x${h}`);
        }
    });

    // 模型精度切换
    document.getElementById('cam-complexity').addEventListener('change', (e) => {
        if (window.CameraController) {
            const complexity = parseInt(e.target.value);
            CameraController.setModelComplexity(complexity);
            const text = ['Lite (极速)', 'Full (标准)', 'Heavy (高精)'][complexity];
            showToast(`模型精度已切换至: ${text}`);
        }
    });

    // FPS 限制
    document.getElementById('cam-fps-limit').addEventListener('change', (e) => {
        if (window.CameraController) {
            CameraController.setFpsLimit(parseInt(e.target.value));
        }
    });

    // 面部精细化
    document.getElementById('cam-refine').addEventListener('change', (e) => {
        if (window.CameraController) {
            CameraController.setRefineFace(e.target.checked);
        }
    });

    // 骨骼显示开关
    const bindCheckbox = (id, prop) => {
        document.getElementById(id).addEventListener('change', (e) => {
            if (window.CameraController) CameraController[prop] = e.target.checked;
        });
    };
    bindCheckbox('cb-face', 'showFace');
    bindCheckbox('cb-pose', 'showPose');
    bindCheckbox('cb-hands', 'showHands');

    // =========================================================================
    // 辅助函数
    // =========================================================================

    function updateStatus(text, type) { // type: 'active', 'error', 'normal'
        els.statusText.innerText = text;
        els.statusDot.className = 'status-dot'; // reset
        if (type) els.statusDot.classList.add(type);
    }

    function showLoading(show) {
        const bar = document.getElementById('load-progress');
        if (bar) bar.style.display = show ? 'block' : 'none';
    }

    function showToast(msg) {
        const t = els.toast;
        t.innerText = msg;
        t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    // 调试信息更新
    function updateDebugUI(data) {
        // 更新 FPS
        if (els.fpsDisplay && data.fps) {
            els.fpsDisplay.innerText = Math.round(data.fps);
        }

        // 仅在面板展开时更新文本，节省性能
        if (els.monitorContent.style.display === 'none') return;

        let html = '';
        
        // --- Face Info ---
        const face = data.face;
        if (face) {
            const deg = face.head.degrees;
            html += `=== FACE HEAD ===\n`;
            html += `Rot X (Pitch) : ${deg.x.toFixed(1)}°\n`;
            html += `Rot Y (Yaw)   : ${deg.y.toFixed(1)}°\n`;
            html += `Rot Z (Roll)  : ${deg.z.toFixed(1)}°\n`;
            
            html += `\n=== FACE EYES ===\n`;
            html += `Open Left     : ${face.eye.l.toFixed(2)}\n`;
            html += `Open Right    : ${face.eye.r.toFixed(2)}\n`;
            html += `Pupil X       : ${face.pupil ? face.pupil.x.toFixed(2) : '-'}\n`;
            html += `Pupil Y       : ${face.pupil ? face.pupil.y.toFixed(2) : '-'}\n`;
            html += `Brow Left     : ${face.brow ? face.brow.l.toFixed(2) : '-'}\n`;
            html += `Brow Right    : ${face.brow ? face.brow.r.toFixed(2) : '-'}\n`;

            html += `\n=== FACE MOUTH ===\n`;
            html += `Open Y        : ${face.mouth.y.toFixed(2)}\n`;
            html += `Form (Vowel)  : ${face.mouth.shape ? getDominantVowel(face.mouth.shape) : '-'}\n`;
            
            if (face.mouth.shape) {
                const shapes = Object.entries(face.mouth.shape)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
                    .join(', ');
                html += `Top Shapes    : ${shapes}\n`;
            }
        } else {
            html += `=== FACE ===\nNot Detected\n`;
        }
        html += `\n`;

        // --- Gesture Info ---
        const gesture = data.gesture;
        html += `=== HAND GESTURE ===\n`;
        if (gesture) {
            const l = gesture.left !== null ? gesture.left : '-';
            const r = gesture.right !== null ? gesture.right : '-';
            html += `Left Hand     : ${l}\n`;
            html += `Right Hand    : ${r}\n`;
        } else {
             html += `No Gesture Data\n`;
        }
        html += `\n`;

        // --- Pose Info ---
        if (data.pose) {
             html += `=== BODY POSE ===\n`;
             html += `Detected      : YES\n`;
             // Add raw landmark visibility
             if (data.raw && data.raw.poseLandmarks) {
                 const lm = data.raw.poseLandmarks;
                 // 11=Left Shoulder, 12=Right Shoulder, 15=Left Wrist, 16=Right Wrist
                 const ls = lm[11], rs = lm[12];
                 const lw = lm[15], rw = lm[16];
                 if (ls && rs) {
                     html += `Shoulder Vis  : L:${ls.visibility.toFixed(2)} R:${rs.visibility.toFixed(2)}\n`;
                     html += `Shoulder Z    : L:${ls.z.toFixed(2)} R:${rs.z.toFixed(2)}\n`;
                 }
                 if (lw && rw) {
                     html += `Wrist Vis     : L:${lw.visibility.toFixed(2)} R:${rw.visibility.toFixed(2)}\n`;
                 }
             }
        } else {
             html += `=== BODY POSE ===\nNot Detected\n`;
        }
        
        // --- Raw Info ---
        if (data.raw && data.raw.faceLandmarks) {
             html += `\n=== RAW FACE ===\n`;
             // MediaPipe Facemesh: 1 is nose tip
             const nose = data.raw.faceLandmarks[1]; 
             if (nose) {
                 html += `Nose Pos      : x:${nose.x.toFixed(2)} y:${nose.y.toFixed(2)} z:${nose.z.toFixed(2)}\n`;
             }
        }

        els.debugInfo.innerText = html;
    }

    function getDominantVowel(shape) {
        let max = 0;
        let vowel = '-';
        for (const [k, v] of Object.entries(shape)) {
            if (v > max) {
                max = v;
                vowel = k;
            }
        }
        return vowel;
    }

    // 窗口缩放
    window.onresize = () => {
        Live2DController.resizeModel();
    };

    // PeerJS 初始化 (恢复短 ID 逻辑)
    function initPeerJS() {
        if (!window.Peer) return;

        // 生成随机短 ID (例如: PC-1234)
        const randomId = 'PC-' + Math.floor(Math.random() * 9000 + 1000);

        const peer = new Peer(randomId, {
            debug: 1,
            config: {
                'iceServers': [
                    { url: 'stun:stun.l.google.com:19302' },
                    { url: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            const el = document.getElementById('peer-id-display');
            if (el) el.innerText = id;
            console.log('My Peer ID is: ' + id);
            showToast('远程连接码: ' + id);
        });

        peer.on('connection', (conn) => {
            console.log('收到远程连接:', conn.peer);
            showToast(`远程设备已连接`);
            updateStatus(`远程设备已连接`, 'active');

            // 关闭本地摄像头以节省资源 (可选，这里暂时不强制关闭，让用户决定)
            // if (uiState.monitorOpen) { ... }

            conn.on('data', (data) => {
                // 处理接收到的数据
                if (data && (data.face || data.pose)) {
                    try {
                        Live2DController.update(data);
                        // 仅当本地摄像头未开启时，或者想看远程数据时更新调试UI
                        // 这里我们假设远程连接时，用户希望看到远程的数据
                        updateDebugUI(data);
                    } catch (err) {
                        // 防止高频报错
                    }
                }
            });

            conn.on('close', () => {
                showToast('远程设备已断开');
                updateStatus('远程连接断开', 'normal');
            });
            
            conn.on('error', (err) => {
                 console.error('Connection error:', err);
                 showToast('远程连接错误');
            });
        });

        peer.on('error', (err) => {
            console.warn('PeerJS Error:', err);
            const el = document.getElementById('peer-id-display');
            if (el) el.innerText = "连接服务失败";
            if (err.type === 'unavailable-id') {
                 showToast('ID冲突，请刷新页面');
            }
        });
    }

    // 初始化 PeerJS (仅用于显示 ID)
    initPeerJS();
});

// ZIP 处理逻辑 (复用之前的逻辑，稍作调整)
async function handleZipUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 显示进度条
    const progressBar = document.getElementById('load-progress-bar');
    const progressContainer = document.getElementById('load-progress');
    progressContainer.style.display = 'block';
    
    const statusText = document.getElementById('status-text');
    statusText.innerText = "正在解压...";

    try {
        const zip = await JSZip.loadAsync(file);
        let modelFileEntry = null;
        let modelDir = '';

        // 寻找 model3.json
        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (relativePath.endsWith('.model3.json') || relativePath.endsWith('.model.json')) {
                modelFileEntry = entry;
                break;
            }
        }
        
        if (modelFileEntry) {
             const lastSlashIndex = modelFileEntry.name.lastIndexOf('/');
             if (lastSlashIndex !== -1) {
                 modelDir = modelFileEntry.name.substring(0, lastSlashIndex + 1);
             }
        } else {
            throw new Error('未找到模型定义文件 (.model3.json)');
        }

        // 转换 Blob URL
        const fileMap = new Map();
        const files = Object.values(zip.files).filter(f => !f.dir);
        let loadedCount = 0;

        await Promise.all(files.map(async (entry) => {
            const blob = await entry.async('blob');
            const url = URL.createObjectURL(blob);
            // 相对路径处理
            let relativePath = entry.name;
            if (modelDir && relativePath.startsWith(modelDir)) {
                relativePath = relativePath.substring(modelDir.length);
            }
            fileMap.set(relativePath, url);
            
            loadedCount++;
            progressBar.style.width = `${(loadedCount / files.length) * 100}%`;
        }));

        // Hook Live2DController loading
        // 这里需要临时覆盖 fetch 逻辑或者使用 fileMap
        // 由于 Live2DController 比较复杂，这里使用一种简单的替换策略：
        // 构造一个配置对象，其中的 url 指向 blob，且拦截资源加载
        
        // 简单起见，我们假设 Live2DController 支持 FileMap 或者我们修改它
        // 但为了不修改 Controller 太多，我们解析 json 并替换所有路径
        
        const modelJsonText = await (await fetch(fileMap.get(modelFileEntry.name.substring(modelDir.length) || "model.json"))).text();
        const modelJson = JSON.parse(modelJsonText);
        
        // 递归替换 JSON 中的路径
        const replacePaths = (obj) => {
            if (typeof obj === 'string') {
                return fileMap.get(obj) || obj;
            }
            if (Array.isArray(obj)) {
                return obj.map(replacePaths);
            }
            if (obj && typeof obj === 'object') {
                const newObj = {};
                for (const key in obj) {
                    newObj[key] = replacePaths(obj[key]);
                }
                return newObj;
            }
            return obj;
        };
        
        const patchedJson = replacePaths(modelJson);
        // Blob for patched JSON
        const patchedBlob = new Blob([JSON.stringify(patchedJson)], { type: 'application/json' });
        const patchedUrl = URL.createObjectURL(patchedBlob);

        statusText.innerText = "加载模型中...";
        await Live2DController.loadModel(patchedUrl, 'status-text');
        
        statusText.innerText = "ZIP 模型加载成功";
        progressContainer.style.display = 'none';

    } catch (err) {
        console.error(err);
        statusText.innerText = "ZIP 错误: " + err.message;
        progressContainer.style.display = 'none';
        alert('ZIP 加载失败: ' + err.message);
    }
}
