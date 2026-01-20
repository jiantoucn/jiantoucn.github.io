// js/camera-controller.js
window.CameraController = {
    faceMesh: null,
    camera: null,
    videoElement: null,
    canvasElement: null,
    canvasCtx: null,
    onResultsCallback: null,

    init: async function(videoId, canvasId, onResults) {
        this.videoElement = document.getElementById(videoId);
        this.canvasElement = document.getElementById(canvasId);
        this.canvasCtx = this.canvasElement.getContext('2d');
        this.onResultsCallback = onResults;

        // 显示元素
        this.videoElement.style.display = "block";
        this.canvasElement.style.display = "block";
        
        // 显示容器 (假设有一个容器)
        const container = document.getElementById('video-container');
        if(container) container.style.display = "block";

        try {
            this.faceMesh = new FaceMesh({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }});

            // 优化配置：关闭 refineLandmarks 以提高速度
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: false, // 牺牲一点瞳孔精度换取速度
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.faceMesh.onResults(this.handleResults.bind(this));

            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await this.faceMesh.send({image: this.videoElement});
                },
                width: 640,
                height: 480
            });

            // 修正 CameraUtils 的宽高
            this.camera.camera_ = { ...this.camera.camera_, width: 640, height: 480 }; 
            this.canvasElement.width = 640;
            this.canvasElement.height = 480;

            await this.camera.start();
            return true;
        } catch (err) {
            console.error(err);
            throw err;
        }
    },

    handleResults: function(results) {
        const { canvasCtx, canvasElement } = this;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // 绘制面部网格
            if (window.drawConnectors) {
                // 减少绘制内容以提高性能，只画轮廓和五官
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030', lineWidth: 1});
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#30FF30', lineWidth: 1});
                drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 1});
                drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#E0E0E0', lineWidth: 1});
            }

            // 使用 Kalidokit 解算
            if (window.Kalidokit) {
                const riggedFace = Kalidokit.Face.solve(landmarks, {
                    runtime: 'mediapipe',
                    video: this.videoElement,
                    smoothBlink: true, // 保持眨眼平滑
                    blinkSettings: [0.25, 0.75] // 调整眨眼阈值
                });

                if (riggedFace && this.onResultsCallback) {
                    this.onResultsCallback(riggedFace);
                }
            }
        }
        canvasCtx.restore();
    }
};
