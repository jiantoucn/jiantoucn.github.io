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

    // 绘图配置
    drawConfig: {
        showFace: true,
        showPose: true,
        showHands: true
    },

    // 默认分辨率 (HD)
    currentWidth: 1280,
    currentHeight: 720,

    init: async function(videoId, canvasId, onResults) {
        this.videoElement = document.getElementById(videoId);
        this.canvasElement = document.getElementById(canvasId);
        // 优化：使用 alpha: false 提升 Canvas 性能
        this.canvasCtx = this.canvasElement.getContext('2d', { alpha: false });
        this.onResultsCallback = onResults;

        // 检测 Apple 设备
        const isApple = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        if (isApple) {
            console.log("🍎 Apple Device Detected: Optimizing for Metal/WebGL acceleration.");
        }

        // 显示元素
        this.videoElement.style.display = "block";
        this.canvasElement.style.display = "block";
        
        const container = document.getElementById('video-container');
        if(container) container.style.display = "block";

        try {
            // 使用 Holistic 模型
            this.holistic = new Holistic({locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
            }});

            // 配置
            this.holistic.setOptions({
                modelComplexity: 2,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                refineFaceLandmarks: true,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7
            });

            this.holistic.onResults(this.handleResults.bind(this));

            // 启动摄像头
            await this.startCamera();
            return true;
        } catch (err) {
            console.error(err);
            throw err;
        }
    },

    // 独立启动摄像头方法，支持重启
    startCamera: async function() {
        if (this.camera) {
            // 如果已有实例，先停止 (MediaPipe CameraUtils 没有直接的 stop 方法，但通常可以重新 new)
            // 实际上 CameraUtils 内部封装了 requestAnimationFrame，重新 new 之前最好能停止之前的循环
            // 但官方文档未提供显式 destroy，我们直接覆盖
            // 如果有 stop 方法则调用
            if (typeof this.camera.stop === 'function') {
                await this.camera.stop();
            }
        }

        console.log(`Starting camera with resolution: ${this.currentWidth}x${this.currentHeight}`);

        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.holistic.send({image: this.videoElement});
            },
            width: this.currentWidth,
            height: this.currentHeight
        });

        // 修正 CameraUtils 的宽高并同步 Canvas
        this.camera.camera_ = { ...this.camera.camera_, width: this.currentWidth, height: this.currentHeight }; 
        this.canvasElement.width = this.currentWidth;
        this.canvasElement.height = this.currentHeight;

        await this.camera.start();
    },

    // 切换分辨率接口
    setResolution: async function(width, height) {
        if (this.currentWidth === width && this.currentHeight === height) return;
        
        this.currentWidth = width;
        this.currentHeight = height;
        
        // 只有当已经初始化过 (holistic 存在) 时才重启摄像头
        if (this.holistic) {
            await this.startCamera();
        }
    },

    setDrawConfig: function(config) {
        this.drawConfig = { ...this.drawConfig, ...config };
    },

    handleResults: function(results) {
        try {
            // 计算 FPS
            const now = performance.now();
            this.frameCount++;
            if (now - this.lastFpsTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
                this.frameCount = 0;
                this.lastFpsTime = now;
            }

            const { canvasCtx, canvasElement } = this;
            if (!canvasCtx) return; // 安全检查

            canvasCtx.save();
            try {
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
                
                // 只有在开启对应选项时才进行绘制操作，节省性能
                const shouldDraw = window.drawConnectors && (this.drawConfig.showPose || this.drawConfig.showFace || this.drawConfig.showHands);
                
                if (shouldDraw) {
                    // 1. 绘制 Pose (加粗线条)
                    if (results.poseLandmarks && this.drawConfig.showPose) {
                        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
                    }

                    // 2. 绘制 Face (加粗线条)
                    if (results.faceLandmarks && this.drawConfig.showFace) {
                        // ... 这里的代码保持不变，通过逻辑跳过 ...
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1}); // 网格保持细线
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030', lineWidth: 3});
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030', lineWidth: 3});
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYE, {color: '#30FF30', lineWidth: 3});
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30', lineWidth: 3});
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 3});
                        drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LIPS, {color: '#E0E0E0', lineWidth: 3});
                        if (window.FACEMESH_RIGHT_IRIS) {
                             drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_RIGHT_IRIS, {color: '#FF3030', lineWidth: 3});
                             drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LEFT_IRIS, {color: '#30FF30', lineWidth: 3});
                        }
                    }

                    // 3. 绘制 Hands (加粗线条)
                    if (window.HAND_CONNECTIONS && this.drawConfig.showHands) {
                        if (results.leftHandLandmarks) {
                            drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {color: '#CC0000', lineWidth: 4});
                            drawLandmarks(canvasCtx, results.leftHandLandmarks, {color: '#00FF00', lineWidth: 2});
                        }
                        if (results.rightHandLandmarks) {
                            drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {color: '#00CC00', lineWidth: 4});
                            drawLandmarks(canvasCtx, results.rightHandLandmarks, {color: '#FF0000', lineWidth: 2});
                        }
                    }
                }

                // 4. 使用 Kalidokit 解算
                let faceRig = null;
                let poseRig = null;
                let leftHandRig = null;
                let rightHandRig = null;
                let leftGesture = null;
                let rightGesture = null;

                if (window.Kalidokit) {
                    // 面部解算
                    if (results.faceLandmarks) {
                        try {
                            faceRig = Kalidokit.Face.solve(results.faceLandmarks, {
                                runtime: 'mediapipe',
                                video: this.videoElement,
                                smoothBlink: true,
                                blinkSettings: [0.25, 0.75]
                            });
                        } catch(e) { console.warn("Face solve error", e); }
                    }

                    // 身体解算
                    if (results.poseLandmarks && results.poseWorldLandmarks) {
                        try {
                            poseRig = Kalidokit.Pose.solve(results.poseLandmarks, results.poseWorldLandmarks, {
                                runtime: 'mediapipe',
                                video: this.videoElement,
                                enableLegs: false
                            });
                        } catch(e) { console.warn("Pose solve error", e); }
                    }
                    
                    // 手部数字识别
                    try {
                        if (results.leftHandLandmarks) leftGesture = this.detectNumberGesture(results.leftHandLandmarks);
                        if (results.rightHandLandmarks) rightGesture = this.detectNumberGesture(results.rightHandLandmarks);
                    } catch(e) { console.warn("Gesture detect error", e); }
                }

                if (this.onResultsCallback) {
                    this.onResultsCallback({
                        face: faceRig,
                        pose: poseRig,
                        leftHand: leftHandRig,
                        rightHand: rightHandRig,
                        gesture: { left: leftGesture, right: rightGesture },
                        fps: this.fps,
                        raw: {
                            faceLandmarks: results.faceLandmarks,
                            poseLandmarks: results.poseLandmarks
                        }
                    });
                }
            } finally {
                canvasCtx.restore();
            }
        } catch (err) {
            console.error("Critical error in handleResults:", err);
        }
    },

    // 简单的手势数字识别 (0-5, 6, 8, 7, 9)
    detectNumberGesture: function(landmarks) {
        if (!landmarks || landmarks.length < 21) return null;

        try {
            // 辅助函数：计算距离平方
            const getDistSq = (p1, p2) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2;

            // 辅助函数：判断手指是否张开 (指尖距离手腕 比 指根距离手腕 远)
            const isFingerOpen = (tipIdx, pipIdx) => {
                 const wrist = landmarks[0];
                 const tip = landmarks[tipIdx];
                 const pip = landmarks[pipIdx];
                 if (!wrist || !tip || !pip) return false;
                 
                 const dTip = getDistSq(tip, wrist);
                 const dPip = getDistSq(pip, wrist);
                 return dTip > dPip;
            };
            
            // 辅助函数：拇指判断 (使用小指根部作为参考点，避免手掌旋转导致的误判)
            const isThumbOpen = () => {
                 const tip = landmarks[4];
                 const ip = landmarks[3];
                 const ref = landmarks[17]; // Pinky MCP
                 if (!tip || !ip || !ref) return false;

                 const dTip = getDistSq(tip, ref);
                 const dIp = getDistSq(ip, ref);
                 return dTip > dIp;
            };

            const thumb = isThumbOpen();
            const index = isFingerOpen(8, 6);
            const middle = isFingerOpen(12, 10);
            const ring = isFingerOpen(16, 14);
            const pinky = isFingerOpen(20, 18);

            // 关键点坐标
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];

            // ------------------------------------------------
            // 特殊手势判断 (优先级高于计数)
            // ------------------------------------------------

            // 7: 捏合 (拇指 + 食指 + 中指 聚拢)
            // 中国手势 7: 拇指、食指、中指指尖捏在一起
            if (!ring && !pinky) {
                const dThumbIndex = getDistSq(thumbTip, indexTip);
                const dThumbMiddle = getDistSq(thumbTip, middleTip);
                const pinchThreshold = 0.005; // 阈值需调试 (0.07^2 ≈ 0.005)

                if (dThumbIndex < pinchThreshold && dThumbMiddle < pinchThreshold) {
                    return 7;
                }
            }

            // 9: 勾指 (食指弯曲，其他关闭)
            // 中国手势 9: 食指成钩状
            if (!middle && !ring && !pinky && !thumb) {
                // 判断食指是否弯曲 (Hook)
                // 计算向量夹角: PIP->MCP (6->5) 和 PIP->TIP (6->8)
                const p5 = landmarks[5]; // Index MCP
                const p6 = landmarks[6]; // Index PIP
                const p8 = landmarks[8]; // Index Tip

                const v1 = {x: p5.x - p6.x, y: p5.y - p6.y};
                const v2 = {x: p8.x - p6.x, y: p8.y - p6.y};
                
                const mag1 = Math.sqrt(v1.x**2 + v1.y**2);
                const mag2 = Math.sqrt(v2.x**2 + v2.y**2);

                if (mag1 * mag2 > 0) {
                    const dot = v1.x * v2.x + v1.y * v2.y;
                    const cosTheta = dot / (mag1 * mag2);
                    
                    // cosTheta: -1(直) -> 0(90度) -> 1(折叠)
                    // 弯曲判断: 大于 -0.85 (约150度) 且 小于 0.5 (避免完全折叠成拳头)
                    // 同时食指不能完全缩回去 (index 可能是 true 或 false，取决于弯曲程度)
                    if (cosTheta > -0.85 && cosTheta < 0.5) {
                        return 9;
                    }
                }
            }

            // 6: 拇指+小指 (其他关闭)
            if (thumb && pinky && !index && !middle && !ring) return 6;
            
            // 8: 拇指+食指 (其他关闭) - 中国手势 8
            if (thumb && index && !middle && !ring && !pinky) return 8;

            // ------------------------------------------------
            // 默认: 计数 (0-5)
            // ------------------------------------------------
            let count = 0;
            if (thumb) count++;
            if (index) count++;
            if (middle) count++;
            if (ring) count++;
            if (pinky) count++;
            
            return count;
        } catch (e) {
            console.warn("Gesture detection error:", e);
            return null;
        }
    },

    stop: function() {
        if (this.camera) this.camera.stop();
        if (this.holistic) this.holistic.close();
    }
};
