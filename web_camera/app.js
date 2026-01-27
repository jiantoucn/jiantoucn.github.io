/**
 * 圣诞粒子交互网页 (升级版)
 * 特性：HDR Bloom 辉光, 动态粒子调节, 连续手势控制
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// --- 配置与变量 ---
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const handStateEl = document.getElementById('hand-state');
const statusInfoEl = document.getElementById('status-info');
const fpsEl = document.getElementById('fps');

let scene, camera, renderer;
let particles, particleSystem;
let composer; // 后期处理合成器
let bloomPass; // 辉光通道

// 参数配置
const params = {
    particleCount: 20000, // 默认粒子数
    bloomStrength: 1.5,
    bloomRadius: 0.4,
    bloomThreshold: 0,
    handSensitivity: 1.0 // 手势灵敏度
};

let targetPositions = []; // 目标位置（圣诞树）
let velocities = []; // 粒子速度
let handOpenness = 1.0; // 0.0 (握拳) -> 1.0 (张开)
let lastTime = 0;
let modelLoaded = false;

// --- 初始化 Three.js 与 后期处理 ---
function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Bloom 需要关闭 antialias 换取性能
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // 启用色调映射以获得更好的 HDR 效果
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // --- 后期处理 (Bloom) ---
    const renderScene = new RenderPass(scene, camera);
    
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        params.bloomStrength,
        params.bloomRadius,
        params.bloomThreshold
    );

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 初始化粒子系统
    createParticleSystem();
    
    // 初始化 GUI
    initGUI();
}

// --- 创建/重建粒子系统 ---
function createParticleSystem() {
    if (particleSystem) {
        scene.remove(particleSystem);
        particleSystem.geometry.dispose();
        particleSystem.material.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particleCount * 3);
    const colors = new Float32Array(params.particleCount * 3);
    
    velocities = [];
    targetPositions = [];

    // 生成粒子数据
    for (let i = 0; i < params.particleCount; i++) {
        // 初始位置：随机分布
        positions[i * 3] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

        // 颜色：增强亮度以配合 Bloom
        const colorType = Math.random();
        const intensity = 2.0; // 颜色强度乘数，让粒子发光
        if (colorType < 0.33) {
            colors[i * 3] = 1 * intensity; colors[i * 3 + 1] = 0.1; colors[i * 3 + 2] = 0.1; // 强红
        } else if (colorType < 0.66) {
            colors[i * 3] = 0.1; colors[i * 3 + 1] = 1 * intensity; colors[i * 3 + 2] = 0.2; // 强绿
        } else {
            colors[i * 3] = 1 * intensity; colors[i * 3 + 1] = 0.8 * intensity; colors[i * 3 + 2] = 0.1; // 强金
        }

        // 初始化速度
        velocities.push({
            x: (Math.random() - 0.5) * 0.05,
            y: (Math.random() - 0.5) * 0.05,
            z: (Math.random() - 0.5) * 0.05
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: params.particleCount > 40000 ? 0.03 : 0.06, // 粒子越多尺寸越小
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    generateTreePoints();
}

// --- 生成圣诞树目标点 ---
function generateTreePoints() {
    targetPositions = [];
    for (let i = 0; i < params.particleCount; i++) {
        if (i < params.particleCount * 0.05) {
            // 星星
            const r = Math.random() * 0.2;
            const angle = Math.random() * Math.PI * 2;
            targetPositions.push({
                x: Math.cos(angle) * r,
                y: 2.2 + (Math.random() - 0.5) * 0.2,
                z: Math.sin(angle) * r
            });
        } else if (i < params.particleCount * 0.2) {
            // 树干
            targetPositions.push({
                x: (Math.random() - 0.5) * 0.2,
                y: -2.5 + Math.random() * 0.5,
                z: (Math.random() - 0.5) * 0.2
            });
        } else {
            // 树身
            const h = Math.random() * 4 - 2;
            const radius = (2 - h) * 0.5;
            const angle = Math.random() * Math.PI * 2;
            const spiral = angle + h * 3; // 增加螺旋密度
            
            targetPositions.push({
                x: Math.cos(spiral) * radius,
                y: h,
                z: Math.sin(spiral) * radius
            });
        }
    }
}

// --- GUI 设置 ---
function initGUI() {
    const gui = new GUI({ title: '特效控制台' });
    
    // 粒子控制
    const particleFolder = gui.addFolder('粒子系统');
    particleFolder.add(params, 'particleCount', 1000, 100000, 1000)
        .name('粒子数量')
        .onFinishChange(createParticleSystem); // 只有拖拽结束才重新生成
    
    // Bloom 控制
    const bloomFolder = gui.addFolder('HDR 辉光');
    bloomFolder.add(params, 'bloomStrength', 0.0, 3.0).name('发光强度').onChange(v => bloomPass.strength = v);
    bloomFolder.add(params, 'bloomRadius', 0.0, 1.0).name('扩散半径').onChange(v => bloomPass.radius = v);
    bloomFolder.add(params, 'bloomThreshold', 0.0, 1.0).name('光照阈值').onChange(v => bloomPass.threshold = v);

    // 默认收起
    if (window.innerWidth < 600) gui.close();
}

// --- 手部追踪回调 ---
function onResults(results) {
    // FPS 计算
    const now = performance.now();
    if (lastTime > 0) {
        const fps = Math.round(1000 / (now - lastTime));
        fpsEl.innerText = fps;
    }
    lastTime = now;

    if (!modelLoaded) {
        modelLoaded = true;
        document.getElementById('loading-screen').style.display = 'none';
    }

    // 绘制摄像头画面
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusInfoEl.style.display = 'none';
        const landmarks = results.multiHandLandmarks[0];
        
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});

        // 计算手势张开度 (Continuous Openness)
        // 使用归一化距离：指尖距离 / 手掌大小
        const palmBase = landmarks[0];
        const middleFingerBase = landmarks[9]; // 中指指根
        
        // 计算手掌基准大小 (腕部到中指指根)
        const palmSize = Math.sqrt(
            Math.pow(middleFingerBase.x - palmBase.x, 2) + 
            Math.pow(middleFingerBase.y - palmBase.y, 2)
        );

        const tips = [8, 12, 16, 20];
        let totalDistance = 0;
        
        tips.forEach(index => {
            const tip = landmarks[index];
            const dist = Math.sqrt(Math.pow(tip.x - palmBase.x, 2) + Math.pow(tip.y - palmBase.y, 2));
            totalDistance += dist;
        });

        const avgDist = totalDistance / tips.length;
        
        // 归一化比率 (Ratio)
        // 握拳时，指尖距离通常小于手掌长度 (Ratio < 1.0)
        // 张开时，指尖距离通常大于手掌长度 (Ratio > 1.5)
        const ratio = avgDist / (palmSize || 0.1); // 防止除零

        // 调试显示
        // console.log(`Ratio: ${ratio.toFixed(2)} (Palm: ${palmSize.toFixed(2)})`);
        
        // 映射 Ratio 到 0.0 - 1.0
        // 经验值：握拳约 0.6-0.8，张开约 1.8-2.2
        const minRatio = 0.8;
        const maxRatio = 1.8;
        
        let targetOpenness = (ratio - minRatio) / (maxRatio - minRatio);
        targetOpenness = Math.max(0, Math.min(1, targetOpenness)); 

        // 平滑处理 (Lerp)
        handOpenness += (targetOpenness - handOpenness) * 0.2;

        // 更新 UI 状态文字
        const percent = Math.round(handOpenness * 100);
        handStateEl.innerText = `${percent < 30 ? "收起" : "张开"} (${percent}%) - R:${ratio.toFixed(1)}`;
        
        if (handOpenness < 0.3) {
            handStateEl.style.color = "#FF5252";
        } else {
            handStateEl.style.color = "#4CAF50";
        }

    } else {
        statusInfoEl.style.display = 'block';
        statusInfoEl.innerText = "未检测到手部";
        // 未检测到手时，缓慢恢复到张开状态
        handOpenness += (1.0 - handOpenness) * 0.05;
    }
    canvasCtx.restore();
}

// --- 动画循环 ---
function animate() {
    requestAnimationFrame(animate);

    const positions = particleSystem.geometry.attributes.position.array;

    // 混合因子：根据手张开度决定粒子行为
    // openness 0 (握拳) -> 圣诞树
    // openness 1 (张开) -> 自由浮动
    const treeFactor = 1.0 - handOpenness; 

    for (let i = 0; i < params.particleCount; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const target = targetPositions[i];
        
        // 圣诞树引力计算
        const treeX = target.x;
        const treeY = target.y;
        const treeZ = target.z;

        // 自由运动计算 (基于之前的速度)
        let freeX = positions[ix] + velocities[i].x;
        let freeY = positions[iy] + velocities[i].y;
        let freeZ = positions[iz] + velocities[i].z;

        // 边界反弹 (自由模式下)
        if (Math.abs(freeX) > 5) velocities[i].x *= -1;
        if (Math.abs(freeY) > 5) velocities[i].y *= -1;
        if (Math.abs(freeZ) > 5) velocities[i].z *= -1;

        // --- 核心插值逻辑 (重写) ---
        // 基于物理力的混合
        
        // 1. 引力计算：手越紧，引力越大
        // 当 handOpenness > 0.5 时，引力迅速减弱为 0
        let attraction = 0;
        if (handOpenness < 0.5) {
            attraction = (0.5 - handOpenness) * 2.0 * 0.15; // Max 0.15
        }

        // 2. 爆发斥力：当检测到快速张开（或者处于张开状态），给一个随机扰动模拟爆炸
        // 持续的轻微扰动让粒子保持活跃
        let turbulence = 0;
        if (handOpenness > 0.3) {
            turbulence = handOpenness * 0.005;
        }

        // 3. 阻尼（摩擦力）：手越紧，阻尼越大（为了停在树的位置）
        // 张开时阻尼小，粒子飞得远
        const damping = 0.92 + (handOpenness * 0.06); // 0.92 -> 0.98

        if (attraction > 0) {
            // 施加引力：拉向圣诞树目标点
            velocities[i].x += (target.x - positions[ix]) * attraction;
            velocities[i].y += (target.y - positions[iy]) * attraction;
            velocities[i].z += (target.z - positions[iz]) * attraction;
        } else {
            // 施加扰动/斥力
            velocities[i].x += (Math.random() - 0.5) * turbulence;
            velocities[i].y += (Math.random() - 0.5) * turbulence;
            velocities[i].z += (Math.random() - 0.5) * turbulence;
        }

        // 更新位置
        positions[ix] += velocities[i].x;
        positions[iy] += velocities[i].y;
        positions[iz] += velocities[i].z;

        // 应用阻尼
        velocities[i].x *= damping;
        velocities[i].y *= damping;
        velocities[i].z *= damping;

        // 自由模式下的边界检查 (柔和回弹)
        if (handOpenness > 0.5) {
            const limit = 6;
            if (positions[ix] > limit || positions[ix] < -limit) velocities[i].x *= -0.8;
            if (positions[iy] > limit || positions[iy] < -limit) velocities[i].y *= -0.8;
            if (positions[iz] > limit || positions[iz] < -limit) velocities[i].z *= -0.8;
        }
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.rotation.y += 0.002 + (1.0 - handOpenness) * 0.005; // 变成树时转得更快

    // 使用 Composer 渲染而不是 renderer
    composer.render();
}

// --- 初始化 MediaPipe ---
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480,
    facingMode: 'user'
});

// --- 启动 ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// 检查环境安全上下文
function checkEnvironment() {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        alert("安全警告: 请使用 localhost 或 HTTPS 访问。");
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = "错误: 浏览器不支持摄像头访问 (非安全上下文?)";
        document.getElementById('loading-screen').innerHTML = `<p style="color: #ff5252; padding: 20px; text-align: center;">${msg}</p>`;
        return false;
    }
    return true;
}

if (checkEnvironment()) {
    initThree();
    cameraUtils.start().catch(err => {
        console.error("Camera failed:", err);
        document.getElementById('loading-screen').innerHTML = `<p style="color: #ff5252; padding: 20px;">摄像头错误: ${err.message}</p>`;
    });
    animate();
}
