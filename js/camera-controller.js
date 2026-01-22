// js/camera-controller.js - v2.0.12
// 确保全局变量存在，防止重复定义或丢失
if (typeof window.CameraController === 'undefined') {
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
        currentComplexity: 1, // 默认降回 Full (1) 以平衡性能
        currentFpsLimit: 0,   // 0 表示不限制
        lastFrameTime: 0,

        // 默认开启精细面部追踪
        refineFace: true,     // 默认开启

        init: async function(videoId, canvasId, onResults) {
            console.log("[CameraController] Initializing...");
            this.videoElement = document.getElementById(videoId);
            this.canvasElement = document.getElementById(canvasId);
            
            if (!this.videoElement || !this.canvasElement) {
                console.error("[CameraController] Critical Error: Video or Canvas element not found!");
                return false;
            }

            // 开启透明背景，只绘制骨骼，底层的 video 元素负责显示画面
            try {
                this.canvasCtx = this.canvasElement.getContext('2d', { alpha: true });
            } catch (e) {
                console.warn("[CameraController] Failed to get 2d context with alpha, trying default", e);
                this.canvasCtx = this.canvasElement.getContext('2d');
            }
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
                // 检查依赖库是否加载
                if (typeof Holistic === 'undefined' || typeof Camera === 'undefined') {
                    throw new Error("MediaPipe libraries not loaded! Check network connection.");
                }

                // 使用 Holistic 模型
                this.holistic = new Holistic({locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
                }});

                // 配置
                this.updateHolisticOptions();

                this.holistic.onResults(this.handleResults.bind(this));

                // 启动摄像头
                await this.startCamera();
                return true;
            } catch (err) {
                console.error("[CameraController] Init Failed:", err);
                throw err;
            }
        },

        updateHolisticOptions: function() {
            if (!this.holistic) return;
            this.holistic.setOptions({
                modelComplexity: this.currentComplexity,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                refineFaceLandmarks: this.refineFace,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7
            });
        },

        // 停止摄像头
        stop: async function() {
            console.log("[CameraController] Stopping camera...");
            
            // 1. 停止 CameraUtils 实例
            if (this.camera) {
                if (typeof this.camera.stop === 'function') {
                    await this.camera.stop();
                }
                this.camera = null;
            }

            // 2. 停止 MediaPipe Holistic 实例
            if (this.holistic) {
                try {
                    this.holistic.close();
                } catch(e) {
                    console.warn("Error closing holistic:", e);
                }
                this.holistic = null;
            }

            // 3. 停止视频流轨道 (彻底释放硬件占用)
            if (this.videoElement && this.videoElement.srcObject) {
                const stream = this.videoElement.srcObject;
                const tracks = stream.getTracks();
                tracks.forEach(track => {
                    track.stop();
                    console.log(`[CameraController] Track stopped: ${track.kind}`);
                });
                this.videoElement.srcObject = null;
            }

            // 4. 清空画布
            if (this.canvasCtx && this.canvasElement) {
                this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
            }

            // 5. 隐藏元素
            if (this.videoElement) this.videoElement.style.display = "none";
            if (this.canvasElement) this.canvasElement.style.display = "none";
            const container = document.getElementById('video-container');
            if (container) container.style.display = "none";

            console.log("[CameraController] Camera stopped successfully.");
            return true;
        },
        // 独立启动摄像头方法，支持重启
        startCamera: async function() {
            if (this.camera) {
                // 如果已有实例，先停止
                if (typeof this.camera.stop === 'function') {
                    await this.camera.stop();
                }
            }

            console.log(`[CameraController] Starting camera: ${this.currentWidth}x${this.currentHeight}, complexity: ${this.currentComplexity}`);

            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    // FPS 限制逻辑
                    if (this.currentFpsLimit > 0) {
                        const now = performance.now();
                        const interval = 1000 / this.currentFpsLimit;
                        if (now - this.lastFrameTime < interval) {
                            return; // 跳过当前帧
                        }
                        this.lastFrameTime = now - ((now - this.lastFrameTime) % interval);
                    }
                    
                    if (this.holistic) {
                        await this.holistic.send({image: this.videoElement});
                    }
                },
                width: this.currentWidth,
                height: this.currentHeight
            });

            // 修正 CameraUtils 的宽高并同步 Canvas
            // 注意: camera_ 属性是内部属性，可能随版本变化，但目前可用
            if (this.camera.camera_) {
                this.camera.camera_ = { ...this.camera.camera_, width: this.currentWidth, height: this.currentHeight };
            }
            this.canvasElement.width = this.currentWidth;
            this.canvasElement.height = this.currentHeight;

            return this.camera.start();
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

        // 切换模型精度接口
        setModelComplexity: async function(complexity) {
            if (this.currentComplexity === complexity) return;
            this.currentComplexity = complexity;
            
            if (this.holistic) {
                this.updateHolisticOptions();
                // 更改模型复杂度可能需要重置一些状态，最好重启一下流
                // 但通常 setOptions 足够。为了保险起见，这里不重启摄像头，只更新 options
                console.log(`Model complexity updated to: ${complexity}`);
            }
        },

        // 设置 FPS 限制
        setFpsLimit: function(fps) {
            this.currentFpsLimit = fps;
            console.log(`FPS Limit set to: ${fps === 0 ? 'Unlimited' : fps}`);
        },

        // 设置是否精细面部
        setRefineFace: function(enabled) {
            if (this.refineFace === enabled) return;
            this.refineFace = enabled;
            if (this.holistic) {
                this.updateHolisticOptions();
                console.log(`Refine Face set to: ${enabled}`);
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
                    const fpsEl = document.getElementById('fps-display');
                    if (fpsEl) fpsEl.innerText = this.fps;
                }

                const { canvasCtx, canvasElement } = this;
                if (!canvasCtx) return; // 安全检查

                canvasCtx.save();
                try {
                    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                    // canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height); // 不再重绘视频，节省性能
                    
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
                if (this.canvasCtx) { try { this.canvasCtx.restore(); } catch(e) {} }
            }
        },

        // 简单的手势数字识别 (0-5, 6, 8, 7, 9)
        detectNumberGesture: function(landmarks) {
            if (!landmarks || landmarks.length < 21) return null;

            try {
                // 辅助函数：计算距离平方
                const getDistSq = (p1, p2) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
                const getDist = (p1, p2) => Math.sqrt(getDistSq(p1, p2));

                // 关键点
                const wrist = landmarks[0];
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                const middleTip = landmarks[12];
                const ringTip = landmarks[16];
                const pinkyTip = landmarks[20];
                
                const indexMCP = landmarks[5];
                
                // 计算手掌大小基准 (手腕到食指指根的距离)
                const handSize = getDist(wrist, indexMCP);
                
                // 动态阈值
                const FINGER_OPEN_THRESHOLD = handSize * 1.6; // 指尖到手腕距离 > 1.6倍手掌基准 (展开)
                const THUMB_OPEN_THRESHOLD = handSize * 0.8;  // 拇指尖到小指指根距离 (展开)
                
                // 辅助函数：判断手指是否张开
                // 优化：结合 指尖-手腕距离 和 指尖-指根距离
                const isFingerOpen = (tipIdx, mcpIdx) => {
                     const tip = landmarks[tipIdx];
                     const mcp = landmarks[mcpIdx];
                     
                     // 1. 指尖距离手腕 必须足够远
                     const dTipWrist = getDist(tip, wrist);
                     const dMcpWrist = getDist(mcp, wrist); // 其实就是 handSize 附近
                     
                     // 2. 指尖距离指根 必须足够远 (避免握拳时指尖虽然远但弯曲)
                     const dTipMcp = getDist(tip, mcp);

                     // 简单的判断标准：指尖到手腕距离 > 指根到手腕距离 * 1.2
                     // 且 指尖到指根距离 > 手掌基准 * 0.8 (确保手指伸直)
                     return dTipWrist > dMcpWrist * 1.2 && dTipMcp > handSize * 0.8;
                };
                
                // 辅助函数：拇指判断
                // 优化：检查拇指尖是否远离食指掌骨 (Keypoint 5) 且远离小指掌骨 (Keypoint 17)
                const isThumbOpen = () => {
                     const tip = landmarks[4];
                     const pinkyMCP = landmarks[17];
                     const indexMCP = landmarks[5];
                     
                     const dTipPinky = getDist(tip, pinkyMCP);
                     const dTipIndex = getDist(tip, indexMCP);
                     
                     // 拇指张开时，通常远离小指根部，也远离食指根部
                     return dTipPinky > handSize * 0.9 && dTipIndex > handSize * 0.5;
                };

                const thumb = isThumbOpen();
                const index = isFingerOpen(8, 5);
                const middle = isFingerOpen(12, 9);
                const ring = isFingerOpen(16, 13);
                const pinky = isFingerOpen(20, 17);

                // ------------------------------------------------
                // 特殊手势判断 (优先级高于计数)
                // ------------------------------------------------

                // 7: 捏合 (拇指 + 食指 + 中指 聚拢)
                // 优化：使用动态阈值，不强制要求无名指/小指完全关闭，只要它们不干扰
                // 但为了准确，还是要求 ring/pinky 关闭
                if (!ring && !pinky) {
                    const dThumbIndex = getDist(thumbTip, indexTip);
                    const dThumbMiddle = getDist(thumbTip, middleTip);
                    
                    // 阈值：指尖距离小于手掌大小的 35%
                    const pinchThreshold = handSize * 0.35;

                    // 拇指接触食指和中指
                    if (dThumbIndex < pinchThreshold && dThumbMiddle < pinchThreshold) {
                        return 7;
                    }
                    
                    // 变种 7: 仅拇指和食指捏合，且中指是直的？(不太常见)
                    // 常见 7: 拇指+食指+中指 撮在一起
                }

                // 9: 勾指 (食指弯曲成钩，其他关闭)
                // 优化：不依赖角度，依赖几何形态
                if (!thumb && !middle && !ring && !pinky) {
                    // 食指必须是“半开半闭”
                    // 1. 指尖距离手腕 比 握拳时 远
                    // 2. 指尖距离手腕 比 伸直时 近
                    
                    const dIndexTipWrist = getDist(indexTip, wrist);
                    const dIndexMcpWrist = getDist(indexMCP, wrist); // ~ handSize
                    
                    // 弯曲判断：指尖到手腕距离 在 (1.0 ~ 1.5) 倍手掌基准之间
                    // 伸直通常 > 1.6，握拳通常 < 1.0
                    if (dIndexTipWrist > dIndexMcpWrist * 1.0 && dIndexTipWrist < dIndexMcpWrist * 1.6) {
                        // 再次确认是弯曲：指尖到指根的距离 < 伸直时的距离 (约 0.9 * handSize)
                        const dTipMcp = getDist(indexTip, indexMCP);
                        if (dTipMcp < handSize * 0.8) {
                            return 9;
                        }
                    }
                }

                // 6: 拇指+小指 (其他关闭)
                if (thumb && pinky && !index && !middle && !ring) return 6;
                
                // 8: 拇指+食指 (其他关闭)
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
                
                // 0 的优化：如果 count 计算为 0，再次确认手指是否真的蜷缩
                // 上面的 isFingerOpen 已经比较严格，所以这里通常没问题
                // 但为了防止误判，可以增加一个 "Fist Check"
                if (count === 0) {
                    // 确保指尖都靠近手掌中心或指根
                    // 这里直接返回 0 即可，因为 isFingerOpen 已经过滤了
                    return 0;
                }
                
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
    console.log("[CameraController] Script Loaded Successfully");
} else {
    console.warn("[CameraController] Script already loaded, skipping definition.");
}