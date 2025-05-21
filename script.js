document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const promptText = document.getElementById('promptText');
    const speedControl = document.getElementById('speedControl');
    const speedValue = document.getElementById('speedValue');
    const fontSizeControl = document.getElementById('fontSizeControl');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const widthControl = document.getElementById('widthControl');
    const widthValue = document.getElementById('widthValue');
    const horizontalPosControl = document.getElementById('horizontalPosControl');
    const horizontalPosValue = document.getElementById('horizontalPosValue');
    const heightControl = document.getElementById('heightControl');
    const heightValue = document.getElementById('heightValue');
    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const resetButton = document.getElementById('resetButton');
    const fullscreenButton = document.getElementById('fullscreenButton');
    const teleprompterText = document.getElementById('teleprompterText');
    const teleprompterContainer = document.getElementById('teleprompterContainer');
    const fullscreenControls = document.getElementById('fullscreenControls');
    const fsStartButton = document.getElementById('fsStartButton');
    const fsExitButton = document.getElementById('fsExitButton');
    const fsPauseButton = document.getElementById('fsPauseButton');
    const fsResetButton = document.getElementById('fsResetButton');
    const fsSpeedControl = document.getElementById('fsSpeedControl');
    const fsFontSizeControl = document.getElementById('fsFontSizeControl');
    const fsFontSizeValue = document.getElementById('fsFontSizeValue');
    const fsSpeedValue = document.getElementById('fsSpeedValue'); // 获取全屏速度显示元素
    
    // 提词器状态
    let isRunning = false;
    let animationId = null;
    let scrollSpeed = parseFloat(speedControl.value);
    let currentScrollTop = 0;
    let textContent = "";
    let pauseMarkers = [];
    let displayWidth = 80;
    let horizontalOffset = 0;
    let isFullscreen = false;
    let lastTimestamp = 0;
    let totalDistance = 0;
    let userPaused = false;
    let activePauseTimeout = null;
    let pauseElements = []; // 存储暂停标记元素引用
    let fontSize = parseInt(fontSizeControl.value);
    let currentPauseIndex = -1; // 跟踪当前处理的暂停点
    let debugMode = false; // 调试模式开关
    
    // 更新速度显示 - 修改为1位小数的精度
    speedControl.addEventListener('input', function() {
        scrollSpeed = parseFloat(this.value);
        speedValue.textContent = scrollSpeed.toFixed(1); // 显示1位小数
        fsSpeedControl.value = this.value;
        fsSpeedValue.textContent = scrollSpeed.toFixed(1); // 同步全屏模式显示
        
        if (isRunning) {
            // 在运行时调整，立即应用新速度
            lastTimestamp = performance.now(); // 重置时间戳避免跳跃
        }
    });
    
    // 全屏模式下的速度控制 - 同样修改为1位小数精度
    fsSpeedControl.addEventListener('input', function() {
        scrollSpeed = parseFloat(this.value);
        speedControl.value = this.value;
        speedValue.textContent = scrollSpeed.toFixed(1);
        fsSpeedValue.textContent = scrollSpeed.toFixed(1);
        
        if (isRunning) {
            // 在运行时调整，立即应用新速度
            lastTimestamp = performance.now(); // 重置时间戳避免跳跃
        }
    });
    
    // 更新字体大小显示
    fontSizeControl.addEventListener('input', function() {
        // 记录当前滚动位置与文本高度的比例
        const oldTextHeight = teleprompterText.offsetHeight;
        const scrollRatio = oldTextHeight > 0 ? currentScrollTop / oldTextHeight : 0;
        
        // 更新字体大小
        fontSize = parseInt(this.value);
        updateFontSize(fontSize);
        
        // 如果正在运行，调整滚动位置保持相对位置不变
        if (isRunning && oldTextHeight > 0) {
            // 获取新文本高度
            const newTextHeight = teleprompterText.offsetHeight;
            
            // 计算新的滚动位置
            currentScrollTop = scrollRatio * newTextHeight;
            totalDistance = currentScrollTop;
            
            // 应用新位置
            teleprompterText.style.top = `-${Math.round(currentScrollTop)}px`;
            
            // 重新计算暂停标记的位置
            recalculatePausePositions();
        }
    });
    
    // 全屏模式下的字体大小控制
    fsFontSizeControl.addEventListener('input', function() {
        fontSizeControl.value = this.value;
        fontSizeControl.dispatchEvent(new Event('input'));
    });
    
    // 统一字体大小更新函数
    function updateFontSize(size) {
        teleprompterText.style.fontSize = size + 'px';
        fontSizeControl.value = size;
        fsFontSizeControl.value = size;
        fontSizeValue.textContent = size + 'px';
        fsFontSizeValue.textContent = size + 'px';
    }
    
    // 更新显示区域宽度
    widthControl.addEventListener('input', function() {
        // 记录当前滚动位置与文本高度的比例
        const oldTextHeight = teleprompterText.offsetHeight;
        const scrollRatio = oldTextHeight > 0 ? currentScrollTop / oldTextHeight : 0;
        
        // 更新宽度
        displayWidth = parseInt(this.value);
        teleprompterText.style.width = displayWidth + '%';
        widthValue.textContent = displayWidth + '%';
        updateHorizontalPosition();
        
        // 如果正在运行，调整滚动位置保持相对位置不变
        if (isRunning && oldTextHeight > 0) {
            // 等待布局更新
            setTimeout(() => {
                // 获取新文本高度
                const newTextHeight = teleprompterText.offsetHeight;
                
                // 计算新的滚动位置
                currentScrollTop = scrollRatio * newTextHeight;
                totalDistance = currentScrollTop;
                
                // 应用新位置
                teleprompterText.style.top = `-${Math.round(currentScrollTop)}px`;
                
                // 重新计算暂停标记的位置
                recalculatePausePositions();
            }, 50);
        }
    });
    
    // 更新水平位置
    horizontalPosControl.addEventListener('input', function() {
        horizontalOffset = parseInt(this.value);
        updateHorizontalPosition();
        
        if (horizontalOffset === 0) {
            horizontalPosValue.textContent = '居中';
        } else if (horizontalOffset > 0) {
            horizontalPosValue.textContent = '右移 ' + horizontalOffset + '%';
        } else {
            horizontalPosValue.textContent = '左移 ' + Math.abs(horizontalOffset) + '%';
        }
    });
    
    // 更新提词器容器高度
    heightControl.addEventListener('input', function() {
        const height = parseInt(this.value);
        teleprompterContainer.style.height = height + 'px';
        heightValue.textContent = height + 'px';
    });
    
    function updateHorizontalPosition() {
        // 计算水平偏移
        const offsetPercentage = 50 + horizontalOffset;
        // 应用位置样式
        teleprompterText.style.left = offsetPercentage + '%';
        teleprompterText.style.transform = `translateX(-${offsetPercentage}%)`;
    }
    
    // 开始提词
    startButton.addEventListener('click', startPrompterAction);
    fsStartButton.addEventListener('click', startPrompterAction);
    
    function startPrompterAction() {
        if (!promptText.value.trim()) {
            alert('请先输入文本');
            return;
        }
        
        // 解析文本并准备显示
        prepareText();
        
        // 启动提词器
        startPrompter();
        
        // 更新UI状态
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = false;
        fsStartButton.disabled = true;
        fsPauseButton.disabled = false;
        fsResetButton.disabled = false;
        pauseButton.textContent = '暂停';
        fsPauseButton.textContent = '暂停';
    }
    
    // 暂停/继续
    pauseButton.addEventListener('click', togglePause);
    fsPauseButton.addEventListener('click', togglePause);
    
    function togglePause() {
        if (isRunning) {
            // 暂停
            userPaused = true;
            stopScrolling();
            pauseButton.textContent = '继续';
            fsPauseButton.textContent = '继续';
        } else {
            // 继续
            userPaused = false;
            if (activePauseTimeout) {
                clearTimeout(activePauseTimeout);
                activePauseTimeout = null;
            }
            startScrolling();
            pauseButton.textContent = '暂停';
            fsPauseButton.textContent = '暂停';
        }
    }
    
    // 重置
    resetButton.addEventListener('click', resetPrompter);
    fsResetButton.addEventListener('click', resetPrompter);
    
    function resetPrompter() {
        // 停止滚动
        stopScrolling();
        
        // 清除任何激活的暂停计时器
        if (activePauseTimeout) {
            clearTimeout(activePauseTimeout);
            activePauseTimeout = null;
        }
        
        // 重置状态
        userPaused = false;
        currentScrollTop = 0;
        totalDistance = 0;
        currentPauseIndex = -1;
        teleprompterText.style.top = '0px';
        teleprompterText.innerHTML = '';
        pauseElements = [];
        updateHorizontalPosition();
        
        // 重置UI
        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = true;
        fsStartButton.disabled = false;
        fsPauseButton.disabled = true;
        fsResetButton.disabled = true;
        pauseButton.textContent = '暂停';
        fsPauseButton.textContent = '暂停';
    }
    
    // 全屏模式切换
    fullscreenButton.addEventListener('click', toggleFullscreen);
    fsExitButton.addEventListener('click', toggleFullscreen);
    
    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        
        if (isFullscreen) {
            teleprompterContainer.classList.add('fullscreen');
            fullscreenControls.style.display = 'flex';
            
            // 如果浏览器支持全屏API，使用API进入全屏
            if (teleprompterContainer.requestFullscreen) {
                teleprompterContainer.requestFullscreen();
            } else if (teleprompterContainer.mozRequestFullScreen) {
                teleprompterContainer.mozRequestFullScreen();
            } else if (teleprompterContainer.webkitRequestFullscreen) {
                teleprompterContainer.webkitRequestFullscreen();
            } else if (teleprompterContainer.msRequestFullscreen) {
                teleprompterContainer.msRequestFullscreen();
            }
            
            // 同步控制面板状态
            fsSpeedControl.value = speedControl.value;
            fsFontSizeControl.value = fontSizeControl.value;
            
            // 同步按钮状态
            fsStartButton.disabled = startButton.disabled;
            fsPauseButton.disabled = pauseButton.disabled;
            fsResetButton.disabled = resetButton.disabled;
            
            if (pauseButton.textContent === '继续') {
                fsPauseButton.textContent = '继续';
            }
            
            // 监听全屏变化事件
            document.addEventListener('fullscreenchange', exitFullscreenHandler);
            document.addEventListener('webkitfullscreenchange', exitFullscreenHandler);
            document.addEventListener('mozfullscreenchange', exitFullscreenHandler);
            document.addEventListener('MSFullscreenChange', exitFullscreenHandler);
        } else {
            teleprompterContainer.classList.remove('fullscreen');
            fullscreenControls.style.display = 'none';
            
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // 移除监听
            document.removeEventListener('fullscreenchange', exitFullscreenHandler);
            document.removeEventListener('webkitfullscreenchange', exitFullscreenHandler);
            document.removeEventListener('mozfullscreenchange', exitFullscreenHandler);
            document.removeEventListener('MSFullscreenChange', exitFullscreenHandler);
        }
    }
    
    // 处理用户按ESC或其他方式退出全屏的情况
    function exitFullscreenHandler() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && !document.msFullscreenElement) {
            isFullscreen = false;
            teleprompterContainer.classList.remove('fullscreen');
            fullscreenControls.style.display = 'none';
        }
    }
    
    // 解析和准备文本 - 使用HTML元素作为暂停标记
    function prepareText() {
        const originalText = promptText.value;
        pauseMarkers = [];
        pauseElements = [];
        currentPauseIndex = -1;
        
        // 使用HTML片段来替代纯文本，便于插入暂停标记
        let finalHtml = '';
        let lastIndex = 0;
        
        // 匹配所有暂停标记
        const pausePattern = /\[暂停:(\d+(?:\.\d+)?)\]/g;
        let match;
        
        while ((match = pausePattern.exec(originalText)) !== null) {
            // 添加暂停标记前的文本
            const beforePause = originalText.substring(lastIndex, match.index);
            finalHtml += beforePause;
            
            // 记录暂停时间
            const pauseDuration = parseFloat(match[1]);
            
            // 生成唯一ID
            const pauseId = 'pause-' + Date.now() + '-' + Math.round(Math.random() * 10000);
            
            // 添加可视化标记（在调试模式下可见）
            const pauseClass = debugMode ? 'pause-marker debug-visible' : 'pause-marker';
            finalHtml += `<span id="${pauseId}" class="${pauseClass}" 
                          data-duration="${pauseDuration}">
                          ${debugMode ? `[暂停:${pauseDuration}]` : ''}
                          </span>`;
            
            // 记录该暂停标记
            pauseMarkers.push({
                id: pauseId,
                duration: pauseDuration
            });
            
            // 更新lastIndex为当前匹配结束位置
            lastIndex = match.index + match[0].length;
        }
        
        // 添加最后一部分文本
        finalHtml += originalText.substring(lastIndex);
        
        // 设置文本内容
        teleprompterText.innerHTML = finalHtml;
        
        // 获取所有暂停标记元素的引用
        pauseMarkers.forEach(marker => {
            const element = document.getElementById(marker.id);
            if (element) {
                pauseElements.push({
                    element: element,
                    id: marker.id,
                    duration: marker.duration,
                    position: -1,  // 将在滚动时计算
                    processed: false
                });
            }
        });
        
        // 初始计算所有暂停标记的位置
        calculatePausePositions();
    }
    
    // 计算所有暂停标记相对于中心线的位置
    function calculatePausePositions() {
        const viewportCenterY = teleprompterContainer.offsetHeight / 2;
        const containerRect = teleprompterContainer.getBoundingClientRect();
        
        pauseElements.forEach(pauseObj => {
            if (pauseObj.element) {
                const rect = pauseObj.element.getBoundingClientRect();
                // 计算元素顶部相对于容器的位置
                const elementTop = rect.top - containerRect.top;
                // 计算到中心线的距离
                pauseObj.position = elementTop - viewportCenterY;
            }
        });
        
        // 按照位置排序暂停点，从上到下
        pauseElements.sort((a, b) => a.position - b.position);
    }
    
    // 重新计算暂停位置 - 用于字体大小或布局改变时
    function recalculatePausePositions() {
        calculatePausePositions();
        
        // 重置未处理的暂停点
        pauseElements.forEach(pauseObj => {
            if (pauseObj.position > -currentScrollTop) {
                pauseObj.processed = false;
            }
        });
        
        // 确定当前应该处理的暂停点索引
        currentPauseIndex = -1;
        for (let i = 0; i < pauseElements.length; i++) {
            if (!pauseElements[i].processed) {
                currentPauseIndex = i;
                break;
            }
        }
    }
    
    // 启动提词器
    function startPrompter() {
        // 重置位置和状态
        currentScrollTop = 0;
        totalDistance = 0;
        lastTimestamp = 0;
        currentPauseIndex = 0;
        teleprompterText.style.top = '0px';
        
        // 重置所有暂停标记状态
        pauseElements.forEach(pauseObj => {
            pauseObj.processed = false;
        });
        
        // 初始计算所有暂停位置
        calculatePausePositions();
        
        // 开始滚动
        startScrolling();
    }
    
    // 停止滚动
    function stopScrolling() {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        isRunning = false;
    }
    
    // 开始滚动
    function startScrolling() {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
        }
        
        isRunning = true;
        lastTimestamp = performance.now();
        animationId = requestAnimationFrame(scroll);
    }
    
    // 滚动动画函数
    function scroll(timestamp) {
        if (!isRunning) return;
        
        // 计算时间差
        const elapsed = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // 计算这一帧应该滚动的距离（使用帧率补偿）
        // 更精确地应用滚动速度值，不再使用整数
        const frameSpeed = scrollSpeed * elapsed / 16.67;
        
        // 更新总滚动距离
        totalDistance += frameSpeed;
        
        // 更新当前位置
        currentScrollTop = totalDistance;
        
        // 应用位置 (使用整数值以获得更平滑的渲染)
        teleprompterText.style.top = `-${Math.round(currentScrollTop)}px`;
        
        // 检查是否有暂停标记需要触发
        if (currentPauseIndex >= 0 && currentPauseIndex < pauseElements.length) {
            const pauseObj = pauseElements[currentPauseIndex];
            
            // 检查暂停点是否已到达中心线位置
            // pauseObj.position是静态位置，currentScrollTop是动态滚动距离
            // 当滚动距离追上暂停位置时，暂停标记就位于中心线上
            if (!pauseObj.processed && pauseObj.position <= currentScrollTop) {
                pauseObj.processed = true;
                
                // 精确定位到暂停标记
                const exactPosition = pauseObj.position;
                const adjustment = currentScrollTop - exactPosition;
                
                if (Math.abs(adjustment) > 0) {
                    // 需要微调以确保精确定位
                    currentScrollTop = exactPosition;
                    totalDistance = currentScrollTop;
                    teleprompterText.style.top = `-${Math.round(currentScrollTop)}px`;
                }
                
                // 暂停
                stopScrolling();
                
                // 设置恢复计时器
                activePauseTimeout = setTimeout(() => {
                    // 只有当用户没有手动暂停时才恢复
                    if (!userPaused) {
                        // 更新当前暂停索引
                        currentPauseIndex++;
                        startScrolling();
                    }
                    activePauseTimeout = null;
                }, pauseObj.duration * 1000);
                
                return; // 退出滚动循环
            }
        }
        
        // 检查是否到达文本末尾
        const textHeight = teleprompterText.offsetHeight;
        const viewportHeight = teleprompterContainer.offsetHeight;
        
        if (currentScrollTop >= textHeight - viewportHeight / 2) {
            // 到达文本末尾，停止滚动
            stopScrolling();
            
            // 更新UI状态
            pauseButton.disabled = true;
            resetButton.disabled = false;
            fsPauseButton.disabled = true;
            fsResetButton.disabled = false;
            return;
        }
        
        // 继续下一帧
        animationId = requestAnimationFrame(scroll);
    }
    
    // 初始化设置
    teleprompterText.style.width = displayWidth + '%';
    teleprompterText.style.position = 'absolute';
    teleprompterText.style.top = '0px';
    updateHorizontalPosition();
    teleprompterContainer.style.height = heightControl.value + 'px';
    updateFontSize(parseInt(fontSizeControl.value));
    
    // 初始化速度显示为1位小数
    speedValue.textContent = parseFloat(speedControl.value).toFixed(1);
    if (fsSpeedValue) {
        fsSpeedValue.textContent = parseFloat(fsSpeedControl.value).toFixed(1);
    }
    
    // 调试模式切换 (可选，可通过按下Alt+D激活)
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'd') {
            debugMode = !debugMode;
            if (isRunning) {
                const pauseMarkers = document.querySelectorAll('.pause-marker');
                pauseMarkers.forEach(marker => {
                    if (debugMode) {
                        marker.classList.add('debug-visible');
                        marker.textContent = `[暂停:${marker.dataset.duration}]`;
                    } else {
                        marker.classList.remove('debug-visible');
                        marker.textContent = '';
                    }
                });
            }
        }
    });
});