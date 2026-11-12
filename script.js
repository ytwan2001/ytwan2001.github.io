let isAutoMode = true;
let isEffectMode = false;
let isTimerFocused = false;
let myChart = null;
let stockCodes = [];
let stockNames = [];

let myGauge = null;

// === KLineChart 相关变量 ===
let proKlineChart = null;
let currentPeriod = '30m'; // 默认 30 分钟
let currentIndicator = 'MACD'; 
let lastKLineRefresh = 0; 




window.onload = () => {
  console.log("1. 页面加载完成，开始初始化...");
  
  // 默认隐藏专业K线内容
  document.querySelector('.chart-toolbar').style.display = 'none';
  document.getElementById('pro-stock-select').parentNode.style.display = 'none';
  document.getElementById('pro-kline-container').style.display = 'none';
  document.getElementById('btnToggleProKline').innerText = '显示';
  document.getElementById('btnToggleProKline').style.background = '#3b82f6';

  // 自动把工具栏按钮的高亮切到 30分
  let buttons = document.querySelectorAll('.btn-chart');
  buttons.forEach(b => {
    b.classList.remove('active');
    if(b.innerText === '30分') b.classList.add('active');
  });

  // 1. 初始化天气图表
  try {
    if (typeof echarts !== 'undefined') {
      myChart = echarts.init(document.getElementById('tempChart'));
      myChart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: [], axisLabel: { color: '#9ca3af' } },
        yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#374151' } } },
        series: [{ data: [], type: 'line', smooth: true, itemStyle: { color: '#fbbf24' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(251, 191, 36, 0.5)' },
            { offset: 1, color: 'rgba(251, 191, 36, 0.01)' } ]) } }]
      });
      console.log("2. ECharts 天气图表初始化成功");
    }
  } catch (e) { console.error("天气图表初始化失败:", e); }

  // 2. 初始化仪表盘
  try {
    if (typeof echarts !== 'undefined') {
      myGauge = echarts.init(document.getElementById('gaugeChart'));
      myGauge.setOption({
        series: [{
            type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, splitNumber: 10,
            itemStyle: { color: '#10b981', shadowColor: 'rgba(16, 185, 129, 0.5)', shadowBlur: 10 },
            progress: { show: true, width: 18 }, pointer: { show: true, length: '60%', width: 6 },
            axisLine: { lineStyle: { width: 18, color: [[1, '#374151']] } }, axisTick: { show: false },
            splitLine: { length: 15, lineStyle: { width: 2, color: '#9ca3af' } },
            axisLabel: { distance: 25, color: '#9ca3af', fontSize: 12 },
            anchor: { show: true, showAbove: true, size: 20, itemStyle: { borderWidth: 10, borderColor: '#10b981' } },
            title: { show: false },
            detail: { valueAnimation: true, formatter: '{value}', color: '#10b981', fontSize: 40, fontWeight: 'bolder', offsetCenter: [0, '70%'] },
            data: [{ value: 0 }]
        }]
      });
      console.log("3. ECharts 仪表盘初始化成功");
    }
  } catch (e) { console.error("仪表盘初始化失败:", e); }
 
  // 3. 初始化专业 KLineChart
  try {
    // 👇 这里如果找不到 klinecharts，直接给出明确提示
    if (typeof klinecharts === 'undefined') {
      console.error("❌ 致命错误：klinecharts 未加载，请检查 index.html 里的 CDN 链接或本地文件！");
      return; // 停止后续初始化
    }

    // 初始化时传入布局
    proKlineChart = klinecharts.init('pro-kline-container', {
      layout: [
        { type: 'candle', content: [] },
        { type: 'indicator', content: [currentIndicator], options: { id: 'pane_1', height: 105 } },
        { type: 'xAxis' }
      ]
    });
    
    // 强制覆盖：红涨绿跌
    proKlineChart.setStyles({
      candle: {
        type: 'candle_solid', 
        bar: {
          upColor: '#ef4444', downColor: '#10b981', noChangeColor: '#9ca3af',
          upBorderColor: '#ef4444', downBorderColor: '#10b981', noChangeBorderColor: '#9ca3af',
          upWickColor: '#ef4444', downWickColor: '#10b981', noChangeWickColor: '#9ca3af'
        }
      },
      indicator: {
        bars: [{ upColor: 'rgba(239, 68, 68, 0.7)', downColor: 'rgba(16, 185, 129, 0.7)', noChangeColor: '#9ca3af' }]
      }
    });
    
    console.log("4. KLineChart 初始化成功");
  } catch (e) { console.error("K线图初始化失败:", e); }

  // 4. 绑定定时器事件
  let timerInput = document.getElementById('ui-timer');
  if (timerInput) {
    timerInput.addEventListener('focus', () => { isTimerFocused = true; });
    timerInput.addEventListener('blur', () => { isTimerFocused = false; });
    timerInput.addEventListener('wheel', function(e) {
      e.preventDefault(); 
      let val = this.value || "12:00";
      let parts = val.split(':');
      let hours = parseInt(parts[0]);
      let minutes = parseInt(parts[1]);
      if (e.deltaY < 0) minutes++; else minutes--;
      if (minutes >= 60) { minutes = 0; hours++; if (hours >= 24) hours = 0; }
      else if (minutes < 0) { minutes = 59; hours--; if (hours < 0) hours = 23; }
      this.value = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
    }, { passive: false });
  }

  console.log("5. 开始请求 ESP32 数据...");
  fetchStatus();
  setInterval(fetchStatus, 3000);
};

// === 展开/收起专业K线板块 ===
function toggleProKline() {
  let toolbar = document.querySelector('.chart-toolbar');
  let selectBox = document.getElementById('pro-stock-select').parentNode;
  let container = document.getElementById('pro-kline-container');
  let btn = document.getElementById('btnToggleProKline');
  
  if (container.style.display === 'none') {
    container.style.display = 'block';
    toolbar.style.display = 'flex';
    selectBox.style.display = 'flex';
    btn.innerText = '隐藏专业K线';
    btn.style.background = '#ef4444'; 
    
    if (proKlineChart) {
      // 延迟稍微长一点，确保 DOM 已经完全渲染出宽度
      setTimeout(() => {
        proKlineChart.resize();
        proKlineChart.setPaneOptions({ id: 'pane_1', height: 105 });
        
        // 展开后立刻检查有没有数据，没有就拉取
        if (stockCodes.length > 0) {
          fetchKLineData(); 
        } else {
          drawFakeData(); // 如果连股票代码都没拿到，先画个假图垫着
        }
      }, 100); 
    }
  } else {
    container.style.display = 'none';
    toolbar.style.display = 'none';
    selectBox.style.display = 'none';
    btn.innerText = '显示';
    btn.style.background = '#3b82f6'; 
  }
}
 
// === 获取并渲染专业数据 ===
async function fetchKLineData() {
  if (!proKlineChart) return;

  const selectEl = document.getElementById('pro-stock-select');
  if (!selectEl) return;
  
  // 如果下拉框还没加载出选项，先画假图
  if (selectEl.options.length === 0) {
    drawFakeData();
    return;
  }

  const idx = parseInt(selectEl.value);
  if (isNaN(idx) || !stockCodes || !stockCodes[idx]) {
    drawFakeData();
    return;
  }

  const code = stockCodes[idx]; 

  let scale = 5;
  if (currentPeriod === '15m') scale = 15;
  if (currentPeriod === '30m') scale = 30;
  if (currentPeriod === '60m') scale = 60;
  if (currentPeriod === '1d') scale = 240;

  //const url = `/api/kline?symbol=${code}&scale=${scale}`;
  const url = `https://192.168.1.238/api/kline?symbol=${code}&scale=${scale}`;  //github
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    if (!data || data.length === 0) {
      drawFakeData(); // 如果没有数据，用假数据演示，保证图表不是空的
      return;
    }

    const formattedData = data.map(item => ({
      timestamp: new Date(item.day.replace(/-/g, '/')).getTime(),
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume) || 0,
    }));

    proKlineChart.applyNewData(formattedData);
    
    setTimeout(() => {
      proKlineChart.resize(); // 再次确保尺寸正确
      proKlineChart.setPaneOptions({ id: 'pane_1', height: 105 });
    }, 50);

  } catch (error) {
    console.error("代理请求失败，绘制假数据:", error);
    drawFakeData();
  }
}

function drawFakeData() {
  if (!proKlineChart) return;
  let fakeData = [];
  let basePrice = 100;
  for(let i=0; i<100; i++) {
      basePrice = basePrice + (Math.random() - 0.5) * 2;
      fakeData.push({
          timestamp: Date.now() - (100-i)*86400000,
          open: basePrice,
          high: basePrice + Math.random(),
          low: basePrice - Math.random(),
          close: basePrice + Math.random() - 0.5,
          volume: Math.floor(Math.random() * 10000)
      });
  }
  proKlineChart.applyNewData(fakeData);
  
  // 假数据渲染后也强制设置高度
  setTimeout(() => {
    proKlineChart.setPaneOptions({ id: 'pane_1', height: 105 });
  }, 10);
}

// === 切换周期 ===
function changePeriod(period, btn) {
  currentPeriod = period;
  let buttons = btn.parentNode.querySelectorAll('.btn-chart');
  buttons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fetchKLineData();
}

// === 切换副图指标 ===
function changeIndicator(indicator, btn) {
  if (!proKlineChart || currentIndicator === indicator) return;
  proKlineChart.removeIndicator('pane_1', currentIndicator);
  proKlineChart.createIndicator(indicator, false, { id: 'pane_1' });
  
  // 👇 切换指标后，立即强制设置一次高度
  setTimeout(() => {
    proKlineChart.setPaneOptions({ id: 'pane_1', height: 105 });
  }, 10);
  
  currentIndicator = indicator;

  let buttons = btn.parentNode.querySelectorAll('.btn-chart');
  buttons.forEach(b => {
    if(['MACD','KDJ','RSI'].includes(b.innerText)) b.classList.remove('active');
  });
  btn.classList.add('active');
}

function toggleStock() {
  let card = document.getElementById('stockCard');
  let proCard = document.getElementById('proKlineCard');
  let btn = document.getElementById('btnToggleStock');
  
  if (card.style.display === 'none') {
    card.style.display = 'block';
    proCard.style.display = 'block';
    btn.innerText = '隐藏监控';
    
    let container = document.getElementById('pro-kline-container');
    if (container && container.style.display !== 'none' && proKlineChart) {
      setTimeout(() => { 
        proKlineChart.resize(); 
        proKlineChart.setPaneOptions({ id: 'pane_1', height: 105 });
      }, 50);
    }
  } else {
    card.style.display = 'none';
    proCard.style.display = 'none';
    btn.innerText = '显示监控';
  }
}

function setAutoMode() { isAutoMode = true; 
//fetch('/setAuto').then(() => fetchStatus()); 
fetch('https://192.168.1.238/setAuto').then(() => fetchStatus()); 

}
function setRGB(r, g, b) {
  isAutoMode = false;
  document.getElementById('ui-slider0').value = r; document.getElementById('ui-slider1').value = g; document.getElementById('ui-slider2').value = b;
  onSlider();
}
function setColor(hex) { setRGB(parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)); }
function onSlider() {
  isAutoMode = false;
  let r = document.getElementById('ui-slider0').value;
  let g = document.getElementById('ui-slider1').value;
  let b = document.getElementById('ui-slider2').value;
  document.getElementById('ui-v0').innerText = r; document.getElementById('ui-v1').innerText = g; document.getElementById('ui-v2').innerText = b;
  //fetch('/rgb?r=' + r + '&g=' + g + '&b=' + b);
  fetch('https://192.168.1.238/rgb?r=' + r + '&g=' + g + '&b=' + b);
}
function changeStock(idx) {
  isAutoMode = true;
  document.getElementById('ui-stockPrice').innerText = '切换中...';
  document.getElementById('ui-stockTip').innerText = '拉取新数据...';
  //fetch('/setStock?idx=' + idx).then(() => { fetchStatus(); updateStockChart(); });
fetch('https://192.168.1.238/setStock/setStock?idx=' + idx).then(() => { fetchStatus(); updateStockChart(); });
}
function toggleStockChart() {
  let container = document.getElementById('stockChartContainer');
  let btn = document.getElementById('btnStockChart');
  if (container.style.display === 'none') {
    container.style.display = 'block'; btn.innerText = '>--<'; //'隐藏原版走势图'; 
    updateStockChart();
  } else {
    container.style.display = 'none'; btn.innerText = '<-->';  //'显示原版走势图';
  }
}
function updateStockChart() { 
  let idx = parseInt(document.getElementById('ui-select').value);
  if (!stockCodes[idx]) return;  
  let code = stockCodes[idx];
  let chartType = document.getElementById('ui-chartType').value; 
  let imgUrl = "https://image.sinajs.cn/newchart/" + chartType + "/n/" + code + ".gif?t=" + new Date().getTime();
  document.getElementById('ui-stockChartImg').src = imgUrl;
}
function toggleEffect() { isEffectMode = !isEffectMode; 
//fetch('/setEffect?state=' + (isEffectMode ? 1 : 0)).then(() => fetchStatus()); 
fetch('https://192.168.1.238/setEffect?state=' + (isEffectMode ? 1 : 0)).then(() => fetchStatus()); 

}
function setTimer() {
  let t = document.getElementById('ui-timer').value;
  if (!t) return;
  //fetch('/setTimer?time=' + t).then(() => { 
  fetch('https://192.168.1.238/setTimer?time=' + t).then(() => { 

    isTimerFocused = false; fetchStatus(); 
  });
}


let versionClickCount = 0;  
function countVersionClicks() {
  versionClickCount++;
  if (versionClickCount >= 5) {
    let dev = document.getElementById('devTools');
    if (dev.style.display === 'none') {
      dev.style.display = 'block';
      alert("开发者模式已开启！");
    } else {
      dev.style.display = 'none';
    }
    versionClickCount = 0; 
  }
}


// 核心拉取数据
function fetchStatus() {
  fetch('https://192.168.1.238/status')//fetch('/status')
    .then(r => r.json())
    .then(d => {
      if (d.stockCodes && document.getElementById('ui-select').options.length === 0) {
        stockCodes = d.stockCodes.split(',');
        stockNames = d.stockNames.split(',');
        let selectOld = document.getElementById('ui-select');
        let selectPro = document.getElementById('pro-stock-select');
        
        for (let i = 0; i < stockCodes.length; i++) {
          let optOld = document.createElement('option'); optOld.value = i; optOld.innerText = stockNames[i]; selectOld.appendChild(optOld);
          let optPro = document.createElement('option'); optPro.value = i; optPro.innerText = stockNames[i]; selectPro.appendChild(optPro);
        }
        
        if (d.stockIndex !== undefined) {
            selectOld.value = d.stockIndex;
            selectPro.value = d.stockIndex;
            updateStockChart(); 
            if (document.getElementById('pro-kline-container').style.display !== 'none') {
                fetchKLineData();
            }
        }
      }

      if (d.stockIndex !== undefined) {
          let selectOld = document.getElementById('ui-select');
          if (selectOld.value != d.stockIndex) {
              selectOld.value = d.stockIndex;
              updateStockChart();
              
              let selectPro = document.getElementById('pro-stock-select');
              if (selectPro && selectPro.value != d.stockIndex) {
                  selectPro.value = d.stockIndex;
                  if (document.getElementById('pro-kline-container').style.display !== 'none') {
                      fetchKLineData();
                  }
              }
          }
      }

      if (d.temp !== null && d.temp !== undefined) {
        document.getElementById('ui-temp').innerText = d.temp.toFixed(1) + '°C';
        document.getElementById('ui-desc').innerText = d.desc;
        document.getElementById('ui-hum').innerText = d.hum + '%';
        document.getElementById('ui-wind').innerText = d.wind.toFixed(1) + ' m/s';
        document.getElementById('ui-cloud').innerText = d.cloud + '%';
        document.getElementById('ui-press').innerText = d.press.toFixed(1) + ' hPa';
        let pt = d.pressTrend >= 0 ? '+' : '';
        document.getElementById('ui-pressTrend').innerText = pt + d.pressTrend.toFixed(1) + ' hPa';
        document.getElementById('ui-updateTime').innerText = d.updateTime;
      }
     
      if (d.fishScore >= 0) {
        if (myGauge) {
          myGauge.setOption({
            series: [{ data: [{ value: d.fishScore }],
              itemStyle: { color: d.fishScore >= 65 ? '#10b981' : (d.fishScore >= 35 ? '#f59e0b' : '#ef4444') },
              detail: { color: d.fishScore >= 65 ? '#10b981' : (d.fishScore >= 35 ? '#f59e0b' : '#ef4444') } }]
          });
        }
        let elLevel = document.getElementById('ui-fishLevel'); if (elLevel) elLevel.innerText = d.fishLevel;
        let elAdvice = document.getElementById('ui-advice'); if (elAdvice) elAdvice.innerText = d.advice;
      }
 
      if (d.stock !== null && d.stock !== undefined) {
        let serverIdx = d.stockIndex !== undefined ? d.stockIndex : 0;
        document.getElementById('ui-stockTip').innerText = stockNames[serverIdx] + ' · 更新于 ' + d.stock.update;
      }

      isAutoMode = d.autoMode;
      document.getElementById('ui-btnAuto').style.background = isAutoMode ? '#374151' : '#10b981';
      document.getElementById('ui-btnAuto').innerText = isAutoMode ? '当前: 自动跟随' : '点击恢复自动联动';

      isEffectMode = d.effectMode;
      let btnEffect = document.getElementById('ui-btnEffect');
      btnEffect.style.background = isEffectMode ? '#ec4899' : '#8b5cf6';
      btnEffect.innerText = isEffectMode ? '关闭幻彩呼吸灯' : '开启幻彩呼吸灯';

      document.getElementById('ui-slider0').value = d.r; document.getElementById('ui-slider1').value = d.g; document.getElementById('ui-slider2').value = d.b;
      document.getElementById('ui-v0').innerText = d.r; document.getElementById('ui-v1').innerText = d.g; document.getElementById('ui-v2').innerText = d.b;
      document.getElementById('color').value = '#' + d.r.toString(16).padStart(2, '0') + d.g.toString(16).padStart(2, '0') + d.b.toString(16).padStart(2, '0');

      if (!isTimerFocused) {
        if (d.timer && d.timer !== "") {
          document.getElementById('ui-timer').value = d.timer;
          document.getElementById('ui-timerTip').innerText = '已设置: 每天 ' + d.timer + ' 关灯';
        } else {
          document.getElementById('ui-timerTip').innerText = '当前未设置定时';
        }
      }

      if (d.temps && myChart) {
        let tempArray = d.temps.split(',').map(Number);
        let timeLabels = Array.from({length: 24}, (_, i) => i + '时');
        myChart.setOption({ xAxis: { data: timeLabels }, series: [{ data: tempArray }] });
      }
      
      if (document.getElementById('stockChartContainer').style.display !== 'none') {
        let chartType = document.getElementById('ui-chartType').value;
        let currentSrc = document.getElementById('ui-stockChartImg').src;
        let baseUrl = currentSrc.split('?')[0];
        if (baseUrl) {
          if (chartType === 'min') document.getElementById('ui-stockChartImg').src = baseUrl + "?t=" + new Date().getTime();
          else if (chartType === 'daily' && new Date().getTime() - lastKLineRefresh > 60000) {
            lastKLineRefresh = new Date().getTime(); 
            document.getElementById('ui-stockChartImg').src = baseUrl + "?t=" + lastKLineRefresh;
          }
        }
      }

      let nowTime = Date.now();
      if (document.getElementById('pro-kline-container').style.display !== 'none' && nowTime - lastKLineRefresh > 30000) {
          lastKLineRefresh = nowTime;
          fetchKLineData();
      }
      /*
      // 更新版本号  OTA-5
      if (d.version) {
        //document.getElementById('ui-version').innerText = '系统版本: ' + d.version;
        let elVer = document.getElementById('ui-version');
        if (elVer) elVer.innerText = '系统版本: ' + d.version;
      }
      */ 

      if (d.version) {
        let elVer = document.getElementById('ui-version');
        if (elVer) {
          elVer.innerText = '系统版本: ' + d.version;
          elVer.onclick = countVersionClicks; // 👈 绑定点击事件
        }
      }


    })
    .catch(e => console.error('获取后台状态失败:', e));
}

  
