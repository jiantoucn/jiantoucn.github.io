// js/camera-controller.js
window.CameraController = {
    holistic: null,
    camera: null,
    videoElement: null,
    canvasElement: null,
    canvasCtx: null,
    onResultsCallback: null,

    // FPS 计算
    frameCount: 0,
    lastFpsTime: 0,
    fps: 0,

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
            // 使用 Holistic 模型
            this.holistic = new Holistic({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }});

            // 配置：启用面部 refinement，禁用背景分割以提升性能
            // 降低置信度门槛以提高召回率
            this.holistic.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                refineFaceLandmarks: true,
                minDetectionConfidence: 0.3, // 降低门槛
                minTrackingConfidence: 0.3
            });

            this.holistic.onResults(this.handleResults.bind(this));

            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await this.holistic.send({image: this.videoElement});
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
        // 计算 FPS
        const now = performance.now();
        this.frameCount++;
        if (now - this.lastFpsTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        const { canvasCtx, canvasElement } = this;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        // 1. 绘制 Pose
        if (results.poseLandmarks && window.drawConnectors) {
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
            // drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 1}); // 可选：绘制点
        }

        // 2. 绘制 Face
        if (results.faceLandmarks) {
            if (window.drawConnectors) {
                // 绘制详细骨骼
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030', lineWidth: 2});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030', lineWidth: 2});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYE, {color: '#30FF30', lineWidth: 2});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30', lineWidth: 2});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 2});
                drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LIPS, {color: '#E0E0E0', lineWidth: 2});
                
                // 绘制虹膜
                if (window.FACEMESH_RIGHT_IRIS) {
                     drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_IRIS, {color: '#FF3030', lineWidth: 2});
                     drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_IRIS, {color: '#30FF30', lineWidth: 2});
                }
            }
        }

        // 3. 绘制 Hands (新增)
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
            if (results.leftHandLandmarks) {
                drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {color: '#CC0000', lineWidth: 2});
                drawLandmarks(canvasCtx, results.leftHandLandmarks, {color: '#00FF00', lineWidth: 1});
            }
            if (results.rightHandLandmarks) {
                drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {color: '#00CC00', lineWidth: 2});
                drawLandmarks(canvasCtx, results.rightHandLandmarks, {color: '#FF0000', lineWidth: 1});
            }
        }

        // 4. 使用 Kalidokit 解算
        let faceRig = null;
                let poseRig = null;
                let leftHandRig = null;
                let rightHandRig = null;

                if (window.Kalidokit) {
                    // 面部解算
                    if (results.faceLandmarks) {
                        faceRig = Kalidokit.Face.solve(results.faceLandmarks, {
                            runtime: 'mediapipe',
                            video: this.videoElement,
                            smoothBlink: true,
                            blinkSettings: [0.25, 0.75]
                        });
                    }

                    // 身体解算
                    if (results.poseLandmarks && results.poseWorldLandmarks) {
                        poseRig = Kalidokit.Pose.solve(results.poseLandmarks, results.poseWorldLandmarks, {
                            runtime: 'mediapipe',
                            video: this.videoElement,
                            enableLegs: false // 禁用腿部解算以适应半身场景
                        });
                    }
                    
                    // 手部解算 (预留)
                    // if (results.leftHandLandmarks) leftHandRig = Kalidokit.Hand.solve(results.leftHandLandmarks, "Left");
                    // if (results.rightHandLandmarks) rightHandRig = Kalidokit.Hand.solve(results.rightHandLandmarks, "Right");
                }

                if (this.onResultsCallback) {
                    this.onResultsCallback({
                        face: faceRig,
                        pose: poseRig,
                        leftHand: leftHandRig,
                        rightHand: rightHandRig,
                        // 传递原始结果用于调试
                        raw: {
                            faceLandmarks: results.faceLandmarks,
                            poseLandmarks: results.poseLandmarks
                        }
                    });
                }
        canvasCtx.restore();
    }
};
