// ===== 数据层 =====
const DB = {
  get(key, def) {
    try { const v = localStorage.getItem('sd_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    localStorage.setItem('sd_' + key, JSON.stringify(val));
  }
};

// 默认数据结构
function defaultData() {
  return {
    records: [],      // {id, type:'daily'|'work', content, confidential, date}
    goals: [],        // {id, type:'short'|'long', title, desc, progress, date}
    plan45: {         // 45天计划
      startDate: null,
      checks: {}      // { 'YYYY-MM-DD': {dimension: [bool x N] } }
    },
    reminders: [],    // {id, title, type:'monthly-end'|'monthly-first'|'custom', day?, time, note, enabled}
    reviewLog: [],    // 复盘历史
    settings: {
      passcode: null, // 锁屏密码
      name: '',
      account: null   // { user, passHash } 登录账号
    }
  };
}

const state = DB.get('data', defaultData());
if (!state.plan45) state.plan45 = { startDate: null, checks: {} };
if (!state.settings) state.settings = { passcode: null, name: '', account: null };
if (!state.reminders) state.reminders = [];
if (!state.reviewLog) state.reviewLog = [];

function save() { DB.set('data', state); }

// ===== 登录锁 =====
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showLogin() {
  const ls = document.getElementById('loginScreen');
  ls.classList.remove('hidden');
  const hasAccount = !!state.settings.account;
  document.getElementById('loginTitle').textContent = '蜕变 · 个人成长系统';
  document.getElementById('loginSub').textContent = hasAccount ? '欢迎回来，请登录' : '首次使用，请设置账号密码';
  document.getElementById('loginConfirmField').style.display = hasAccount ? 'none' : '';
  document.getElementById('loginBtn').textContent = hasAccount ? '登录' : '注册并进入';
  document.getElementById('loginHint').textContent = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginPass2').value = '';
}

async function handleLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const pass2 = document.getElementById('loginPass2').value;
  const hint = document.getElementById('loginHint');
  const hasAccount = !!state.settings.account;

  if (!user || !pass) { hint.textContent = '请填写账号和密码'; return; }
  if (user.length < 2) { hint.textContent = '账号至少2个字符'; return; }
  if (pass.length < 4) { hint.textContent = '密码至少4位'; return; }

  if (hasAccount) {
    // 登录验证
    const hash = await sha256(user + ':' + pass);
    if (user === state.settings.account.user && hash === state.settings.account.passHash) {
      document.getElementById('loginScreen').classList.add('hidden');
      toast('登录成功 ✓');
      render();
    } else {
      hint.textContent = '账号或密码错误';
    }
  } else {
    // 首次注册
    if (pass !== pass2) { hint.textContent = '两次密码不一致'; return; }
    const hash = await sha256(user + ':' + pass);
    state.settings.account = { user, passHash: hash };
    save();
    document.getElementById('loginScreen').classList.add('hidden');
    toast('账号已创建 ✓ 数据仅保存在本机');
    render();
  }
}

function initLogin() {
  showLogin();
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  ['loginUser', 'loginPass', 'loginPass2'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  });
}

// ===== 工具函数 =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { const d = new Date(); return fmtDate(d); }
function fmtDate(d) { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function fmtTime(d) { return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function nowTime() { return fmtTime(new Date()); }
function esc(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ===== 45天计划配置 =====
const DIMENSIONS = [
  { name: '物理·杀毒', icon: '💪', tasks: ['23:30前睡觉', '6:30起床', '戒垃圾食品/碳酸饮料', '40分钟运动流汗'] },
  { name: '信息·断舍离', icon: '🧠', tasks: ['不刷短视频', '不玩竞技游戏', '阅读商业传记/行业逻辑', '学习变现硬技能'] },
  { name: '社交·大清洗', icon: '🤝', tasks: ['拒绝无效社交', '拒绝无意义酒局', '专注自我提升', '打磨自身价值'] },
  { name: '执行·吃青蛙', icon: '🐸', tasks: ['写下明日3件事', '先啃最难的任务', '完成核心目标', '复盘执行结果'] },
  { name: '认知·搞钱脑', icon: '💰', tasks: ['生产者思维', '思考第二曲线', '创造价值而非消费', '记录变现灵感'] }
];

// ===== 默认提醒 =====
function ensureDefaultReminders() {
  if (state.reminders.length === 0) {
    state.reminders = [
      { id: uid(), title: '库存盘点', type: 'monthly-end', day: null, time: '09:00', note: '每月月底库存盘点', enabled: true },
      { id: uid(), title: '其他出入库', type: 'monthly-end', day: null, time: '09:30', note: '其他出入库核对', enabled: true },
      { id: uid(), title: '工资报表核对', type: 'monthly-end', day: null, time: '10:00', note: '工资报表核对', enabled: true },
      { id: uid(), title: '组长绩效打印下发', type: 'monthly-first', day: null, time: '09:00', note: '每月1号组长绩效打印下发', enabled: true }
    ];
    save();
  }
}
ensureDefaultReminders();

// ===== 渲染器 =====
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const modal = document.getElementById('modal');
let currentTab = 'home';

function render() {
  const tabs = {
    home: renderHome,
    record: renderRecord,
    plan: renderPlan,
    plan45: renderPlan45,
    remind: renderRemind
  };
  const titles = { home: '蜕变', record: '记录', plan: '规划', plan45: '45天计划', remind: '提醒' };
  pageTitle.textContent = titles[currentTab];
  tabs[currentTab]();
}

// 导航切换
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    render();
  });
});

// ===== 首页 =====
function renderHome() {
  const p45 = state.plan45;
  const started = !!p45.startDate;
  let dayNum = null, progress = 0;
  
  if (started) {
    dayNum = Math.floor((new Date(today()) - new Date(p45.startDate)) / 86400000) + 1;
    if (dayNum < 1) dayNum = 1;
    if (dayNum > 45) dayNum = 45;
    progress = Math.round((dayNum / 45) * 100);
  }

  const todayChecks = p45.checks[today()] || {};
  let doneCount = 0, totalCount = 0;
  DIMENSIONS.forEach((dim, di) => {
    const arr = todayChecks[di] || [];
    dim.tasks.forEach((_, ti) => {
      totalCount++;
      if (arr[ti]) doneCount++;
    });
  });

  const recordCount = state.records.length;
  const goalCount = state.goals.length;
  const enabledReminders = state.reminders.filter(r => r.enabled).length;

  content.innerHTML = `
    <div class="card" style="background: linear-gradient(135deg, #1e293b, #0f172a); border-color: #38bdf855;">
      <div style="font-size: 13px; color: var(--text-dim);">${started ? `第 ${dayNum} 天 / 45 天` : '尚未开始蜕变计划'}</div>
      <div style="font-size: 28px; font-weight: 800; margin: 8px 0;">${started ? `${progress}%` : '准备就绪'}</div>
      <div class="progress"><div class="progress-fill" style="width:${progress}%"></div></div>
      ${started ? `<div style="font-size:12px;color:var(--text-dim);margin-top:6px;">今日完成 ${doneCount}/${totalCount} 项</div>` : ''}
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-num">${recordCount}</div><div class="stat-label">📝 记录总数</div></div>
      <div class="stat"><div class="stat-num">${goalCount}</div><div class="stat-label">🎯 目标数量</div></div>
      <div class="stat"><div class="stat-num">${enabledReminders}</div><div class="stat-label">⏰ 启用提醒</div></div>
      <div class="stat"><div class="stat-num">${started ? dayNum : '-'}</div><div class="stat-label">🔥 蜕变天数</div></div>
    </div>

    <div class="card">
      <div class="card-title">📋 今日待办提醒</div>
      ${renderTodayReminders()}
    </div>

    <div class="card">
      <div class="card-title">💡 复盘建议</div>
      ${renderReviewSuggestion()}
    </div>

    <div class="card">
      <div class="card-title">⚡ 自驱力提升</div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.7;">
        你的自制力需要刻意练习。试试这些步骤：
      </div>
      ${renderDriveSteps()}
    </div>
  `;
}

function renderTodayReminders() {
  const enabled = state.reminders.filter(r => r.enabled);
  const todayD = new Date();
  const day = todayD.getDate();
  const lastDay = new Date(todayD.getFullYear(), todayD.getMonth()+1, 0).getDate();
  
  const due = enabled.filter(r => {
    if (r.type === 'monthly-end') return day === lastDay;
    if (r.type === 'monthly-first') return day === 1;
    if (r.type === 'custom') {
      if (r.day === 'daily') return true;
      if (r.day === 'weekly') return todayD.getDay() === 1; // 周一
      return Number(r.day) === day;
    }
    return false;
  });

  if (due.length === 0) return `<div class="empty" style="padding:20px;">今天没有待办提醒 🎉</div>`;
  return due.map(r => `
    <div class="item" style="border-left:3px solid var(--warn);">
      <div class="item-head"><span class="item-title">${esc(r.title)}</span><span class="item-time">${esc(r.time)}</span></div>
      <div class="item-body">${esc(r.note||'')}</div>
    </div>
  `).join('');
}

function renderReviewSuggestion() {
  const records = state.records;
  if (records.length < 3) {
    return `<div class="empty" style="padding:20px;">记录 3 条以上内容后，这里会给出复盘建议 📊</div>`;
  }
  // 简单复盘逻辑
  const recent = records.slice(-7);
  const workCount = recent.filter(r => r.type === 'work').length;
  const dailyCount = recent.filter(r => r.type === 'daily').length;
  const confCount = recent.filter(r => r.confidential).length;
  
  let suggestions = [];
  if (workCount === 0 && dailyCount > 0) suggestions.push('近期偏重生活记录，建议补充工作复盘，平衡成长维度。');
  if (dailyCount === 0 && workCount > 0) suggestions.push('工作记录偏多，别忘了关注身心健康和情绪状态。');
  if (confCount > 0) suggestions.push(`你有 ${confCount} 条保密记录，记得定期回顾自己的真实想法。`);
  if (recent.length >= 5) suggestions.push('坚持记录很好！建议每周日做一次深度复盘，提炼本周的「青蛙」和「第二曲线」进展。');
  if (suggestions.length === 0) suggestions.push('记录节奏稳定，继续保持！可以尝试在规划里明确一个近期核心目标。');
  
  return suggestions.map(s => `<div style="font-size:13px;line-height:1.6;margin-bottom:8px;color:var(--text);">• ${esc(s)}</div>`).join('');
}

function renderDriveSteps() {
  const steps = [
    { icon: '🎯', text: '微习惯启动：每天只要求自己完成 1 个最小行动，降低启动门槛' },
    { icon: '⏱️', text: '番茄工作法：25分钟专注 + 5分钟休息，用计时器对抗拖延' },
    { icon: '🐸', text: '吃青蛙：每天先做最困难、最重要的事，而不是最轻松的' },
    { icon: '📱', text: '环境设计：远离手机和短视频，把诱惑物放在看不见的地方' },
    { icon: '🤝', text: '公开承诺：把你的目标告诉信任的人，用外部压力倒逼行动' },
    { icon: '🏆', text: '即时奖励：完成阶段目标就奖励自己，让大脑建立正向反馈' }
  ];
  return steps.map(s => `
    <div style="display:flex;gap:10px;align-items:flex-start;margin-top:10px;">
      <span style="font-size:20px;">${s.icon}</span>
      <span style="font-size:13px;color:var(--text);line-height:1.5;">${esc(s.text)}</span>
    </div>
  `).join('');
}

// ===== 记录页 =====
function renderRecord() {
  const records = [...state.records].reverse();
  content.innerHTML = `
    <div class="seg">
      <button class="active" data-filter="all">全部</button>
      <button data-filter="daily">日常</button>
      <button data-filter="work">工作</button>
      <button data-filter="conf">保密</button>
    </div>
    <button class="btn btn-primary btn-block" id="addRecordBtn" style="margin-bottom:14px;">➕ 新建记录</button>
    <div id="recordList"></div>
  `;
  
  document.querySelectorAll('.seg button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      filterRecords(b.dataset.filter);
    });
  });
  document.getElementById('addRecordBtn').addEventListener('click', () => openRecordModal());
  
  filterRecords('all');
}

function filterRecords(filter) {
  const records = [...state.records].reverse();
  const filtered = records.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'conf') return r.confidential;
    return r.type === filter;
  });
  const list = document.getElementById('recordList');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📭</div>暂无记录</div>`;
    return;
  }
  list.innerHTML = filtered.map(r => `
    <div class="item ${r.confidential ? 'confidential' : ''}">
      <div class="item-head">
        <span class="item-title">${r.confidential ? '🔒 ' : ''}${r.type === 'work' ? '💼' : '📝'} ${esc(r.title||'无标题')}</span>
        <span class="item-time">${esc(r.date)}</span>
      </div>
      <div class="item-body">${r.confidential ? '🔒 保密内容' : esc(r.content)}</div>
      <div style="text-align:right;margin-top:8px;">
        <button class="btn btn-sm btn-ghost" data-view="${r.id}">查看</button>
        <button class="btn btn-sm btn-danger" data-del="${r.id}">删除</button>
      </div>
    </div>
  `).join('');
  
  list.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => viewRecord(b.dataset.view)));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => delRecord(b.dataset.del)));
}

function openRecordModal(id) {
  const r = id ? state.records.find(x => x.id === id) : null;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">${r ? '编辑记录' : '新建记录'}</div>
      <div class="field"><label>类型</label>
        <select class="select" id="f-type">
          <option value="daily" ${r && r.type==='daily'?'selected':''}>日常分享</option>
          <option value="work" ${r && r.type==='work'?'selected':''}>工作记录</option>
        </select>
      </div>
      <div class="field"><label>标题</label><input class="input" id="f-title" value="${r?esc(r.title):''}" placeholder="一句话概括"></div>
      <div class="field"><label>内容</label><textarea class="textarea" id="f-content" placeholder="写下你的想法...">${r?esc(r.content):''}</textarea></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="f-conf" ${r&&r.confidential?'checked':''}> 设为保密内容（需解锁查看）
      </label></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost btn-block" id="f-cancel">取消</button>
        <button class="btn btn-primary btn-block" id="f-save">保存</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  document.getElementById('f-cancel').addEventListener('click', closeModal);
  document.getElementById('f-save').addEventListener('click', () => {
    const type = document.getElementById('f-type').value;
    const title = document.getElementById('f-title').value.trim();
    const content = document.getElementById('f-content').value.trim();
    const confidential = document.getElementById('f-conf').checked;
    if (!content && !title) { toast('请填写内容'); return; }
    if (r) {
      Object.assign(r, { type, title: title||'无标题', content, confidential });
    } else {
      state.records.push({ id: uid(), type, title: title||'无标题', content, confidential, date: today() });
    }
    save();
    closeModal();
    render();
    toast('已保存 ✓');
  });
}

function viewRecord(id) {
  const r = state.records.find(x => x.id === id);
  if (!r) return;
  if (r.confidential && state.settings.passcode) {
    // 需要密码
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">🔒 保密内容</div>
        <div class="field"><label>请输入密码</label><input class="input" type="password" id="f-pass" placeholder="输入解锁密码"></div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost btn-block" id="f-cancel">取消</button>
          <button class="btn btn-primary btn-block" id="f-unlock">解锁</button>
        </div>
      </div>
    `;
    modal.classList.add('show');
    document.getElementById('f-cancel').addEventListener('click', closeModal);
    document.getElementById('f-unlock').addEventListener('click', () => {
      const pass = document.getElementById('f-pass').value;
      if (pass === state.settings.passcode) {
        showRecordContent(r);
      } else {
        toast('密码错误');
      }
    });
  } else {
    showRecordContent(r);
  }
}

function showRecordContent(r) {
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">${r.confidential?'🔒 ':''}${esc(r.title)}</div>
      <div class="item-time" style="text-align:center;margin-bottom:12px;">${esc(r.date)} · ${r.type==='work'?'工作记录':'日常分享'}</div>
      <div style="font-size:14px;line-height:1.7;white-space:pre-wrap;color:var(--text);">${esc(r.content)}</div>
      <button class="btn btn-ghost btn-block" style="margin-top:16px;" id="f-close">关闭</button>
    </div>
  `;
  modal.classList.add('show');
  document.getElementById('f-close').addEventListener('click', closeModal);
}

function delRecord(id) {
  if (confirm('确定删除这条记录吗？')) {
    state.records = state.records.filter(x => x.id !== id);
    save();
    render();
    toast('已删除');
  }
}

// ===== 规划页 =====
function renderPlan() {
  const short = state.goals.filter(g => g.type === 'short');
  const long = state.goals.filter(g => g.type === 'long');
  content.innerHTML = `
    <button class="btn btn-primary btn-block" id="addGoalBtn" style="margin-bottom:14px;">🎯 新建目标</button>
    
    <div class="card">
      <div class="card-title">📌 短期规划 <span class="tag tag-blue">${short.length}</span></div>
      ${renderGoalList(short)}
    </div>
    <div class="card">
      <div class="card-title">🌟 长期规划 <span class="tag tag-purple">${long.length}</span></div>
      ${renderGoalList(long)}
    </div>
  `;
  document.getElementById('addGoalBtn').addEventListener('click', () => openGoalModal());
  bindGoalActions();
}

function renderGoalList(goals) {
  if (goals.length === 0) return `<div class="empty" style="padding:16px;">暂无目标，点击上方新建</div>`;
  return goals.map(g => `
    <div class="item">
      <div class="item-head">
        <span class="item-title">${esc(g.title)}</span>
        <span class="item-time">${g.progress}%</span>
      </div>
      ${g.desc ? `<div class="item-body">${esc(g.desc)}</div>` : ''}
      <div class="progress"><div class="progress-fill" style="width:${g.progress}%"></div></div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-sm btn-ghost" data-edit="${g.id}">编辑</button>
        <button class="btn btn-sm btn-ghost" data-progress="${g.id}">进度</button>
        <button class="btn btn-sm btn-danger" data-delg="${g.id}">删除</button>
      </div>
    </div>
  `).join('');
}

function bindGoalActions() {
  content.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openGoalModal(b.dataset.edit)));
  content.querySelectorAll('[data-progress]').forEach(b => b.addEventListener('click', () => openProgressModal(b.dataset.progress)));
  content.querySelectorAll('[data-delg]').forEach(b => b.addEventListener('click', () => {
    if (confirm('删除该目标？')) {
      state.goals = state.goals.filter(x => x.id !== b.dataset.delg);
      save(); render(); toast('已删除');
    }
  }));
}

function openGoalModal(id) {
  const g = id ? state.goals.find(x => x.id === id) : null;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">${g ? '编辑目标' : '新建目标'}</div>
      <div class="field"><label>类型</label>
        <select class="select" id="g-type">
          <option value="short" ${g&&g.type==='short'?'selected':''}>短期规划</option>
          <option value="long" ${g&&g.type==='long'?'selected':''}>长期规划</option>
        </select>
      </div>
      <div class="field"><label>目标标题</label><input class="input" id="g-title" value="${g?esc(g.title):''}" placeholder="如：3个月内学会Python"></div>
      <div class="field"><label>详细描述</label><textarea class="textarea" id="g-desc" placeholder="具体计划、里程碑...">${g?esc(g.desc):''}</textarea></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost btn-block" id="g-cancel">取消</button>
        <button class="btn btn-primary btn-block" id="g-save">保存</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  document.getElementById('g-cancel').addEventListener('click', closeModal);
  document.getElementById('g-save').addEventListener('click', () => {
    const type = document.getElementById('g-type').value;
    const title = document.getElementById('g-title').value.trim();
    const desc = document.getElementById('g-desc').value.trim();
    if (!title) { toast('请填写标题'); return; }
    if (g) { Object.assign(g, { type, title, desc }); }
    else { state.goals.push({ id: uid(), type, title, desc, progress: 0, date: today() }); }
    save(); closeModal(); render(); toast('已保存 ✓');
  });
}

function openProgressModal(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">更新进度 · ${esc(g.title)}</div>
      <div class="field"><label>完成进度：<strong id="p-val">${g.progress}%</strong></label>
        <input type="range" min="0" max="100" value="${g.progress}" id="p-range" style="width:100%;">
      </div>
      <button class="btn btn-primary btn-block" id="p-save">确认</button>
    </div>
  `;
  modal.classList.add('show');
  const range = document.getElementById('p-range');
  range.addEventListener('input', () => document.getElementById('p-val').textContent = range.value + '%');
  document.getElementById('p-save').addEventListener('click', () => {
    g.progress = Number(range.value);
    save(); closeModal(); render(); toast('进度已更新 ✓');
  });
}

function closeModal() { modal.classList.remove('show'); modal.innerHTML = ''; }

// ===== 45天计划页 =====
function renderPlan45() {
  const p45 = state.plan45;
  const started = !!p45.startDate;
  
  if (!started) {
    content.innerHTML = `
      <div class="card" style="text-align:center;padding:30px;">
        <div style="font-size:50px;margin-bottom:16px;">🔥</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:10px;">45天蜕变计划</div>
        <div style="font-size:13px;color:var(--text-dim);line-height:1.7;margin-bottom:20px;">
          重塑顶级男人的五个维度：<br>
          💪 物理杀毒 · 🧠 信息断舍离 · 🤝 社交大清洗<br>
          🐸 执行吃青蛙 · 💰 认知搞钱脑<br><br>
          21天养成习惯，24天刻进骨子里。<br>
          这45天会像蛇蜕皮一样痛苦，但熬过去就是新生。
        </div>
        <button class="btn btn-primary btn-block" id="start45Btn">🚀 开始我的45天</button>
      </div>
    `;
    document.getElementById('start45Btn').addEventListener('click', () => {
      p45.startDate = today();
      save(); render(); toast('蜕变计划已启动！加油 💪');
    });
    return;
  }

  const dayNum = Math.min(45, Math.max(1, Math.floor((new Date(today()) - new Date(p45.startDate)) / 86400000) + 1));
  const todayChecks = p45.checks[today()] || {};
  
  let doneCount = 0, totalCount = 0;
  DIMENSIONS.forEach((dim, di) => {
    const arr = todayChecks[di] || [];
    dim.tasks.forEach((_, ti) => { totalCount++; if (arr[ti]) doneCount++; });
  });
  const todayProgress = totalCount ? Math.round(doneCount/totalCount*100) : 0;

  content.innerHTML = `
    <div class="card" style="background:linear-gradient(135deg,#1e293b,#0f172a);border-color:#fbbf2455;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;color:var(--text-dim);">蜕变第 ${dayNum} 天</div>
          <div style="font-size:26px;font-weight:800;margin-top:4px;">${todayProgress}%</div>
        </div>
        <div style="font-size:40px;">🔥</div>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${todayProgress}%"></div></div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:6px;">今日 ${doneCount}/${totalCount} 项 · 总进度 ${Math.round(dayNum/45*100)}%</div>
    </div>

    <div id="dimList"></div>
  `;

  const dimList = document.getElementById('dimList');
  dimList.innerHTML = DIMENSIONS.map((dim, di) => {
    const arr = todayChecks[di] || [];
    const dimDone = arr.filter(Boolean).length;
    return `
      <div class="card">
        <div class="card-title">${dim.icon} ${dim.name} <span class="tag tag-yellow">${dimDone}/${dim.tasks.length}</span></div>
        ${dim.tasks.map((task, ti) => `
          <div class="check-row">
            <div class="check-box ${arr[ti]?'done':''}" data-dim="${di}" data-task="${ti}">${arr[ti]?'✓':''}</div>
            <span style="font-size:14px;flex:1;">${esc(task)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  dimList.querySelectorAll('.check-box').forEach(box => {
    box.addEventListener('click', () => {
      const di = Number(box.dataset.dim);
      const ti = Number(box.dataset.task);
      if (!p45.checks[today()]) p45.checks[today()] = {};
      if (!p45.checks[today()][di]) p45.checks[today()][di] = [];
      p45.checks[today()][di][ti] = !p45.checks[today()][di][ti];
      save(); renderPlan45();
      if (p45.checks[today()][di][ti]) toast('完成！继续保持 💪');
    });
  });
}

// ===== 提醒页 =====
function renderRemind() {
  const reminders = state.reminders;
  content.innerHTML = `
    <div class="card">
      <div class="card-title">⏰ 固定提醒</div>
      <div id="remindList"></div>
    </div>
    <button class="btn btn-primary btn-block" id="addRemindBtn" style="margin-bottom:12px;">➕ 新增提醒</button>
    <button class="btn btn-ghost btn-block" id="exportCalBtn" style="margin-bottom:12px;">📅 生成日历订阅</button>
    <div class="card">
      <div class="card-title">💡 提醒方式说明</div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.7;">
        <strong>App内推送</strong>：打开App时首页会显示今日待办提醒。<br>
        <strong>日历订阅</strong>：生成 .ics 文件，导入iPhone日历后自动提醒。<br>
        两种方式可同时使用，双保险更可靠。
      </div>
    </div>
  `;

  const list = document.getElementById('remindList');
  list.innerHTML = reminders.map(r => `
    <div class="item" style="${!r.enabled?'opacity:.5':''}">
      <div class="item-head">
        <span class="item-title">${esc(r.title)}</span>
        <span class="tag ${r.type==='monthly-end'?'tag-yellow':r.type==='monthly-first'?'tag-blue':'tag-green'}">${typeLabel(r)}</span>
      </div>
      <div class="item-body">${esc(r.note||'')}</div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:6px;">⏰ ${timeLabel(r)}</div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-sm btn-ghost" data-editr="${r.id}">编辑</button>
        <button class="btn btn-sm btn-ghost" data-toggle="${r.id}">${r.enabled?'停用':'启用'}</button>
        <button class="btn btn-sm btn-danger" data-delr="${r.id}">删除</button>
      </div>
    </div>
  `).join('');

  document.getElementById('addRemindBtn').addEventListener('click', () => openRemindModal());
  document.getElementById('exportCalBtn').addEventListener('click', exportCalendar);
  list.querySelectorAll('[data-editr]').forEach(b => b.addEventListener('click', () => openRemindModal(b.dataset.editr)));
  list.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
    const r = state.reminders.find(x => x.id === b.dataset.toggle);
    r.enabled = !r.enabled; save(); render(); toast(r.enabled?'已启用':'已停用');
  }));
  list.querySelectorAll('[data-delr]').forEach(b => b.addEventListener('click', () => {
    if (confirm('删除该提醒？')) {
      state.reminders = state.reminders.filter(x => x.id !== b.dataset.delr);
      save(); render(); toast('已删除');
    }
  }));
}

function typeLabel(r) {
  if (r.type === 'monthly-end') return '每月月底';
  if (r.type === 'monthly-first') return '每月1号';
  if (r.day === 'daily') return '每天';
  if (r.day === 'weekly') return '每周一';
  return `每月${r.day}号`;
}

function timeLabel(r) {
  if (r.type === 'monthly-end') return `每月最后一天 ${r.time}`;
  if (r.type === 'monthly-first') return `每月1号 ${r.time}`;
  if (r.day === 'daily') return `每天 ${r.time}`;
  if (r.day === 'weekly') return `每周一 ${r.time}`;
  return `每月${r.day}号 ${r.time}`;
}

function openRemindModal(id) {
  const r = id ? state.reminders.find(x => x.id === id) : null;
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">${r ? '编辑提醒' : '新增提醒'}</div>
      <div class="field"><label>提醒标题</label><input class="input" id="r-title" value="${r?esc(r.title):''}" placeholder="如：库存盘点"></div>
      <div class="field"><label>提醒类型</label>
        <select class="select" id="r-type">
          <option value="monthly-end" ${r&&r.type==='monthly-end'?'selected':''}>每月月底</option>
          <option value="monthly-first" ${r&&r.type==='monthly-first'?'selected':''}>每月1号</option>
          <option value="custom" ${r&&r.type==='custom'?'selected':''}>自定义日期</option>
        </select>
      </div>
      <div class="field" id="r-day-field" style="${r&&r.type==='custom'?'':'display:none;'}"><label>日期</label>
        <select class="select" id="r-day">
          <option value="daily" ${r&&r.day==='daily'?'selected':''}>每天</option>
          <option value="weekly" ${r&&r.day==='weekly'?'selected':''}>每周一</option>
          ${Array.from({length:28},(_,i)=>i+1).map(d=>`<option value="${d}" ${r&&Number(r.day)===d?'selected':''}>每月${d}号</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>提醒时间</label><input class="input" type="time" id="r-time" value="${r?r.time:'09:00'}"></div>
      <div class="field"><label>备注</label><input class="input" id="r-note" value="${r?esc(r.note):''}" placeholder="补充说明"></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-ghost btn-block" id="r-cancel">取消</button>
        <button class="btn btn-primary btn-block" id="r-save">保存</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  
  const typeSel = document.getElementById('r-type');
  typeSel.addEventListener('change', () => {
    document.getElementById('r-day-field').style.display = typeSel.value === 'custom' ? '' : 'none';
  });
  document.getElementById('r-cancel').addEventListener('click', closeModal);
  document.getElementById('r-save').addEventListener('click', () => {
    const title = document.getElementById('r-title').value.trim();
    const type = document.getElementById('r-type').value;
    const day = document.getElementById('r-day').value;
    const time = document.getElementById('r-time').value;
    const note = document.getElementById('r-note').value.trim();
    if (!title) { toast('请填写标题'); return; }
    const data = { title, type, day: type==='custom'?day:null, time, note, enabled: true };
    if (r) { Object.assign(r, data); }
    else { state.reminders.push({ id: uid(), ...data }); }
    save(); closeModal(); render(); toast('已保存 ✓');
  });
}

// ===== 日历订阅导出 =====
function exportCalendar() {
  const enabled = state.reminders.filter(r => r.enabled);
  if (enabled.length === 0) { toast('没有启用的提醒'); return; }
  
  const events = [];
  const now = new Date();
  const year = now.getFullYear();
  
  enabled.forEach(r => {
    if (r.type === 'daily') {
      for (let i = 0; i < 30; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()+i);
        events.push(makeEvent(r, d));
      }
      return;
    }
    if (r.type === 'weekly') {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + ((8 - d.getDay()) % 7) + i*7);
        events.push(makeEvent(r, d));
      }
      return;
    }
    for (let m = 0; m < 12; m++) {
      let day;
      if (r.type === 'monthly-end') {
        day = new Date(year, m+1, 0).getDate();
      } else if (r.type === 'monthly-first') {
        day = 1;
      } else {
        day = Number(r.day);
      }
      const d = new Date(year, m, day);
      if (d < now) d.setFullYear(year + 1);
      events.push(makeEvent(r, d));
    }
  });
  
  const ics = buildICS(events);
  downloadFile(ics, '蜕变提醒日历.ics', 'text/calendar');
  toast('日历文件已生成，请导入iPhone日历 ✓');
}

function makeEvent(r, date) {
  const [h, min] = r.time.split(':').map(Number);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, min);
  const end = new Date(start.getTime() + 30*60000);
  return { title: r.title, desc: r.note || '', start, end };
}

function buildICS(events) {
  const fmt = d => d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//蜕变//CN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  events.forEach(e => {
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${uid()}@tuibian\r\n`;
    ics += `DTSTART:${fmt(e.start)}\r\n`;
    ics += `DTEND:${fmt(e.end)}\r\n`;
    ics += `SUMMARY:${e.title}\r\n`;
    if (e.desc) ics += `DESCRIPTION:${e.desc}\r\n`;
    ics += 'BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:提醒\r\nEND:VALARM\r\n';
    ics += 'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  return ics;
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 锁定功能 =====
const lockBtn = document.getElementById('lockBtn');
let isLocked = false;

function renderLockScreen() {
  const ls = document.createElement('div');
  ls.className = 'lock-screen' + (isLocked ? '' : ' hidden');
  ls.id = 'lockScreen';
  ls.innerHTML = `
    <div class="lock-icon">🔒</div>
    <div style="font-size:18px;font-weight:700;">已锁定</div>
    <div style="font-size:13px;color:var(--text-dim);">输入密码解锁</div>
    <input class="input" type="password" id="lockPass" placeholder="输入密码" style="max-width:220px;text-align:center;">
    <button class="btn btn-primary" id="lockUnlock" style="min-width:120px;">解锁</button>
    <button class="btn btn-ghost" id="lockSetup" style="min-width:120px;font-size:12px;">设置/修改密码</button>
  `;
  document.body.appendChild(ls);
  
  document.getElementById('lockUnlock').addEventListener('click', () => {
    const pass = document.getElementById('lockPass').value;
    if (pass === state.settings.passcode) {
      isLocked = false;
      ls.classList.add('hidden');
      toast('已解锁 ✓');
    } else {
      toast('密码错误');
    }
  });
  document.getElementById('lockSetup').addEventListener('click', () => {
    const pass = prompt('设置新密码（留空则取消密码）：', state.settings.passcode || '');
    if (pass === null) return;
    if (pass === '') {
      state.settings.passcode = null;
      save(); toast('已取消密码');
    } else {
      state.settings.passcode = pass;
      save(); toast('密码已设置 ✓');
    }
  });
}

lockBtn.addEventListener('click', () => {
  if (!state.settings.passcode) {
    const pass = prompt('首次使用锁定功能，请设置密码：');
    if (!pass) return;
    state.settings.passcode = pass;
    save();
  }
  isLocked = true;
  if (!document.getElementById('lockScreen')) renderLockScreen();
  else document.getElementById('lockScreen').classList.remove('hidden');
});

// ===== 应用内推送检查 =====
function checkAppReminders() {
  if (!('Notification' in window)) return;
  const enabled = state.reminders.filter(r => r.enabled);
  const todayD = new Date();
  const day = todayD.getDate();
  const lastDay = new Date(todayD.getFullYear(), todayD.getMonth()+1, 0).getDate();
  const hm = nowTime();
  
  enabled.forEach(r => {
    let due = false;
    if (r.type === 'monthly-end') due = day === lastDay;
    else if (r.type === 'monthly-first') due = day === 1;
    else if (r.day === 'daily') due = true;
    else if (r.day === 'weekly') due = todayD.getDay() === 1;
    else due = Number(r.day) === day;
    
    if (due && r.time === hm) {
      if (Notification.permission === 'granted') {
        new Notification('⏰ ' + r.title, { body: r.note || '该处理了' });
      }
    }
  });
}

// ===== 初始化 =====
function init() {
  initLogin();
  renderLockScreen();
  setInterval(checkAppReminders, 30000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
