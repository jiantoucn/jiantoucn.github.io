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
                Live2DController.update(riggedFace);
            });
            statusText.innerText = "摄像头正在运行 (v1.5)";
            document.getElementById('btn-camera').disabled = true;
        } catch (err) {
            statusText.innerText = "摄像头启动失败: " + err.message;
        }
    });

    // ZIP 文件上传
    document.getElementById('file-input').addEventListener('change', handleZipUpload);

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

        // 寻找 .model3.json
        for (const [relativePath, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            if (relativePath.endsWith('.model3.json') || relativePath.endsWith('.model.json')) {
                modelFileEntry = entry;
                const lastSlashIndex = relativePath.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    modelDir = relativePath.substring(0, lastSlashIndex + 1);
                }
                break;
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
