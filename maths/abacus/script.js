document.addEventListener('DOMContentLoaded', () => {
    const COLUMN_COUNT = 13;
    const UPPER_BEAD_COUNT = 2;
    const LOWER_BEAD_COUNT = 5;
    
    // UI Elements
    const abacusContainer = document.getElementById('abacus');
    const displayElement = document.getElementById('number-display');
    const calcInput = document.getElementById('calc-input');
    const btnCalc = document.getElementById('btn-calc');
    const btnReset = document.getElementById('btn-reset');

    // State
    // columns[i] 存储第 i 列的状态。
    // 为了简单，我们直接存储每一颗珠子的状态。
    // 但为了更方便计算数值，我们存储该列代表的数值，然后渲染时反推珠子位置。
    // 不过，为了支持“交互”，我们需要知道每一颗珠子的位置。
    // 让我们维护一个 state 对象：
    // state[colIndex] = { upper: [bool, bool], lower: [bool, bool, bool, bool, bool] }
    // bool = true 表示靠梁（Active/计数），false 表示离梁（Inactive/不计数）。
    let abacusState = [];

    // 初始化算盘
    function initAbacus() {
        abacusContainer.innerHTML = '<div class="beam"></div>'; // 重置 HTML，保留横梁
        abacusState = [];

        for (let i = 0; i < COLUMN_COUNT; i++) {
            // 初始化状态：所有珠子离梁
            abacusState.push({
                upper: Array(UPPER_BEAD_COUNT).fill(false),
                lower: Array(LOWER_BEAD_COUNT).fill(false)
            });

            // 创建 DOM
            const col = document.createElement('div');
            col.className = 'column';
            col.dataset.colIndex = i;

            // 档杆
            const rod = document.createElement('div');
            rod.className = 'rod';
            col.appendChild(rod);

            // 上珠区域
            const upperDeck = document.createElement('div');
            upperDeck.className = 'upper-deck';
            for (let b = 0; b < UPPER_BEAD_COUNT; b++) {
                const bead = createBead('upper', i, b);
                upperDeck.appendChild(bead);
            }
            col.appendChild(upperDeck);

            // 下珠区域
            const lowerDeck = document.createElement('div');
            lowerDeck.className = 'lower-deck';
            for (let b = 0; b < LOWER_BEAD_COUNT; b++) {
                const bead = createBead('lower', i, b);
                lowerDeck.appendChild(bead);
            }
            col.appendChild(lowerDeck);
            
            // 底部数字标签
            const digitLabel = document.createElement('div');
            digitLabel.className = 'digit-label';
            digitLabel.textContent = '0';
            col.appendChild(digitLabel);

            abacusContainer.appendChild(col);
        }
        
        updateDisplay();
        renderBeads();
    }

    function createBead(type, colIndex, beadIndex) {
        const bead = document.createElement('div');
        bead.className = 'bead';
        bead.dataset.type = type;
        bead.dataset.col = colIndex;
        bead.dataset.idx = beadIndex;
        
        // 点击事件
        bead.addEventListener('click', () => {
            toggleBead(colIndex, type, beadIndex);
        });
        
        return bead;
    }

    // 核心逻辑：拨珠
    function toggleBead(colIndex, type, beadIndex) {
        const colState = abacusState[colIndex];
        
        if (type === 'upper') {
            // 上珠逻辑 (上二下五)：
            // 上珠 index 0 (上), 1 (下/靠近梁)
            // 只有靠近梁才算数。
            // 点击某个珠子，改变它的状态。
            // 联动：
            // 如果点击 index 0 (最上)，且它目前是 Active (向下靠梁)，那它变成 Inactive (向上)。
            // 如果它目前 Inactive，变 Active。
            // 但是，珠子不能穿过别的珠子。
            // 简单逻辑：
            // index 1 (靠梁那个) 如果 Active，index 0 也可以 Active。
            // 如果 index 1 Inactive，index 0 必须 Inactive。
            // 反过来：如果 index 0 Active，index 1 必须 Active。
            
            // 让我们简化逻辑，模拟物理推拉：
            // 状态定义：Active = 靠梁。
            // Upper Deck: 梁在下面。Active 意味着向下。Inactive 意味着向上。
            // Bead 0 is Top, Bead 1 is Bottom (near beam).
            // Current State:
            // [False, False] -> 都在上面
            // [False, True] -> 0在上，1在下(靠梁)
            // [True, True] -> 都在下(靠梁)
            // 不可能出现 [True, False] (0在下，1在上，重叠了)
            
            const currentState = colState.upper[beadIndex];
            const newState = !currentState;
            
            // 检查物理约束并联动
            if (beadIndex === 1) { // 靠近梁的那颗
                if (newState) { // 要向下(靠梁)
                    colState.upper[1] = true; 
                    // 0 号不用动，它可以在上面
                } else { // 要向上(离梁)
                    colState.upper[1] = false;
                    colState.upper[0] = false; // 0 号必须跟着上去
                }
            } else if (beadIndex === 0) { // 远离梁的那颗
                if (newState) { // 要向下
                    colState.upper[0] = true;
                    colState.upper[1] = true; // 1 号必须已经在下面，或者跟着下去
                } else { // 要向上
                    colState.upper[0] = false;
                    // 1 号不用动
                }
            }
        } else {
            // 下珠逻辑：
            // 梁在上面。Active 意味着向上(靠梁)。Inactive 意味着向下。
            // Bead 0 (Top/near beam) ... Bead 4 (Bottom)
            // 联动：推 2 号向上，0,1 必须向上。
            // 拉 2 号向下，3,4 必须向下。
            
            const currentState = colState.lower[beadIndex];
            const newState = !currentState; // true=Up(Active), false=Down(Inactive)
            
            if (newState) { // 向上拨 (Add value)
                // 本珠及所有上面的珠子都要上去
                for (let i = 0; i <= beadIndex; i++) {
                    colState.lower[i] = true;
                }
            } else { // 向下拨 (Remove value)
                // 本珠及所有下面的珠子都要下去
                for (let i = beadIndex; i < LOWER_BEAD_COUNT; i++) {
                    colState.lower[i] = false;
                }
            }
        }
        
        renderBeads();
        updateDisplay();
    }

    // 渲染珠子位置
    function renderBeads() {
        abacusState.forEach((colState, colIndex) => {
            const colDiv = abacusContainer.children[colIndex + 1]; // +1 because of .beam
            const upperBeads = colDiv.querySelector('.upper-deck').children;
            const lowerBeads = colDiv.querySelector('.lower-deck').children;
            
            // Render Upper
            // 视觉位置：
            // Height 90px. Bead height 26px.
            // Inactive (Up): Top 5px, 35px.
            // Active (Down): Top 30px, 60px. (Close to beam at 90)
            // Beam start at 90.
            // Let's use CSS classes logic.
            // style.css defines: .active { top: 55px } for single bead?
            // We need dynamic positioning for multiple beads to avoid overlap.
            
            // Upper Deck Positioning Strategy:
            // Bead 0 (Top), Bead 1 (Bottom)
            // State: False(Up), True(Down)
            // If [F, F]: 0 at 5px, 1 at 35px.
            // If [F, T]: 0 at 5px, 1 at 58px (near beam).
            // If [T, T]: 0 at 28px, 1 at 58px.
            
            const u0 = colState.upper[0];
            const u1 = colState.upper[1];
            
            // Set styles directly for smooth transition
            upperBeads[0].style.top = u0 ? '32px' : '5px';
            upperBeads[1].style.top = u1 ? '60px' : '33px';
            
            // Render Lower
            // Lower Deck Height ~200px.
            // Bead 0 (Top) ... Bead 4 (Bottom)
            // State: True(Up/Active), False(Down/Inactive)
            // Base positions (Down state): 
            // Space available: 200px. 5 beads * 26px = 130px.
            // Gap needed.
            // Let's say inactive stack starts at bottom.
            // Active stack starts at top (0px).
            
            // Strategy:
            // Iterate all 5 beads.
            // If bead is Active (Up), stack it from top.
            // If bead is Inactive (Down), stack it from bottom.
            // Or simpler: Just calculate top position for each bead based on its state.
            
            // Gap calculation:
            // Top (Beam) at 0 (relative to lower-deck).
            // Active position offset: 5px from Beam.
            // Inactive position offset: say 50px gap from Active group?
            
            let activeCount = 0;
            for(let b=0; b<LOWER_BEAD_COUNT; b++) {
                if (colState.lower[b]) activeCount++;
            }
            
            // Positions:
            // Bead 0 is top-most.
            // If Bead i is Active: pos = 5 + i * 28
            // If Bead i is Inactive: pos = 5 + i * 28 + GAP
            const GAP = 50; 
            
            for(let b=0; b<LOWER_BEAD_COUNT; b++) {
                let topPos = 5 + b * 28;
                if (!colState.lower[b]) {
                    topPos += GAP;
                }
                lowerBeads[b].style.top = `${topPos}px`;
            }
        });
    }

    // 计算数值
    function calculateValue() {
        let total = 0;
        let place = 1; // 1, 10, 100...
        
        // 从右向左计算
        for (let i = COLUMN_COUNT - 1; i >= 0; i--) {
            const col = abacusState[i];
            let colVal = 0;
            
            // 上珠：每颗代表 5
            if (col.upper[1]) colVal += 5;
            if (col.upper[0]) colVal += 5;
            
            // 下珠：每颗代表 1
            col.lower.forEach(isActive => {
                if (isActive) colVal += 1;
            });
            
            // 更新每列底部的数字显示
            // abacusContainer.children[i+1] 是对应的 .column (因为第0个是 .beam)
            const colDiv = abacusContainer.children[i + 1];
            if (colDiv) {
                const digitLabel = colDiv.querySelector('.digit-label');
                if (digitLabel) {
                    digitLabel.textContent = colVal;
                }
            }
            
            total += colVal * place;
            place *= 10;
        }
        return total;
    }

    function updateDisplay() {
        const val = calculateValue();
        // Format with commas
        displayElement.textContent = val.toLocaleString();
    }

    // 设置特定数值（用于动画演示）
    function setValue(number) {
        // Clear all first? Or smart diff?
        // Simple approach: Clear and Set.
        // But for animation, we might want smart diff later.
        // For now, let's implement a 'setColumnValue' helper.
        
        let strNum = Math.floor(number).toString();
        if (strNum.length > COLUMN_COUNT) {
            alert("数值超出算盘显示范围");
            return;
        }
        
        // Pad with zeros
        while (strNum.length < COLUMN_COUNT) {
            strNum = "0" + strNum;
        }
        
        for (let i = 0; i < COLUMN_COUNT; i++) {
            const digit = parseInt(strNum[i]);
            setColumnValue(i, digit);
        }
        renderBeads();
        updateDisplay();
    }
    
    function setColumnValue(colIndex, digit) {
        // Standard representation of digit (0-9)
        // 0: Upper=[], Lower=[]
        // 1: Upper=[], Lower=[0]
        // 5: Upper=[1], Lower=[]
        // 6: Upper=[1], Lower=[0]
        // ...
        // digit = 5 * upper_count + lower_count
        
        const col = abacusState[colIndex];
        
        // Reset
        col.upper = [false, false];
        col.lower = [false, false, false, false, false];
        
        if (digit === 0) return;
        
        let remainder = digit;
        
        // Upper
        if (remainder >= 5) {
            col.upper[1] = true; // Bottom upper bead down
            remainder -= 5;
        }
        // Note: We don't use the top upper bead for standard 0-9 digits
        
        // Lower
        for (let b = 0; b < remainder; b++) {
            col.lower[b] = true;
        }
    }

    // 动画演示逻辑
    async function animateCalculation(expression) {
        if (!expression) return;
        
        // 禁用按钮防止重入
        btnCalc.disabled = true;
        calcInput.disabled = true;
        
        try {
            // 1. 预计算最终结果以检查有效性
            const finalCheck = new Function('return ' + expression)();
            if (isNaN(finalCheck) || !isFinite(finalCheck) || finalCheck < 0) {
                alert("结果无效或是负数，算盘无法显示");
                btnCalc.disabled = false;
                calcInput.disabled = false;
                return;
            }

            // 2. 拆解步骤：按加减号分割，但保留乘除块
            // 例如 "13+5*2-4" -> ["13", "+", "5*2", "-", "4"]
            // 能够处理 "-5+3" -> ["", "-", "5", "+", "3"]
            const parts = expression.split(/([+\-])/);
            
            // 过滤空字符串（处理开头负号或多余空格）
            // 但如果开头是负号，split 结果第一个是 ""，第二个是 "-"。
            // 我们需要构建操作序列。
            
            let currentVal = 0;
            let steps = [];
            
            // 解析 token 流
            let i = 0;
            // 处理可能的初始负号
            if (parts[i].trim() === '') {
                // 可能是 "-5..."
                if (parts[i+1] === '-') {
                    // 下一个是数字
                    let val = evalSafe(parts[i+2]);
                    currentVal = -val;
                    i += 3;
                } else if (parts[i+1] === '+') {
                    // "+5..." 其实就是 5
                    let val = evalSafe(parts[i+2]);
                    currentVal = val;
                    i += 3;
                } else {
                    // 就是空的开头
                    i++;
                }
            } else {
                // 开头就是数字
                currentVal = evalSafe(parts[i]);
                i++;
            }
            
            steps.push(currentVal);
            
            while (i < parts.length) {
                const operator = parts[i];
                const nextPart = parts[i+1];
                
                if (!operator || nextPart === undefined) break;
                
                const nextVal = evalSafe(nextPart);
                
                if (operator === '+') {
                    currentVal += nextVal;
                } else if (operator === '-') {
                    currentVal -= nextVal;
                }
                
                steps.push(currentVal);
                i += 2;
            }
            
            // 3. 执行动画
            // 重置
            setValue(0);
            await wait(600);
            
            for (let stepVal of steps) {
                if (stepVal < 0) {
                    console.warn("中间结果为负数，跳过显示: " + stepVal);
                    continue; 
                }
                setValue(stepVal);
                await wait(1200); // 留足时间观察
            }
            
        } catch (e) {
            console.error(e);
            alert("算式解析错误");
        } finally {
            btnCalc.disabled = false;
            calcInput.disabled = false;
        }
    }
    
    function evalSafe(expr) {
        // 计算 "5*2" 或 "10/2" 等乘除优先块
        return new Function('return ' + expr)();
    }
    
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Event Listeners
    btnReset.addEventListener('click', () => {
        initAbacus();
    });

    btnCalc.addEventListener('click', () => {
        const expr = calcInput.value;
        if (!expr) return;
        animateCalculation(expr);
    });
    
    // Init
    initAbacus();
});
