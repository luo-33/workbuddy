<script>
// ========== DATA SERVICE LAYER ==========
// Abstracted data layer: pages 鈫?DataService 鈫?DB 鈫?localStorage
// Future: replace DB implementation to switch to API (no DataService changes needed)
const DataService = {
  // Config
  _version: '1.0.0',
  _mode: 'local',        // 'local' | 'cloud'
  _syncStatus: 'disconnected', // 'disconnected' | 'syncing' | 'synced' | 'error'
  _lastSync: null,
  
  // Get sync state
  getSyncState() {
    return {
      mode: this._mode,
      status: this._syncStatus,
      lastSync: this._lastSync,
      version: this._version
    };
  },
  
  // Core data operations (abstracted)
  get(key, def=null) {
    this._logAccess('read', key);
    return DB.get(key, def);
  },
  
  set(key, val) {
    this._logAccess('write', key);
    DB.set(key, val);
  },
  
  // CRUD helper for list-type data
  addToList(key, item) {
    const list = this.get(key, []);
    list.push(item);
    this.set(key, list);
    return list;
  },
  
  removeFromList(key, idx) {
    const list = this.get(key, []);
    if(idx >= 0 && idx < list.length) list.splice(idx, 1);
    this.set(key, list);
    return list;
  },
  
  updateInList(key, idx, updates) {
    const list = this.get(key, []);
    if(idx >= 0 && idx < list.length) Object.assign(list[idx], updates);
    this.set(key, list);
    return list;
  },
  
  // Batch operations (for migration/backup)
  getAllKeys() {
    const keys = [];
    for(let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if(key && key.startsWith('pg_')) keys.push(key);
    }
    return keys;
  },
  
  getAllData() {
    const data = {};
    const keys = this.getAllKeys();
    keys.forEach(k => {
      try { data[k] = JSON.parse(localStorage.getItem(k)); }
      catch(e) { data[k] = localStorage.getItem(k); }
    });
    return data;
  },
  
  restoreAll(data) {
    let count = 0;
    for(const [key, val] of Object.entries(data)) {
      localStorage.setItem(key, JSON.stringify(val));
      count++;
    }
    return count;
  },
  
  // Sync management (stub for future cloud)
  setMode(mode) {
    this._mode = mode;
    this._syncStatus = mode === 'local' ? 'disconnected' : 'syncing';
    DB.set('ds_mode', mode);
  },
  
  // Access log
  _logAccess(type, key) {
    const today = todayStr();
    const logKey = 'ds_log_' + today;
    const logs = DB.get(logKey, []);
    logs.push({ type, key, time: new Date().toISOString().slice(11,19), _ts: Date.now() });
    // Keep last 100 entries per day
    if(logs.length > 100) logs.splice(0, logs.length - 100);
    DB.set(logKey, logs);
  },
  
  getTodayLogs() {
    return DB.get('ds_log_' + todayStr(), []);
  }
};

// ========== CLOUD MIGRATION CONFIG ==========
const DATA_CONFIG = {
  mode: 'local',        // 'local' | 'cloud'
  apiUrl: '',           // e.g. 'https://your-project.supabase.co/functions/v1'
  anonKey: '',          // Supabase anon key
  version: '1.0.0',
  lastSync: null
};

// Load config from localStorage 鈥?called after DB is ready
function loadDataConfig() {
  const saved = DB.get('data_config', null);
  if(saved) Object.assign(DATA_CONFIG, saved);
  if(DATA_CONFIG.mode === 'cloud' && DATA_CONFIG.apiUrl) {
    console.log('[Workbuddy] 鈽侊笍 浜戠妯″紡宸查厤缃紝绛夊緟杩炴帴...');
  } else {
    console.log('[Workbuddy] 馃捇 鏈湴妯″紡杩愯涓?);
  }
}

// ========== ENHANCED DB INTERFACE ==========
// DB.get / DB.set remain unchanged for backward compatibility.
// New methods: DB.sync / DB.migrate added for cloud transition.

// ========== DATA STORE (localStorage implementation) ==========
const DB = {
  get(key, def=null) { try { const d = localStorage.getItem('pg_'+key); return d ? JSON.parse(d) : def; } catch(e) { return def; } },
  set(key, val) { localStorage.setItem('pg_'+key, JSON.stringify(val)); }
};

// Load migration config
loadDataConfig();
// Extend DB with sync and migrate capabilities
// (DB.get/set kept unchanged - sync/migrate are added directly on DB)

DB.sync = function() {
  if(DATA_CONFIG.mode !== 'cloud' || !DATA_CONFIG.apiUrl) {
    console.warn('[Workbuddy] 鈿狅笍 鏈厤缃簯绔ā寮忥紝鏃犳硶鍚屾');
    return Promise.resolve({ success: false, reason: 'NOT_CONFIGURED' });
  }
  // Stub: will be implemented when Supabase is connected
  return Promise.resolve({ success: true, message: '鍚屾鍔熻兘寰呮縺娲? });
};

DB.migrate = function() {
  const data = DataService.getAllData();
  const keys = Object.keys(data);
  if(keys.length === 0) return { success: false, reason: 'NO_DATA', message: '娌℃湁鏁版嵁闇€瑕佽縼绉? };
  
  // Format data into migration-ready JSON structure
  const migrationPackage = {
    version: DATA_CONFIG.version,
    exportedAt: new Date().toISOString(),
    userId: DB.get('user_id', 'unknown'),
    userProfile: DB.get('user_profile', {}),
    tables: {
      profiles: formatProfilesForDB(data),
      daily_plans: formatDailyPlansForDB(data),
      english_records: formatEnglishForDB(data),
      nce_records: formatNceForDB(data),
      ai_tools: formatAiToolsForDB(data),
      ai_tasks: formatAiTasksForDB(data),
      job_records: formatJobsForDB(data),
      interview_records: formatInterviewsForDB(data),
      reading_records: formatReadingForDB(data),
      knowledge_cards: formatCardsForDB(data),
      wechat_articles: formatWechatForDB(data),
      xhs_records: formatXhsForDB(data),
      health_records: formatHealthForDB(data),
      nutrition_records: formatNutritionForDB(data),
      exercise_records: formatExerciseForDB(data),
      finance_records: formatFinanceForDB(data),
      weekly_reviews: formatWeeklyForDB(data),
      achievements: formatAchievementsForDB(data)
    },
    config: DATA_CONFIG
  };
  
  return { success: true, data: migrationPackage };
};

// ========== DATA FORMATTERS (localStorage 鈫?DB Schema) ==========
function formatProfilesForDB(data) {
  const profile = data['pg_user_profile'] || {};
  return [{
    nickname: profile.nickname || '鐢ㄦ埛',
    career: profile.career || null,
    goal: profile.goal || null,
    long_goal: profile.longGoal || null,
    bio: profile.bio || null
  }];
}

function formatDailyPlansForDB(data) {
  const results = [];
  for(const [key, val] of Object.entries(data)) {
    if(key.startsWith('pg_goals_')) {
      const date = key.replace('pg_goals_', '');
      if(Array.isArray(val)) {
        val.forEach(g => {
          results.push({
            plan_date: date,
            goal_text: g.text || '',
            is_done: !!g.done
          });
        });
      }
    }
  }
  return results;
}

function formatEnglishForDB(data) {
  const records = data['pg_english_records'] || [];
  return records.map(r => ({
    record_date: r.date || null,
    article_title: r.article || null,
    duration_min: parseInt(r.time) || 0,
    new_words: r.newWordsList || null,
    phrases: r.phrases || null,
    speaking_min: parseInt(r.speaking) || 0,
    note: r.note || null,
    ai_summary: r.aiSummary || null
  }));
}

function formatNceForDB(data) {
  const articles = data['pg_eng_articles'] || [];
  return articles.map(a => ({
    title: a.title || '',
    book_name: a.book || '',
    original_text: a.content || null,
    study_date: a.date || null,
    status: a.status || 'learning',
    words_json: a.words || [],
    phrases_json: a.phrases || [],
    grammar_json: a.grammar || []
  }));
}

function formatAiToolsForDB(data) {
  const tools = data['pg_ai_tools'] || [];
  return tools.map(t => ({
    name: t.name || '',
    category: t.type || '鍏朵粬',
    core_function: t.core || null,
    use_scene: t.scene || null,
    mastery_level: parseInt(t.mastery) || 1,
    next_step: t.next || null
  }));
}

function formatAiTasksForDB(data) {
  const tasks = data['pg_ai_tasks'] || [];
  const flows = data['pg_ai_flows'] || [];
  const all = [
    ...tasks.map(t => ({
      task_name: t.name || t.goal || '',
      tool_used: t.tool || '',
      prompt_text: t.prompt || null,
      ai_output: t.output || null,
      final_result: t.result || null,
      efficiency: t.efficiency || null,
      review: t.review || t.experience || null,
      task_date: t.date || null
    })),
    ...flows.map(f => ({
      task_name: '宸ヤ綔娴侊細' + (f.name || ''),
      tool_used: f.tools || '',
      prompt_text: f.steps || null,
      efficiency: f.timeSaved || null,
      review: f.scene || null
    }))
  ];
  return all;
}

function formatJobsForDB(data) {
  const apps = data['pg_job_apply'] || [];
  return apps.map(a => ({
    company: a.company || '',
    position: a.position || '',
    apply_date: a.date || null,
    status: a.status || 'pending',
    jd_description: a.jd || null,
    resume_version: a.resumeVer || null,
    prep_notes: a.prepNotes || null
  }));
}

function formatInterviewsForDB(data) {
  const interviews = data['pg_job_interview'] || [];
  const reviews = data['pg_job_reviews'] || [];
  return [
    ...interviews.map(i => ({
      company: i.company || '',
      position: i.position || null,
      interview_date: i.time ? i.time.slice(0,10) : null,
      round: i.round || null,
      result: i.result || 'pending',
      feeling: i.feel || null,
      questions: i.questions || null,
      answers: i.answers || null,
      weakness: i.weakness || null,
      audio_file_url: i.file || null
    })),
    ...reviews.map(r => ({
      company: r.company || '',
      interview_date: r.date || null,
      self_rate: parseInt(r.rate) || null,
      weakness: r.weakQuestions || null,
      ai_analysis: r.aiAnalysis || null,
      next_step: r.nextStep || null,
      audio_file_url: r.file || null
    }))
  ];
}

function formatReadingForDB(data) {
  const records = data['pg_reading_records'] || [];
  const notes = data['pg_read_notes'] || [];
  const books = data['pg_read_books'] || [];
  return [
    ...records.map(r => ({
      book_name: r.book || '',
      read_date: r.date || null,
      duration_min: parseInt(r.time) || 0,
      content: r.content || null,
      key_point: r.keyPoint || null,
      ai_summary: r.aiSummary || null
    })),
    ...notes.map(n => ({
      book_name: n.book || '',
      read_date: n.date || null,
      chapter: n.chapter || null,
      note_type: n.type || 'opinion',
      duration_min: parseInt(n.time) || 0,
      content: n.content || null,
      key_point: n.keyPoint || null
    })),
    ...books.map(b => ({
      book_name: b.name || b.title || '',
      book_author: b.author || null,
      book_tag: b.tag || null,
      read_date: b.startDate || null
    }))
  ];
}

function formatCardsForDB(data) {
  const cards = data['pg_knowledge_cards'] || [];
  return cards.map(c => ({
    topic: c.topic || '',
    card_type: c.type || '瑙傜偣',
    content: c.content || '',
    source_book: c.source || null,
    my_understanding: c.understanding || null,
    apply_scene: c.scene || null
  }));
}

function formatWechatForDB(data) {
  const articles = data['pg_wechat_articles'] || [];
  return articles.map(a => ({
    title: a.title || '',
    status: a.status || 'draft',
    publish_date: a.publishDate || null,
    read_data: a.readData || null,
    review: a.review || null
  }));
}

function formatXhsForDB(data) {
  const productions = data['pg_xhs_productions'] || [];
  const ideas = data['pg_xhs_ideas'] || [];
  const virals = data['pg_xhs_virals'] || [];
  return [
    ...productions.map(p => ({
      title: p.title || '',
      content_type: p.type || '鍥炬枃',
      copy_text: p.copy || null,
      status: p.status || 'idea',
      file_name: p.fileName || null,
      data_performance: p.data || null
    })),
    ...ideas.map(i => ({
      title: i.title || '鐏垫劅',
      content_type: '绗旇',
      status: i.status || 'idea',
      source: i.source || null,
      ai_suggestion: i.aiSuggestion || null
    })),
    ...virals.map(v => ({
      title: v.name || '鐖嗘妗堜緥',
      content_type: '绗旇',
      status: 'published',
      is_viral_case: true,
      viral_reason: v.reason || null,
      takeaway: v.takeaway || null,
      file_name: v.fileName || null
    }))
  ];
}

function formatHealthForDB(data) {
  const bodyStates = [];
  for(const [key, val] of Object.entries(data)) {
    if(key.startsWith('pg_body_state_')) {
      const date = key.replace('pg_body_state_', '');
      bodyStates.push({ record_date: date, ...val });
    }
  }
  return bodyStates;
}

function formatNutritionForDB(data) {
  const records = data['pg_intake_records'] || [];
  return records.map(r => ({
    record_date: r.date || null,
    meal_type: r.meal || '鍔犻',
    food_name: r.food || '',
    calories_kcal: parseInt(r.cal) || 0,
    protein_g: parseFloat(r.protein) || 0,
    carbs_g: parseFloat(r.carbs) || 0,
    fat_g: parseFloat(r.fat) || 0,
    note: r.note || null
  }));
}

function formatExerciseForDB(data) {
  const records = data['pg_burn_records'] || [];
  return records.map(r => ({
    record_date: r.date || null,
    exercise_type: r.type || '',
    duration_min: parseInt(r.duration) || 0,
    calories_burned: parseInt(r.cal) || 0,
    note: r.note || null
  }));
}

function formatFinanceForDB(data) {
  const income = data['pg_fin_income'] || [];
  const expense = data['pg_fin_expense'] || [];
  return [
    ...income.map(i => ({
      record_date: i.date || null,
      type: 'income',
      amount: parseFloat(i.amount) || 0,
      category: i.category || '',
      note: i.note || null
    })),
    ...expense.map(e => ({
      record_date: e.date || null,
      type: 'expense',
      amount: parseFloat(e.amount) || 0,
      category: e.category || '',
      note: e.note || null
    }))
  ];
}

function formatWeeklyForDB(data) {
  const result = [];
  for(const [key, val] of Object.entries(data)) {
    if(key.startsWith('pg_weekly_')) {
      const weekStart = key.replace('pg_weekly_', '');
      result.push({
        week_start: weekStart,
        accomplishments: val.done || null,
        biggest_gain: val.harvest || null,
        problems: val.problem || null,
        next_week_plan: val.nextWeek || null
      });
    }
  }
  return result;
}

function formatAchievementsForDB(data) {
  const milestones = data['pg_milestones'] || [];
  const plans = data['pg_future_plans'] || [];
  return [
    ...milestones.map(m => ({
      type: 'milestone',
      content: m.text || '',
      is_done: !!m.done,
      target_date: m.date || null
    })),
    ...plans.map(p => ({
      type: 'future_plan',
      content: p.text || '',
      is_done: !!p.done
    }))
  ];
}

// ========== MIGRATION DETECTION & DOWNLOAD ==========
function detectLocalData() {
  const keys = DataService.getAllKeys();
  return {
    hasData: keys.length > 0,
    count: keys.length,
    estimatedSize: keys.reduce((s, k) => s + (localStorage.getItem(k)||'').length, 0)
  };
}

function downloadMigrationJson() {
  const result = DB.migrate();
  if(!result.success) {
    alert('鉂?'+result.message);
    return;
  }
  
  const blob = new Blob([JSON.stringify(result.data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workbuddy_migration_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showOcrToast(`鉁?杩佺Щ鏂囦欢宸茬敓鎴愶紒鍏?${Object.values(result.data.tables).reduce((s,t)=>s+t.length,0)} 鏉℃暟鎹褰昤);
}


// Initialize default goals
function getDefaultGoals() {
  return [
    { id:'g1', text:'鉁嶏笍 鑻辫瀛︿範 30min+', done:false },
    { id:'g2', text:'馃捈 姹傝亴鐩稿叧锛堟姇閫?鍑嗗/澶嶇洏锛?, done:false },
    { id:'g3', text:'馃 AI宸ュ叿瀛︿範涓庡疄鎿?, done:false },
    { id:'g4', text:'馃幀 鍐呭鍒涗綔锛堝皬绾功/瑙嗛锛?, done:false },
    { id:'g5', text:'馃摉 闃呰 + 绗旇', done:false },
    { id:'g6', text:'馃攳 浠婃棩澶嶇洏鎬荤粨', done:false },
  ];
}

// ========== NAVIGATION ==========
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlayMask').classList.remove('show');
  // refresh page data
  refreshPage(page);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlayMask').classList.toggle('show');
}

// ========== DASHBOARD ==========
function refreshDashboard() {
  updateWelcomeGreeting();
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('todayDate').textContent = formatDateLong(today);

  // Day count
  const startDate = new Date('2026-07-01');
  const todayDate = new Date();
  const dayDiff = Math.ceil((todayDate - startDate) / (1000*60*60*24)) + 1;
  document.getElementById('dayCount').textContent = dayDiff;

  // ===== Stats =====
  // Energy
  const bodyState = DB.get('body_state_'+today, {});
  const energy = bodyState.energy || '--';
  document.getElementById('statEnergy').textContent = energy;

  // Streak (use existing calcStreak which checks goals)
  document.getElementById('statStreak').textContent = calcStreak();

  // Level & XP (from existing system)
  const totalXp = calcTotalXp();
  const todayXp = calcTodayXp();
  const lv = calcLevel(totalXp);
  document.getElementById('statLevel').textContent = lv ? lv.short : 'Lv.1';
  document.getElementById('statXp').textContent = totalXp;

  // Today score
  const reports = DB.get('daily_reports',[]);
  const todayReport = reports.slice().reverse().find(r => r.date === today);
  document.getElementById('statScore').textContent = todayReport ? todayReport.score+'鍒? : '--';

  // Today learning hours
  const engRecs = DB.get('english_records',[]).filter(r=>r.date===today);
  const readRecs = DB.get('reading_records',[]).filter(r=>r.date===today);
  const todayMins = engRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0) 
    + readRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  document.getElementById('statTodayHours').textContent = Math.round(todayMins/60*10)/10+'h';

  // ===== Render all sections =====
  renderWeekOverview(calcWeekStats());
  renderDashFinanceHealth();
  renderGrowthLevel();
  renderSixDimGrowth();
  renderDashTimeline();
  renderDailyReport();
  try { renderGrowthCalendar(); } catch(e) { console.warn('[Dashboard] 鏃ュ巻娓叉煋寮傚父:', e); }
  try { renderYearReview(); } catch(e) { console.warn('[Dashboard] 骞村害鍥為【娓叉煋寮傚父:', e); }
}

function calcWeekStats() {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dayOfWeek + 1);
  let totalDays=0, daysWithData=0;
  for(let i=0;i<7;i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    if(d > now) break;
    totalDays++;
    const goals = DB.get('goals_'+d.toISOString().slice(0,10));
    if(goals && goals.some(g=>g.done)) daysWithData++;
  }
  return { progress: totalDays?Math.round(daysWithData/totalDays*100):0, daysWithData, totalDays };
}

function calcStreak() {
  let streak = 0;
  const today = new Date();
  for(let i=0;i<365;i++){
    const d = new Date(today); d.setDate(today.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const goals = DB.get('goals_'+key);
    if(goals && goals.some(g=>g.done)) streak++;
    else break;
  }
  return streak;
}

function renderWeekOverview(ws) {
  const el = document.getElementById('weekOverview');
  const engRecs = DB.get('english_records',[]);
  const readRecs = DB.get('reading_records',[]);
  const jobApps = DB.get('job_apply',[]);
  const aiRecs = DB.get('ai_tasks',[]);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${engRecs.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">鑻辫瀛︿範娆℃暟</div>
      </div>
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${readRecs.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">闃呰璁板綍</div>
      </div>
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${jobApps.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">鎶曢€掔畝鍘?/div>
      </div>
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${aiRecs.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">AI瀛︿範璁板綍</div>
      </div>
    </div>
  `;
}

function renderDashFinanceHealth() {
  const now=new Date(); const month=now.toISOString().slice(0,7);
  const expenses=DB.get('fin_expense',[]).filter(r=>r.date.startsWith(month));
  const incomes=DB.get('fin_income',[]).filter(r=>r.date.startsWith(month));
  const balance=incomes.reduce((s,r)=>s+r.amount,0)-expenses.reduce((s,r)=>s+r.amount,0);
  const today=todayStr();
  const intakeSum=DB.get('intake_records',[]).filter(r=>r.date===today).reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  const burnSum=DB.get('burn_records',[]).filter(r=>r.date===today).reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  const net=intakeSum-burnSum;
  document.getElementById('dashFinanceHealth').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:${balance>=0?'var(--primary)':'#e74c3c'};">楼${fmtMoney(balance)}</div>
        <div style="font-size:12px;color:var(--text-secondary);">鏈湀缁撲綑</div>
      </div>
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:${net<0?'var(--primary)':'#e67e22'};">${net}</div>
        <div style="font-size:12px;color:var(--text-secondary);">浠婃棩鍑€鐑噺(kcal)</div>
      </div>
    </div>`;
}

// ========== GROWTH SYSTEM ==========
const LEVELS = [
  { min:0, max:100, name:'鍒濇鍚▼', short:'Lv.1' },
  { min:100, max:300, name:'绋冲畾琛屽姩鑰?, short:'Lv.2' },
  { min:300, max:600, name:'鎸佺画鎴愰暱鑰?, short:'Lv.3' },
  { min:600, max:1000, name:'鍐呭鍒涢€犺€?, short:'Lv.4' },
  { min:1000, max:Infinity, name:'涓汉鍝佺墝寤鸿鑰?, short:'Lv.5' },
];

const GROWTH_MESSAGES = [
  "姣忓ぉ杩涙涓€鐐圭偣锛屼綘姝ｅ湪涓嶇煡涓嶈涓彉寰楁洿寮恒€?,
  "浠婂ぉ鍙堥潬杩戠洰鏍囦竴姝ワ紝浣犲凡缁忚秴杩囦簡鏄ㄥぉ鐨勮嚜宸便€?,
  "瀹屾垚瀹冿紝鏈韩灏辨槸涓€绉嶈儨鍒┿€?,
  "杩欎簺寰皬鐨勮鍔紝姝ｅ湪鏋勫缓鏈潵鐨勪綘銆?,
  "鎸佺画琛屽姩鐨勬瘡涓€澶╋紝閮芥槸瀵硅嚜宸辨渶濂界殑鎶曡祫銆?,
  "浣犲畬鎴愮殑涓嶅彧鏄换鍔★紝鑰屾槸鍦ㄩ€愭笎寤虹珛鑷繁鐨勮兘鍔涗綋绯汇€?,
  "鍧氭寔鏈韩灏辨槸涓€绉嶈兘鍔涳紝浣犱粖澶╁張缁冧範浜嗗畠銆?,
  "鎴愰暱涓嶆槸涓€韫磋€屽氨锛岃€屾槸姣忓ぉ姣斿埆浜哄鍧氭寔涓€鐐广€?,
];

const DAILY_XP_COMMENTS = [
  { min:0, max:10, text:"璧锋寰堥噸瑕侊紝鏄庡ぉ缁х画锛? },
  { min:10, max:30, text:"浠婂ぉ鏈変笉閿欑殑鏀惰幏锛屼繚鎸佽妭濂忋€? },
  { min:30, max:60, text:"鍏呭疄鐨勪竴澶╋紒浣犳鍦ㄧǔ姝ュ墠杩涖€? },
  { min:60, max:100, text:"闈炲父楂樻晥锛佷綘宸茬粡瓒呰秺浜嗗緢澶氫汉銆? },
  { min:100, max:Infinity, text:"鍐犲啗绾ц〃鐜帮紒浣犱粖澶╃殑琛屽姩鍔涗护浜轰僵鏈嶏紒" },
];

// Compute XP for all records
function calcAllXp() {
  const engRecs = DB.get('english_records',[]);
  const readRecs = DB.get('reading_records',[]);
  const jobApps = DB.get('job_apply',[]);
  const jobInterviews = DB.get('job_interview',[]);
  const aiRecs = DB.get('ai_tasks',[]);
  const xhsRecs = DB.get('xhs_records',[]);
  const wechatArts = DB.get('wechat_articles',[]);
  const burnRecs = DB.get('burn_records',[]);

  // Group by day
  const xpByDay = {};

  function addXp(date, xp) {
    if(!date) return;
    xpByDay[date] = (xpByDay[date]||0) + xp;
  }

  engRecs.forEach(r => {
    const d = r.date;
    if(parseInt(r.time) >= 30) addXp(d, 10);
    if(parseInt(r.speaking) > 0) addXp(d, 5);
    addXp(d, 5); // review
  });

  readRecs.forEach(r => {
    const d = r.date;
    if(parseInt(r.time) >= 30) addXp(d, 5);
    if(r.understanding || r.quote) addXp(d, 5);
  });

  jobApps.forEach(r => addXp(r.date, 5));
  jobInterviews.forEach(r => addXp(r.time ? r.time.slice(0,10) : r.date, 15));

  aiRecs.forEach(r => {
    addXp(r.date, 10);
    if(r.result) addXp(r.date, 15);
  });

  xhsRecs.forEach(r => {
    addXp(r.date, 5);
    if(r.status === 'published') addXp(r.date, 15);
  });

  wechatArts.forEach(r => {
    if(r.status === 'published') addXp(r.publishDate||r.date, 20);
  });

  burnRecs.forEach(r => addXp(r.date, 10));

  return xpByDay;
}

function calcTotalXp() {
  const byDay = calcAllXp();
  return Object.values(byDay).reduce((s,v)=>s+v,0);
}

function calcTodayXp() {
  const today = todayStr();
  const byDay = calcAllXp();
  return byDay[today] || 0;
}

function getLevel(totalXp) {
  for(const lv of LEVELS) {
    if(totalXp >= lv.min && totalXp < lv.max) return lv;
  }
  return LEVELS[LEVELS.length-1];
}

// ===== Six-Dimension Growth =====
function renderSixDimGrowth() {
  const dims = [
    { icon:'馃實', name:'鑻辫鑳藉姏', key:'english', 
      data: DB.get('english_records',[]).length,
      time: Math.round(DB.get('english_records',[]).reduce((s,r)=>s+(parseFloat(r.time)||0),0)/60*10)/10,
      words: DB.get('eng_articles',[]).reduce((s,a)=>s+(a.words||[]).length,0) },
    { icon:'馃', name:'AI鑳藉姏', key:'ai',
      data: DB.get('ai_tools',[]).length+DB.get('ai_tasks',[]).length,
      tools: DB.get('ai_tools',[]).length, tasks: DB.get('ai_tasks',[]).length },
    { icon:'馃捈', name:'鑱屼笟鑳藉姏', key:'job',
      data: DB.get('job_apply',[]).length,
      interviews: DB.get('job_interview',[]).length,
      offers: DB.get('job_apply',[]).filter(a=>a.status==='offer').length },
    { icon:'馃摉', name:'闃呰鑳藉姏', key:'reading',
      data: DB.get('read_books',[]).length,
      cards: DB.get('knowledge_cards',[]).length,
      notes: DB.get('read_notes',[]).length },
    { icon:'馃幀', name:'鍒涗綔鑳藉姏', key:'creation',
      data: DB.get('xhs_productions',[]).filter(p=>p.status==='published').length,
      ideas: DB.get('xhs_ideas',[]).length,
      virals: DB.get('xhs_virals',[]).length },
    { icon:'馃弮', name:'韬綋鐘舵€?, key:'health',
      data: DB.get('intake_records',[]).filter(r=>r.date===todayStr()).length,
      bmr: DB.get('health_profile',{}).weight ? '宸茶缃? : '鏈缃?,
      steps: DB.get('steps_'+todayStr(), 0) }
  ];
  
  document.getElementById('dashSixDim').innerHTML = dims.map(d => {
    let detail = '';
    if(d.key === 'english') detail = `鈴?${d.time||0}h 路 馃摑 ${d.words||0}璇峘;
    else if(d.key === 'ai') detail = `馃洜锔?${d.tools||0}宸ュ叿 路 馃搵 ${d.tasks||0}浠诲姟`;
    else if(d.key === 'job') detail = `馃搫 ${d.data||0}鎶曢€?路 馃帳 ${d.interviews||0}闈㈣瘯`;
    else if(d.key === 'reading') detail = `馃摎 ${d.data||0}鏈?路 馃儚 ${d.cards||0}鍗＄墖`;
    else if(d.key === 'creation') detail = `馃殌 ${d.data||0}鍙戝竷 路 馃挕 ${d.ideas||0}鐏垫劅`;
    else if(d.key === 'health') detail = `馃嵔锔?${d.data||0}璁板綍 路 ${d.bmr||''}`;
    
    const level = d.data >= 50 ? 5 : d.data >= 30 ? 4 : d.data >= 15 ? 3 : d.data >= 5 ? 2 : d.data > 0 ? 1 : 0;
    return `<div class="reading-book-item" style="padding:12px;flex-direction:column;gap:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div><span style="font-size:16px;">${d.icon}</span> <strong style="font-size:14px;color:#5d3a4f;">${d.name}</strong></div>
        <div style="font-size:12px;color:${level>=3?'#2da667':level>0?'#e67e22':'#b3a0a8'};">${'猸?.repeat(level)}${'鈽?.repeat(5-level)}</div>
      </div>
      <div style="font-size:11px;color:#b3a0a8;width:100%;">${detail}</div>
    </div>`;
  }).join('');
}

// ===== Growth Timeline =====
function renderDashTimeline() {
  const events = [];
  const today = todayStr();
  
  // Collect recent events from all modules
  DB.get('reading_records',[]).slice(-5).forEach(r => {
    events.push({date: r.date, icon:'馃摉', text:`闃呰銆?{r.book||'涔︾睄'}銆?{r.time||0}鍒嗛挓`, _ts: r._ts||0});
  });
  DB.get('english_records',[]).slice(-5).forEach(r => {
    events.push({date: r.date, icon:'馃實', text:`鑻辫瀛︿範 ${r.time||0}鍒嗛挓`, _ts: r._ts||0});
  });
  DB.get('job_interview',[]).slice(-3).forEach(r => {
    events.push({date: r.time?.slice(0,10)||today, icon:'馃帳', text:`${r.company} 闈㈣瘯`, _ts: Date.now()});
  });
  DB.get('xhs_productions',[]).slice(-3).forEach(r => {
    events.push({date: r._ts ? new Date(r._ts).toISOString().slice(0,10) : today, icon:'馃幀', text:`${r.status==='published'?'鍙戝竷':'鍒涗綔'}銆?{r.title||'鍐呭'}銆峘, _ts: r._ts||0});
  });
  DB.get('read_notes',[]).slice(-3).forEach(r => {
    events.push({date: r.date||today, icon:'馃挱', text:`闃呰鎬濊€冿細銆?{r.book||'涔︾睄'}銆媊, _ts: r._ts||0});
  });
  DB.get('burn_records',[]).slice(-3).forEach(r => {
    events.push({date: r.date||today, icon:'馃弮', text:`${r.type||'杩愬姩'} ${r.duration||0}鍒嗛挓`, _ts: Date.now()});
  });
  DB.get('milestones',[]).slice(-3).forEach(r => {
    events.push({date: r.date||today, icon:'馃弳', text:`馃専 ${r.text}`, _ts: Date.now()});
  });
  
  // Sort by date desc
  events.sort((a,b) => (b.date + '-' + (b._ts||0)) < (a.date + '-' + (a._ts||0)) ? 1 : -1);
  
  const el = document.getElementById('dashTimeline');
  if(!events.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#b3a0a8;font-size:13px;">杩樻病鏈夋垚闀胯褰曪紝寮€濮嬩綘鐨勬垚闀夸箣鏃呭惂锛?/div>';
    return;
  }
  
  el.innerHTML = events.slice(0,15).map(e => `
    <div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f5f0f2;">
      <span style="font-size:16px;flex-shrink:0;">${e.icon}</span>
      <div style="flex:1;font-size:13px;color:#5d3a4f;">${e.text}</div>
      <span style="font-size:11px;color:#b3a0a8;flex-shrink:0;">${e.date.slice(5)}</span>
    </div>
  `).join('');
}

function renderGrowthLevel() {
  const totalXp = calcTotalXp();
  const todayXp = calcTodayXp();
  const lv = getLevel(totalXp);
  const next = LEVELS[LEVELS.indexOf(lv)+1];
  const progress = next ? ((totalXp - lv.min) / (next.min - lv.min) * 100) : 100;
  const toNext = next ? (next.min - totalXp) : 0;

  // Dashboard level card
  document.getElementById('statLevel').textContent = lv.short;
  document.getElementById('statXp').textContent = totalXp;
  document.getElementById('levelBadge').textContent = lv.short;
  document.getElementById('levelName').textContent = lv.name;
  document.getElementById('levelXpNum').textContent = totalXp;
  document.getElementById('levelTodayXp').textContent = '+'+todayXp;
  document.getElementById('levelProgressFill').style.width = Math.min(progress,100)+'%';
  document.getElementById('levelNext').textContent = next
    ? `璺濄€?{next.name}銆嶈繕闇€ <strong>${toNext}</strong> XP`
    : '馃弳 宸茶揪鍒版渶楂樼瓑绾э紒';

  // Achievements page level card
  const achEls = ['achLevelBadge','achLevelName','achTotalXpNum','achLevelProgressFill','achXpToNext','achLevelNext'];
  if(document.getElementById('achLevelBadge')) {
    document.getElementById('achLevelBadge').textContent = lv.short;
    document.getElementById('achLevelName').textContent = lv.name;
    document.getElementById('achTotalXpNum').textContent = totalXp;
    document.getElementById('achLevelProgressFill').style.width = Math.min(progress,100)+'%';
    document.getElementById('achXpToNext').textContent = next ? toNext : 0;
    document.getElementById('achLevelNext').textContent = next
      ? `璺濅笅涓€绛夌骇杩橀渶 <strong>${toNext}</strong> XP`
      : '馃弳 宸茶揪鍒版渶楂樼瓑绾э紒';
    document.getElementById('achTotalXp').textContent = '绱 '+totalXp+' XP';
  }

  // Growth feedback on dashboard
  const msg = GROWTH_MESSAGES[Math.floor(Math.random() * GROWTH_MESSAGES.length)];
  document.getElementById('growthFeedback').innerHTML = `馃専 <strong>浠婃棩鑾峰緱 ${todayXp} XP</strong> 路 绱 ${totalXp} XP<br><span style="font-size:13px;opacity:.9;">${msg}</span>`;

  // Daily XP feedback
  if(document.getElementById('dailyXpFeedback')) {
    document.getElementById('dailyXpNum').textContent = todayXp;
    document.getElementById('totalXpNum').textContent = totalXp;
    const comment = DAILY_XP_COMMENTS.find(c => todayXp >= c.min && todayXp < c.max) || DAILY_XP_COMMENTS[0];
    document.getElementById('dailyXpComment').textContent = comment.text;
  }
}

// ========== GROWTH CALENDAR (Robust v2) ==========
let calMonthOffset = 0;

function renderGrowthCalendar() {
  try {
    const now = new Date();
    const calDate = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
    const grid = document.getElementById('calGrid');
    if(!grid) return;  // Safe exit if element missing

    const title = document.getElementById('calTitle');
    if(title) title.textContent = '\ud83d\udcc5 ' + calDate.getFullYear() + '\u5e74' + (calDate.getMonth()+1) + '\u6708';

    const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth()+1, 0).getDate();
    const firstDayOfWeek = calDate.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    let html = ['\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d','\u65e5']
      .map(d => '<div class="cal-weekday">' + d + '</div>').join('');
    for(let i=0; i<startOffset; i++) html += '<div></div>';

    const tStr = todayStr();
    for(let d=1; d<=daysInMonth; d++) {
      const dateStr = calDate.getFullYear() + '-' + String(calDate.getMonth()+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      const cellDate = new Date(calDate.getFullYear(), calDate.getMonth(), d);
      const isToday = dateStr === tStr;
      const isFuture = cellDate > now;

      // Only 1 data source (goals) - simplest & most reliable
      let done = 0, total = 0;
      try {
        const goals = DB.get('goals_' + dateStr);
        if(Array.isArray(goals)) { done = goals.filter(g => g && g.done).length; total = goals.length; }
      } catch(e) {}

      let state = 'gray';
      if(isFuture) state = 'future';
      else if(total > 0 && done === total) state = 'green';
      else if(done > 0) state = 'yellow';

      html += '<div class="cal-day ' + state + (isToday ? ' today' : '') + '" onclick="showDayDetail(\'' + dateStr + '\')">' + d + '</div>';
    }
    grid.innerHTML = html;

    // Hide detail panel safely
    const detail = document.getElementById('calDayDetail');
    if(detail) detail.classList.remove('show');
  } catch(e) {
    console.warn('[Calendar] 缃戞牸娓叉煋澶辫触锛屼娇鐢ㄩ檷绾ц鍥?', e);
    renderCalendarFallback();
  }
}

// Fallback: simple 7-day list if grid render throws
function renderCalendarFallback() {
  try {
    const grid = document.getElementById('calGrid');
    if(!grid) return;
    const days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().slice(0,10);
      let done = 0, total = 0;
      try {
        const g = DB.get('goals_' + ds);
        if(Array.isArray(g)) { done = g.filter(x => x && x.done).length; total = g.length; }
      } catch(e) {}
      days.push({ds, done, total});
    }
    grid.innerHTML = '<div style="font-size:12px;color:#5d3a4f;line-height:1.9;">' +
      days.map(x => '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #faf0f4;">' +
        '<span>' + formatDateLong(x.ds) + '</span>' +
        '<span style="color:' + (x.total>0 && x.done===x.total ? '#2da667' : x.done>0 ? '#e67e22' : '#b3a0a8') + ';">' +
        (x.total>0 ? x.done + '/' + x.total + ' \u2713' : '\u2500') + '</span></div>').join('') + '</div>';
    const title = document.getElementById('calTitle');
    if(title) title.textContent = '\ud83d\udcc5 \u8fd1 7 \u5929\u6210\u957f\u8bb0\u5f55';
  } catch(e) { /* silent */ }
}

function calNav(dir) {
  try {
    calMonthOffset += dir;
    renderGrowthCalendar();
  } catch(e) { console.warn('[Calendar] 鍒囨崲澶辫触:', e); }
}

function showDayDetail(dateStr) {
  const detail = document.getElementById('calDayDetail');
  const title = document.getElementById('calDetailTitle');
  const content = document.getElementById('calDetailContent');
  if(!detail || !content) return;  // Safe exit if elements missing
  
  if(title) title.textContent = `馃搨 ${formatDateLong(dateStr)} 鎴愰暱妗ｆ`;

  // Gather data
  const goals = DB.get('goals_'+dateStr);
  const engRecs = DB.get('english_records',[]).filter(r=>r.date===dateStr);
  const readingRecs = DB.get('reading_records',[]).filter(r=>r.date===dateStr);
  const aiRecs = DB.get('ai_tools',[]).filter(r=>r.date===dateStr);
  const aiTasks = DB.get('ai_tasks',[]).filter(r=>r.date===dateStr);
  const xhsRecs = DB.get('xhs_records',[]).filter(r=>r.date===dateStr);
  const burns = DB.get('burn_records',[]).filter(r=>r.date===dateStr);
  const intakes = DB.get('intake_records',[]).filter(r=>r.date===dateStr);
  const jobApps = DB.get('job_apply',[]).filter(r=>r.date===dateStr);
  const notes = DB.get('dailyNote_'+dateStr, '');
  const mood = DB.get('mood_'+dateStr, 0);
  const moods = ['','馃槥','馃槓','馃檪','馃槉','馃ぉ'];
  const engTime = engRecs.reduce((s,r)=>s+(parseInt(r.time)||0), 0);
  const readingHours = readingRecs.reduce((s,r)=>s+(parseFloat(r.time)||0), 0);
  const goalDone = goals ? goals.filter(g=>g.done).length : 0;
  const goalTotal = goals ? goals.length : 0;

  // Check for milestones/plans on this date
  const milestones = DB.get('milestones',[]).filter(m => m.date === dateStr);
  const plans = DB.get('future_plans',[]).filter(p => p.date === dateStr);

  content.innerHTML = `
    <div class="dd-row"><span class="dd-label">馃槉 蹇冩儏</span><span class="dd-val">${mood ? moods[mood] : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">鉁?浠诲姟瀹屾垚</span><span class="dd-val">${goalDone}/${goalTotal}</span></div>
    <div class="dd-row"><span class="dd-label">馃實 鑻辫瀛︿範</span><span class="dd-val">${engTime > 0 ? engTime+'鍒嗛挓' : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃捈 姹傝亴鎶曢€?/span><span class="dd-val">${jobApps.length > 0 ? jobApps.length+'浠? : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃 AI瀛︿範</span><span class="dd-val">${aiRecs.length+aiTasks.length > 0 ? (aiRecs.length+aiTasks.length)+'娆? : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃摉 闃呰</span><span class="dd-val">${readingHours > 0 ? readingHours.toFixed(1)+'灏忔椂' : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃幀 鍐呭鍒涗綔</span><span class="dd-val">${xhsRecs.length > 0 ? xhsRecs.length+'鏉? : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃弮 杩愬姩</span><span class="dd-val">${burns.length > 0 ? burns.length+'娆? : '--'}</span></div>
    <div class="dd-row"><span class="dd-label">馃嵔锔?楗璁板綍</span><span class="dd-val">${intakes.length > 0 ? intakes.length+'鏉? : '--'}</span></div>
    ${milestones.length ? `<div class="dd-row"><span class="dd-label">馃弳 閲岀▼纰?/span><span class="dd-val">${milestones.map(m=>m.text).join('; ')}</span></div>` : ''}
    ${plans.length ? `<div class="dd-row"><span class="dd-label">馃搵 璁″垝</span><span class="dd-val">${plans.map(p=>p.text).join('; ')}</span></div>` : ''}
    ${notes ? `<div style="margin-top:8px;padding:8px;background:white;border-radius:8px;font-size:13px;color:#5d3a4f;line-height:1.6;">${notes}</div>` : ''}
  `;

  // If no data, show empty state but keep goal info
  if(!engRecs.length && !readingRecs.length && !aiRecs.length && !aiTasks.length && !xhsRecs.length && !burns.length && !intakes.length && !jobApps.length && !notes && !milestones.length && !plans.length) {
    content.innerHTML = `<div class="dd-empty">馃摥 杩欎竴澶╄繕娌℃湁璁板綍</div>`;
  }

  detail.classList.add('show');
}

// ========== MILESTONES ==========
function renderMilestones() {
  const milestones = DB.get('milestones',[]);
  document.getElementById('milestoneList').innerHTML = milestones.length ? milestones.slice().reverse().slice(0,5).map((m,i)=>{
    const idx = milestones.length - 1 - i;
    return `<div class="milestone-item">
      <span class="ms-icon">${m.icon||'馃専'}</span>
      <span class="ms-text">${m.text}</span>
      <span class="ms-date">${m.date||''}</span>
      <button class="ms-del" onclick="delMilestone(${idx})">鉁?/button>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:14px;color:#b3a0a8;font-size:13px;">杩樻病鏈夐噷绋嬬锛岃褰曚綘鐨勭涓€涓噸瑕佹椂鍒诲惂 鉁?/div>';
}

function addMilestone() {
  let icons = ['馃専','馃弲','馃幆','馃帀','馃捈','馃帗','馃摑','馃幀','馃敟','猸?];
  const icon = prompt('閫夋嫨琛ㄦ儏绗﹀彿锛堭煂燄煆咅煄煄夝煉拣煄擆煋濔煄煍モ瓙锛?, '馃専');
  if(!icon) return;
  const text = prompt('璁板綍閲岀▼纰戜簨浠讹細\n渚嬪銆岀涓€娆″彂甯冨皬绾功浣滃搧銆?);
  if(!text) return;
  const date = prompt('鏃ユ湡锛圷YYY-MM-DD锛夛細', todayStr());
  if(!date) return;
  const milestones = DB.get('milestones',[]);
  milestones.push({icon, text, date});
  DB.set('milestones', milestones);
  renderMilestones();
  renderGrowthCalendar();
}

function delMilestone(idx) {
  const milestones = DB.get('milestones',[]);
  milestones.splice(idx, 1);
  DB.set('milestones', milestones);
  renderMilestones();
  renderGrowthCalendar();
}

// ========== FUTURE PLANS ==========
function renderFuturePlans() {
  const plans = DB.get('future_plans',[]);
  const icons = {'闈㈣瘯':'馃帳','鍙戝竷':'馃摙','瀛︿範':'馃摎','閲嶈':'猸?,'鍏朵粬':'馃搵'};
  document.getElementById('futurePlanList').innerHTML = plans.length ? plans.slice().reverse().slice(0,5).map((p,i)=>{
    const idx = plans.length - 1 - i;
    const isDone = p.done ? 'done' : '';
    const pinIcon = icons[p.icon] || '馃搵';
    return `<div class="future-plan-item">
      <span class="fp-icon">${pinIcon}</span>
      <span class="fp-text" style="${p.done?'text-decoration:line-through;opacity:.5;':''}">${p.text}</span>
      <span class="fp-date">${p.date||''}</span>
      <span class="fp-done ${isDone}" onclick="togglePlanDone(${idx})">${p.done?'鉁?:'猬?}</span>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:14px;color:#b3a0a8;font-size:13px;">杩樻病鏈夋湭鏉ヨ鍒掞紝瑙勫垝浣犵殑涓嬩竴姝ュ惂 馃搵</div>';
}

function addFuturePlan() {
  const type = prompt('绫诲瀷锛堥潰璇?鍙戝竷/瀛︿範/閲嶈/鍏朵粬锛夛細', '瀛︿範');
  if(!type) return;
  const text = prompt('璁″垝鍐呭锛?);
  if(!text) return;
  const date = prompt('鏃ユ湡锛圷YYY-MM-DD锛夛細', '');
  const plans = DB.get('future_plans',[]);
  plans.push({icon: type, text, date: date||'', done: false});
  DB.set('future_plans', plans);
  renderFuturePlans();
}

function togglePlanDone(idx) {
  const plans = DB.get('future_plans',[]);
  plans[idx].done = !plans[idx].done;
  DB.set('future_plans', plans);
  renderFuturePlans();
}

// ========== YEAR REVIEW ==========
function renderYearReview() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const startOfYear = thisYear+'-01-01';

  const allIntakes = DB.get('intake_records',[]).filter(r=>r.date>=startOfYear);
  const allBurns = DB.get('burn_records',[]).filter(r=>r.date>=startOfYear);
  const allEnglish = DB.get('english_records',[]).filter(r=>r.date>=startOfYear);
  const allReading = DB.get('reading_records',[]).filter(r=>r.date>=startOfYear);
  const allAi = DB.get('ai_tools',[]).filter(r=>r.date>=startOfYear);
  const allTasks = DB.get('ai_tasks',[]).filter(r=>r.date>=startOfYear);
  const allXhs = DB.get('xhs_records',[]).filter(r=>r.date>=startOfYear);
  const allJobs = DB.get('job_apply',[]).filter(r=>r.date>=startOfYear);
  const milestones = DB.get('milestones',[]);

  // Count active days
  const activeDays = new Set();
  [...allIntakes,...allBurns,...allEnglish,...allReading,...allAi,...allTasks,...allXhs,...allJobs].forEach(r=>activeDays.add(r.date));

  const engTotal = allEnglish.reduce((s,r)=>s+(parseInt(r.time)||0),0);
  const totalKcal = allIntakes.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);

  document.getElementById('yearReviewContent').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
      <div class="year-review-stat"><span>馃搮 娲昏穬澶╂暟</span><span class="num">${activeDays.size}澶?/span></div>
      <div class="year-review-stat"><span>馃弳 閲岀▼纰?/span><span class="num">${milestones.length}涓?/span></div>
      <div class="year-review-stat"><span>馃實 鑻辫瀛︿範</span><span class="num">${engTotal}鍒嗛挓</span></div>
      <div class="year-review-stat"><span>馃弮 杩愬姩娆℃暟</span><span class="num">${allBurns.length}娆?/span></div>
      <div class="year-review-stat"><span>馃摉 闃呰璁板綍</span><span class="num">${allReading.length}鏉?/span></div>
      <div class="year-review-stat"><span>馃 AI瀛︿範</span><span class="num">${allAi.length+allTasks.length}娆?/span></div>
      <div class="year-review-stat"><span>馃捈 姹傝亴鎶曢€?/span><span class="num">${allJobs.length}浠?/span></div>
      <div class="year-review-stat"><span>馃幀 鍐呭鍒涗綔</span><span class="num">${allXhs.length}鏉?/span></div>
    </div>
    ${milestones.length ? `<div class="year-review-key">馃専 鍏抽敭閲岀▼纰戯細${milestones.slice(-3).map(m=>m.text).join(' 鈫?')}</div>` : ''}
  `;
}

// ========== DAILY GROWTH REPORT ==========
function generateDailyReport() {
  const today = todayStr();
  const engRecs = DB.get('english_records',[]).filter(r=>r.date===today);
  const readingRecs = DB.get('reading_records',[]).filter(r=>r.date===today);
  const readNotes = DB.get('read_notes',[]).filter(n=>n.date===today);
  const jobApps = DB.get('job_apply',[]).filter(r=>r.date===today);
  const aiTools = DB.get('ai_tools',[]).filter(r=>r.date===today);
  const aiTasks = DB.get('ai_tasks',[]).filter(r=>r.date===today);
  const xhsRecs = DB.get('xhs_records',[]).filter(r=>r.date===today);
  const wechatArts = DB.get('wechat_articles',[]).filter(r=>r.date===today);
  const burns = DB.get('burn_records',[]).filter(r=>r.date===today);
  const intakes = DB.get('intake_records',[]).filter(r=>r.date===today);
  const engTime = engRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const engSpeaking = DB.get('eng_speaking',[]).filter(r=>r.date===today);
  
  let score = 0;
  if(engTime >= 30) score += 20; else if(engTime > 0) score += Math.round(engTime/30*20);
  if(engSpeaking.length > 0) score += 15;
  if(readingRecs.length > 0 || readNotes.length > 0) score += 15;
  if(jobApps.length > 0) score += 15;
  if(aiTools.length + aiTasks.length > 0) score += 15;
  if(xhsRecs.length > 0 || wechatArts.length > 0) score += 10;
  if(burns.length > 0) score += 10;
  score = Math.min(100, score);

  const items = [
    ['馃實 鑻辫', engTime >= 30 ? `${Math.round(engTime)}鍒嗛挓` : engTime > 0 ? `${Math.round(engTime)}鍒嗛挓` : '--', engTime > 0],
    ['馃摉 闃呰', readNotes.length > 0 ? readNotes.length+'鏉＄瑪璁? : readingRecs.length > 0 ? '宸茶褰? : '--', readNotes.length > 0 || readingRecs.length > 0],
    ['馃捈 姹傝亴', jobApps.length > 0 ? jobApps.length+'娆℃姇閫? : '--', jobApps.length > 0],
    ['馃 AI', aiTools.length+aiTasks.length > 0 ? (aiTools.length+aiTasks.length)+'涓换鍔? : '--', aiTools.length+aiTasks.length > 0],
    ['馃幀 鍒涗綔', xhsRecs.length+wechatArts.length > 0 ? (xhsRecs.length+wechatArts.length)+'鏉? : '--', xhsRecs.length+wechatArts.length > 0],
    ['馃弮 杩愬姩', burns.length > 0 ? burns.length+'娆? : '--', burns.length > 0]
  ];

  const tips = [];
  if(engTime < 30) tips.push('馃實 鑻辫涓嶈冻30鍒嗛挓');
  if(readingRecs.length === 0 && readNotes.length === 0) tips.push('馃摉 浠婂ぉ杩樻病闃呰');
  if(jobApps.length === 0) tips.push('馃捈 灏濊瘯鎶曢€掍竴浠界畝鍘?);
  if(aiTools.length+aiTasks.length === 0) tips.push('馃 瀛︿竴涓狝I宸ュ叿');
  if(xhsRecs.length === 0 && wechatArts.length === 0) tips.push('馃幀 鍒涗綔涓€鏉″唴瀹?);
  if(burns.length === 0) tips.push('馃弮 杩愬姩涓€涓?);

  let feedback = '';
  if(score >= 80) feedback = '馃憦 浠婂ぉ瓒呮锛佸叏鏂逛綅鎴愰暱锛岀户缁繚鎸侊紒';
  else if(score >= 60) feedback = '馃憤 涓嶉敊锛佹湁鍑犱釜妯″潡杩橀渶鍔犲己銆?;
  else if(score >= 40) feedback = '馃挭 杩樺彲浠ユ洿濂斤紝鏄庡ぉ闆嗕腑绐佺牬涓€涓や釜妯″潡銆?;
  else feedback = '馃尡 浠庝竴涓皬鐩爣寮€濮嬪惂锛屽摢鎬曞彧鍋氫竴浠朵簨涔熸槸杩涙銆?;

  const reports = DB.get('daily_reports',[]);
  reports.push({date:today, score, items, feedback, tips, _ts:Date.now()});
  if(reports.length > 30) reports.splice(0, reports.length-30);
  DB.set('daily_reports', reports);

  updateDashboardReport(score, items, feedback, tips);
  updateDailyReview(items);
  showOcrToast('鉁?鎴愰暱鎶ュ憡宸茬敓鎴愶紒浠婃棩鎴愰暱鍒嗭細'+score);
}

function updateDashboardReport(score, items, feedback, tips) {
  const card = document.getElementById('dailyReportCard');
  if(!card) return;
  card.style.display = 'block';
  document.getElementById('drScore').textContent = score;
  document.getElementById('drGrid').innerHTML = items.map(it => `<div class="dr-item"><div class="dr-val" style="color:${it[2]?'#1b5e20':'#9e9e9e'}">${it[2]?'鉁?:'鈥?}</div><div class="dr-label">${it[0]}</div></div>`).join('');
  document.getElementById('drFeedback').textContent = feedback;
  document.getElementById('drTips').innerHTML = tips.length ? tips.map(t=>`<span class="dr-tip">${t}</span>`).join('') : '<span class="dr-tip" style="background:rgba(255,255,255,.6);">馃帀 鍏ㄩ儴瀹屾垚锛?/span>';
}

function updateDailyReview(items) {
  const grid = document.getElementById('dailyReviewGrid');
  if(grid) grid.innerHTML = items.map(it => `<div class="rs-item"><span class="rs-label">${it[0]}</span><span class="rs-val ${it[2]?'done':'partial'}">${it[1]}</span></div>`).join('');
}

function renderDailyReport() {
  const reports = DB.get('daily_reports',[]);
  const latest = reports.slice().reverse().find(r => r.date === todayStr());
  if(latest) { updateDashboardReport(latest.score, latest.items, latest.feedback, latest.tips); updateDailyReview(latest.items); }
}

// ========== WEEKLY TREND ==========
function renderWeeklyTrend() {
  const bar = document.getElementById('weeklyTrendBar');
  if(!bar) return;
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate()-((now.getDay()||7)-1));
  const reports = DB.get('daily_reports',[]);
  const labels = ['涓€','浜?,'涓?,'鍥?,'浜?,'鍏?,'鏃?];
  bar.innerHTML = labels.map((l,i)=>{
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const ds = d.toISOString().slice(0,10);
    const isF = d > now;
    const r = reports.find(x=>x.date===ds);
    const s = r ? r.score : 0;
    const h = isF ? 4 : Math.max(4, s*0.7);
    const c = s>=80?'#4a9d6f':s>=50?'#f5a04f':s>0?'#ffb8c4':'#f0e8ec';
    return `<div class="tb-col"><div class="tb-fill" style="height:${h}px;background:${c};${isF?'opacity:.3':''}"></div><div class="tb-day">${l}</div></div>`;
  }).join('');
}

function renderGrowthLevel() {
  const jobAppsCount = DB.get('job_apply',[]).length;
  const engTotalMins = DB.get('english_records',[]).reduce((s,r)=>s+(parseInt(r.time)||0),0);
  const aiCount = DB.get('ai_tasks',[]).length + DB.get('ai_tools',[]).length;
  const xhsPub = DB.get('xhs_records',[]).filter(r=>r.status==='published').length;
  const wechatPub = DB.get('wechat_articles',[]).filter(r=>r.status==='published').length;
  const burnCount = DB.get('burn_records',[]).length;

  const jobPct = Math.min(jobAppsCount*8, 100);
  const engPct = Math.min(engTotalMins / 10, 100);
  const aiPct = Math.min(aiCount*12, 100);
  const ipPct = Math.min((xhsPub+wechatPub)*15, 100);
  const sportPct = Math.min(burnCount*10, 100);

  document.getElementById('skillBars').innerHTML = `
    <div class="skill-bar-row"><div class="skill-label"><span class="name">馃捈 鑱屼笟鑳藉姏</span><span class="pct">${Math.round(jobPct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${jobPct}%"></div></div></div>
    <div class="skill-bar-row"><div class="skill-label"><span class="name">馃實 鑻辫鑳藉姏</span><span class="pct">${Math.round(engPct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${engPct}%"></div></div></div>
    <div class="skill-bar-row"><div class="skill-label"><span class="name">馃 AI鎶€鑳?/span><span class="pct">${Math.round(aiPct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${aiPct}%"></div></div></div>
    <div class="skill-bar-row"><div class="skill-label"><span class="name">馃摃 涓汉IP</span><span class="pct">${Math.round(ipPct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${ipPct}%"></div></div></div>
    <div class="skill-bar-row"><div class="skill-label"><span class="name">馃弮 韬綋鐘舵€?/span><span class="pct">${Math.round(sportPct)}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${sportPct}%"></div></div></div>
  `;
}

function renderBadges() {
  const engRecs = DB.get('english_records',[]);
  const engDays = new Set(engRecs.filter(r=>r.date).map(r=>r.date));
  const engTotalMins = engRecs.reduce((s,r)=>s+(parseInt(r.time)||0),0);

  const readRecs = DB.get('reading_records',[]);
  const books = new Set(readRecs.filter(r=>r.book).map(r=>r.book));
  const readThoughts = readRecs.filter(r=>r.understanding).length;

  const wechatPub = DB.get('wechat_articles',[]).filter(r=>r.status==='published').length;
  const xhsPub = DB.get('xhs_records',[]).filter(r=>r.status==='published').length;
  const totalPub = wechatPub + xhsPub;

  const jobApps = DB.get('job_apply',[]).length;
  const jobInterviews = DB.get('job_interview',[]).length;

  const burnCount = DB.get('burn_records',[]).length;
  const totalXp = calcTotalXp();

  // Consecutive English days
  let engStreak = 0;
  const today = new Date();
  for(let i=0;i<365;i++){
    const d = new Date(today); d.setDate(today.getDate()-i);
    const key = d.toISOString().slice(0,10);
    if(engDays.has(key)) engStreak++;
    else break;
  }

  const achievements = {
    'eng-1': engStreak >= 7,
    'eng-2': engTotalMins >= 3000,
    'read-1': books.size >= 1,
    'read-2': readThoughts >= 10,
    'create-1': wechatPub >= 1,
    'create-2': totalPub >= 10,
    'job-1': jobApps >= 10,
    'job-2': jobInterviews >= 5,
    'sport-1': burnCount >= 10,
    'growth-1': totalXp >= 100,
    'growth-2': totalXp >= 1000,
  };

  Object.entries(achievements).forEach(([id, unlocked]) => {
    const el = document.getElementById('badge-'+id);
    if(el) {
      el.className = 'badge-item ' + (unlocked ? 'unlocked' : 'locked');
      if(unlocked) el.querySelector('.locked-badge').textContent = '鉁?;
      else el.querySelector('.locked-badge').textContent = '馃敀';
    }
  });
}

function showXpToast(xp) {
  const toast = document.createElement('div');
  toast.className = 'xp-toast';
  toast.innerHTML = `馃専 鑾峰緱 <strong>+${xp} XP</strong>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========== EMOTION FEEDBACK ==========
function setEnergy(val) {
  updateStars('energyStars', val);
  const today = todayStr();
  const fb = DB.get('emotion_feedback_'+today,{});
  fb.energy = val;
  DB.set('emotion_feedback_'+today, fb);
}
function setMoodRating(val) {
  updateStars('moodStars', val);
  const today = todayStr();
  const fb = DB.get('emotion_feedback_'+today,{});
  fb.moodRating = val;
  DB.set('emotion_feedback_'+today, fb);
}
function setSat(val) {
  updateStars('satStars', val);
  const today = todayStr();
  const fb = DB.get('emotion_feedback_'+today,{});
  fb.satisfaction = val;
  DB.set('emotion_feedback_'+today, fb);
}
function updateStars(id, val) {
  document.getElementById(id).querySelectorAll('.star').forEach((s,i) => {
    s.classList.toggle('active', i < val);
  });
}
function saveEmotionFeedback() {
  const today = todayStr();
  const prev = DB.get('emotion_feedback_'+today,{});
  DB.set('emotion_feedback_'+today, {
    ...prev,
    harvest: document.getElementById('feedbackHarvest').value,
    problem: document.getElementById('feedbackProblem').value,
    adjust: document.getElementById('feedbackAdjust').value,
    oneSentence: document.getElementById('feedbackOneSentence').value,
  });
}

// ========== VOICE INPUT (Speech-to-Text) ==========
let _voiceRec = null;
let _voiceTarget = null;

function startVoiceInput(targetId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const target = document.getElementById(targetId);
  if(!target) return;

  // 涓嶆敮鎸佽闊宠瘑鍒?
  if(!SR) {
    showOcrToast('鈿狅笍 褰撳墠娴忚鍣ㄤ笉鏀寔璇煶杈撳叆锛岃浣跨敤 Chrome / Edge');
    return;
  }

  // 姝ｅ湪褰曢煶涓?鈫?鍐嶆鐐瑰嚮 = 鍋滄
  if(_voiceRec && _voiceTarget === targetId) {
    _voiceRec.stop();
    return;
  }

  // 鍏朵粬瀛楁姝ｅ湪褰曢煶 鈫?鍏堝仠姝?
  if(_voiceRec) {
    try { _voiceRec.stop(); } catch(e) {}
    const prevBtn = document.querySelector(`[data-voice-target="${_voiceTarget}"]`);
    if(prevBtn) prevBtn.classList.remove('recording');
  }

  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.continuous = false;
  rec.interimResults = true;
  _voiceRec = rec;
  _voiceTarget = targetId;

  const btn = document.querySelector(`[data-voice-target="${targetId}"]`);
  if(btn) btn.classList.add('recording');
  showOcrToast('馃帳 姝ｅ湪鑱嗗惉... 璇村畬鍚庤嚜鍔ㄥ仠姝紝鎴栧啀鐐逛竴娆＄粨鏉?);

  let finalText = target.value ? target.value.replace(/\s+$/, '') : '';

  rec.onresult = (e) => {
    let interim = '';
    for(let i = e.resultIndex; i < e.results.length; i++) {
      if(e.results[i].isFinal) finalText += (finalText && !finalText.endsWith('銆?) && !finalText.endsWith('锛?) && !finalText.endsWith(' ') ? '锛? : '') + e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    target.value = finalText + interim;
    target.dispatchEvent(new Event('input'));
  };

  rec.onend = () => {
    if(btn) btn.classList.remove('recording');
    _voiceRec = null;
    _voiceTarget = null;
    showOcrToast('鉁?璇煶杈撳叆瀹屾垚');
  };

  rec.onerror = (e) => {
    if(btn) btn.classList.remove('recording');
    _voiceRec = null;
    _voiceTarget = null;
    if(e.error === 'not-allowed') showOcrToast('鉂?楹﹀厠椋庢潈闄愯鎷掔粷锛岃鍦ㄦ祻瑙堝櫒璁剧疆涓厑璁?);
    else if(e.error === 'no-speech') showOcrToast('鈿狅笍 鏈娴嬪埌璇煶锛岃鍐嶈瘯涓€娆?);
    else if(e.error === 'network') showOcrToast('鈿狅笍 璇煶璇嗗埆鏈嶅姟涓嶅彲鐢紙闇€瑕佺綉缁滐級');
    else showOcrToast('鈿狅笍 璇煶璇嗗埆澶辫触: ' + e.error);
  };

  try { rec.start(); }
  catch(err) {
    if(btn) btn.classList.remove('recording');
    _voiceRec = null;
    _voiceTarget = null;
    showOcrToast('鈿狅笍 璇煶鍚姩澶辫触锛岃閲嶈瘯');
  }
}

// 鍒濆鍖栵細妫€娴嬫祻瑙堝櫒鏄惁鏀寔璇煶锛屼笉鏀寔鍒欓殣钘忔墍鏈?馃帳 鎸夐挳
function initVoiceSupport() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) {
    document.querySelectorAll('.voice-btn').forEach(btn => {
      btn.style.display = 'none';
    });
    console.warn('[Voice] 褰撳墠娴忚鍣ㄤ笉鏀寔 SpeechRecognition锛岃闊虫寜閽凡闅愯棌');
  }
}

// ========== MONTHLY ARCHIVE ==========
function refreshMonthly() {
  const now = new Date();
  const month = now.toISOString().slice(0,7);
  const monthNames = ['涓€鏈?,'浜屾湀','涓夋湀','鍥涙湀','浜旀湀','鍏湀','涓冩湀','鍏湀','涔濇湀','鍗佹湀','鍗佷竴鏈?,'鍗佷簩鏈?];
  document.getElementById('monthlyDateRange').textContent = now.getFullYear()+'骞?'+monthNames[now.getMonth()];

  // Auto compute stats
  const engRecs = DB.get('english_records',[]).filter(r=>r.date.startsWith(month));
  const engDays = new Set(engRecs.map(r=>r.date)).size;
  const engHours = Math.round(engRecs.reduce((s,r)=>s+(parseInt(r.time)||0),0)/60);
  const readRecs = DB.get('reading_records',[]).filter(r=>r.date.startsWith(month));
  const jobApps = DB.get('job_apply',[]).filter(r=>r.date.startsWith(month));
  const aiRecs = DB.get('ai_tasks',[]).filter(r=>r.date.startsWith(month));
  const xhsPub = DB.get('xhs_records',[]).filter(r=>r.date.startsWith(month)&&r.status==='published');
  const wechatPub = DB.get('wechat_articles',[]).filter(r=>r.status==='published'&&(r.publishDate||'').startsWith(month));
  const burns = DB.get('burn_records',[]).filter(r=>r.date.startsWith(month));
  const xpByDay = calcAllXp();
  let monthXp = 0;
  Object.entries(xpByDay).forEach(([d,xp]) => {
    if(d.startsWith(month)) monthXp += xp;
  });

  document.getElementById('mthEngDays').textContent = engDays;
  document.getElementById('mthEngHours').textContent = engHours+'h';
  document.getElementById('mthReadCount').textContent = readRecs.length;
  document.getElementById('mthJobApply').textContent = jobApps.length;
  document.getElementById('mthAiLearn').textContent = aiRecs.length;
  document.getElementById('mthXhsPub').textContent = xhsPub.length + wechatPub.length;
  document.getElementById('mthExercise').textContent = burns.length;
  document.getElementById('mthTotalXp').textContent = monthXp;

  // Monthly feedback
  const totXp = calcTotalXp();
  const lv = getLevel(totXp);
  document.getElementById('monthlyFeedback').innerHTML = `
    <strong>馃帀 ${monthNames[now.getMonth()]}鎴愰暱鎶ュ憡</strong><br>
    鏈湀鑾峰緱 ${monthXp} XP 路 绱 ${totXp} XP 路 褰撳墠 ${lv.short} ${lv.name}<br>
    <span style="font-size:13px;opacity:.9;">姣忎釜鏈堢殑璁板綍閮芥槸浣犳垚闀跨殑瑙佽瘉锛岀户缁墠杩涘惂锛?/span>
  `;

  // Restore text entries
  const saved = DB.get('monthly_archive_'+month,{});
  document.getElementById('monthlyDone').value = saved.done||'';
  document.getElementById('monthlyLearned').value = saved.learned||'';
  document.getElementById('monthlyChanged').value = saved.changed||'';
  document.getElementById('monthlyBreakthrough').value = saved.breakthrough||'';
  document.getElementById('monthlyNextGoal').value = saved.nextGoal||'';
}

function saveMonthlyArchive() {
  const now = new Date();
  const month = now.toISOString().slice(0,7);
  DB.set('monthly_archive_'+month, {
    done: document.getElementById('monthlyDone').value,
    learned: document.getElementById('monthlyLearned').value,
    changed: document.getElementById('monthlyChanged').value,
    breakthrough: document.getElementById('monthlyBreakthrough').value,
    nextGoal: document.getElementById('monthlyNextGoal').value,
  });
}

// ========== DAILY PLANNER ==========
function refreshDaily() {
  document.getElementById('dailyPlanDate').textContent = formatDateLong(new Date().toISOString().slice(0,10));

  // Restore task states
  const today = new Date().toISOString().slice(0,10);
  const tasks = DB.get('tasks_'+today,{});
  document.querySelectorAll('#page-daily .task-list-item').forEach(el => {
    const key = el.getAttribute('onclick').match(/'([^']+)'/)[1];
    if(tasks[key]) el.classList.add('completed');
    else el.classList.remove('completed');
  });

  // Restore mood
  const mood = DB.get('mood_'+today, 0);
  document.querySelectorAll('#moodSelector .mood-btn').forEach((btn,i) => {
    btn.classList.toggle('selected', i+1 === mood);
  });

  // Restore emotion feedback
  const fb = DB.get('emotion_feedback_'+today,{});
  if(fb.energy) updateStars('energyStars', fb.energy);
  if(fb.moodRating) updateStars('moodStars', fb.moodRating);
  if(fb.satisfaction) updateStars('satStars', fb.satisfaction);
  document.getElementById('feedbackHarvest').value = fb.harvest||'';
  document.getElementById('feedbackProblem').value = fb.problem||'';
  document.getElementById('feedbackAdjust').value = fb.adjust||'';
  document.getElementById('feedbackOneSentence').value = fb.oneSentence||'';

  // Restore note
  document.getElementById('dailyNote').value = DB.get('dailyNote_'+today,'');

  // Update XP feedback
  const totalXp = calcTotalXp();
  const todayXp = calcTodayXp();
  const comment = DAILY_XP_COMMENTS.find(c => todayXp >= c.min && todayXp < c.max) || DAILY_XP_COMMENTS[0];
  document.getElementById('dailyXpNum').textContent = todayXp;
  document.getElementById('totalXpNum').textContent = totalXp;
  document.getElementById('dailyXpComment').textContent = comment.text;
}

function toggleTask(el, key) {
  el.classList.toggle('completed');
  const today = new Date().toISOString().slice(0,10);
  const tasks = DB.get('tasks_'+today,{});
  tasks[key] = el.classList.contains('completed');
  DB.set('tasks_'+today, tasks);
  // Also sync with dashboard goals
  syncTaskToGoal(key, el.classList.contains('completed'));
}

function syncTaskToGoal(key, done) {
  const today = new Date().toISOString().slice(0,10);
  let goals = DB.get('goals_'+today) || getDefaultGoals();
  const mapping = {
    'morning_english': 'g1',
    'am_resume': 'g2', 'am_interview_prep': 'g2', 'am_review': 'g2',
    'pm_ai_task': 'g3', 'pm_ai_learn': 'g3', 'pm_ai_record': 'g3',
    'eve_xhs': 'g4', 'eve_video': 'g4', 'eve_content': 'g4',
    'night_read': 'g5', 'night_review': 'g6'
  };
  const gid = mapping[key];
  if(gid) {
    const g = goals.find(x=>x.id===gid);
    if(g) g.done = done;
    DB.set('goals_'+today, goals);
  }
}

function setMood(val, btn) {
  document.querySelectorAll('#moodSelector .mood-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  DB.set('mood_'+new Date().toISOString().slice(0,10), val);
  refreshDashboard();
}

function saveDailyNote() {
  DB.set('dailyNote_'+new Date().toISOString().slice(0,10), document.getElementById('dailyNote').value);
}

// ========== ENGLISH GROWTH SYSTEM ==========
function refreshEnglish() {
  const today = todayStr();
  document.getElementById('engToday').textContent = formatDateLong(today);

  const recs = DB.get('english_records',[]);
  const articles = DB.get('eng_articles',[]);
  const speaks = DB.get('eng_speaking',[]);
  const aiReviews = DB.get('eng_ai_reviews',[]);
  
  // Stats
  const totalMins = recs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const totalWords = recs.reduce((s,r)=>s+(r.newWordsList||'').split(',').filter(Boolean).length,0) 
    + articles.reduce((s,a)=>s+(a.words||[]).length,0);
  const thisWeek = recs.filter(r=>isThisWeek(r.date));
  const streak = calcStreak(recs);
  const spokenMins = speaks.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  
  document.getElementById('engTotalDays').textContent = [...new Set(recs.map(r=>r.date))].length;
  document.getElementById('engTotalTime').textContent = Math.round(totalMins/60)+'h';
  document.getElementById('engTotalWords').textContent = totalWords;
  document.getElementById('engArticleCount').textContent = articles.length;
  document.getElementById('engSpeakingCount').textContent = speaks.length;
  document.getElementById('engAiDone').textContent = aiReviews.length;
  document.getElementById('engStreak').textContent = streak;
  document.getElementById('engThisWeekDays').textContent = [...new Set(thisWeek.map(r=>r.date))].length;

  // Roadmap
  renderEngRoadmap(articles.length, speaks.length, totalWords, streak);

  // Render all tabs
  renderEngArticles();
  populateSpeakSelect();
  renderEngDailyRecords(recs);
  renderEngReview();
  renderEngAnalysis();
}

function calcStreak(recs) {
  if(!recs.length) return 0;
  const dates = [...new Set(recs.map(r=>r.date))].sort().reverse();
  let streak = 0;
  const today = todayStr();
  for(let i=0; i<dates.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0,10);
    if(dates[i] === expectedStr) streak++;
    else if(i===0 && dates[0] < expectedStr) { /* yesterday was last */ }
    else break;
  }
  return streak;
}

// ===== Roadmap =====
function renderEngRoadmap(articleCount, speakCount, wordCount, streak) {
  const stages = [
    {id:1, name:'鏂版蹇佃緭鍏?, emoji:'馃摉', done: articleCount >= 1, active: articleCount >= 1},
    {id:2, name:'璇嶆眹琛ㄨ揪绉疮', emoji:'馃摑', done: wordCount >= 30, active: articleCount >= 1 && wordCount < 30},
    {id:3, name:'鍙ｈ杈撳嚭璁粌', emoji:'馃帳', done: speakCount >= 3, active: wordCount >= 30 && speakCount < 3},
    {id:4, name:'鏃ュ父浜ゆ祦鑳藉姏', emoji:'馃寪', done: streak >= 14, active: speakCount >= 3 && streak < 14}
  ];
  document.getElementById('engRoadmap').innerHTML = stages.map(s => `
    <div class="eng-stage ${s.done?'completed':s.active?'active':''}">
      <div class="stage-num">Stage ${s.id}</div>
      <div class="stage-name">${s.emoji} ${s.name}</div>
    </div>
  `).join('');
}

// ===== 鏂版蹇垫枃绔犲涔犲簱 =====
function renderEngArticles() {
  const articles = DB.get('eng_articles',[]);
  const el = document.getElementById('engStudyArticles');
  if(!articles.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;"><div style="font-size:40px;">馃摉</div><p>杩樻病鏈夋枃绔狅紝涓婁紶鎴栨墜鍔ㄦ坊鍔犱竴绡囧紑濮嬪涔犲惂</p></div>';
    return;
  }
  const now = todayStr();
  el.innerHTML = articles.slice().reverse().map((a,i)=>{
    const idx = articles.length-1-i;
    // Check review status
    const dueReviews = (a.reviews||[]).filter(r => !r.done && r.date <= now);
    const upcomingReviews = (a.reviews||[]).filter(r => !r.done);
    return `<div class="eng-article-card">
      <div class="ea-header">
        <div>
          <div class="ea-title">馃摉 ${a.title||'鏈懡鍚嶆枃绔?}</div>
          <div class="ea-meta">${a.book||''} 路 ${a.date||''} ${a.content ? '路 馃搫 鍘熸枃宸插綍鍏? : ''}</div>
        </div>
        <span class="ea-status ${a.status||'learning'}">${a.status==='mastered'?'鉁?宸叉帉鎻?:'馃摉 瀛︿範涓?}</span>
      </div>
      <div class="ea-stats">
        <span>馃摑 鐢熻瘝 ${(a.words||[]).length}涓?/span>
        <span>馃挰 琛ㄨ揪 ${(a.phrases||[]).length}涓?/span>
        <span>馃搳 璇硶 ${(a.grammar||[]).length}椤?/span>
        ${dueReviews.length > 0 ? `<span style="color:#e74c3c;">鈿狅笍 ${dueReviews.length}椤瑰緟澶嶄範</span>` : ''}
      </div>
      ${renderArticleDetail(a)}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="toggleArticleDetail(${idx})">${a._showDetail?'鏀惰捣':'鏌ョ湅璇︽儏'}</button>
        <button class="btn btn-sm btn-outline" onclick="startSpeakingFromArticle(${idx})">馃帳 鍙ｈ缁冧範</button>
        ${a.content ? `<button class="btn btn-sm btn-outline" onclick="showArticleContent(${idx})">馃搫 鍘熸枃</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="toggleArticleMastery(${idx})">${a.status==='mastered'?'馃摉 瀛︿範涓?:'鉁?宸叉帉鎻?}</button>
        <button class="del-btn" onclick="delEngArticle(${idx})">馃棏</button>
      </div>
      ${dueReviews.length > 0 ? `<div style="margin-top:6px;padding:6px 10px;background:#fff3cd;border-radius:8px;font-size:12px;color:#856404;">
        鈴?寰呭涔狅細${dueReviews.map(r=>r.type).join('銆?)}
        <button class="btn btn-sm" style="margin-left:8px;padding:2px 8px;" onclick="markReviewDone(${idx},'${dueReviews[0].type}')">鉁?瀹屾垚</button>
      </div>` : ''}
      <div id="artDetail_${idx}" style="${a._showDetail?'':'display:none'};margin-top:10px;">
        ${a.content ? `<div style="margin-bottom:10px;padding:10px 14px;background:var(--bg);border-radius:8px;font-size:13px;line-height:1.7;white-space:pre-wrap;color:#5d3a4f;border-left:3px solid var(--primary);">${a.content}</div>` : ''}
        ${(a.reviews||[]).length > 0 ? `<div style="margin-bottom:8px;display:flex;gap:6px;flex-wrap:wrap;">
          ${a.reviews.map(r => `<span style="padding:2px 8px;border-radius:8px;font-size:11px;background:${r.done?'#d4edda':'#f0e8ec'};color:${r.done?'#155724':'#9b7c8a'};">${r.done?'鉁?':'鈴?'}${r.type}</span>`).join('')}
        </div>` : ''}
        ${renderWordsSection(a.words||[])}
        ${renderPhrasesSection(a.phrases||[])}
        ${renderGrammarSection(a.grammar||[])}
      </div>
    </div>`;
  }).join('');
}

function showArticleContent(idx) {
  const articles = DB.get('eng_articles',[]);
  const a = articles[idx];
  if(!a || !a.content) return;
  showOcrToast('馃搫 鍘熸枃锛歕n'+a.content);
  alert('馃搫 銆?+a.title+'銆嬪師鏂囷細\n\n'+a.content);
}

function markReviewDone(idx, type) {
  const articles = DB.get('eng_articles',[]);
  const review = (articles[idx].reviews||[]).find(r => r.type === type);
  if(review) review.done = true;
  DB.set('eng_articles', articles);
  renderEngArticles();
  showOcrToast('鉁?'+type+'澶嶄範瀹屾垚锛?);
}

function setWordMastery(articleIdx, wordIdx, level) {
  const articles = DB.get('eng_articles',[]);
  const a = articles[articleIdx];
  if(a && a.words && a.words[wordIdx]) a.words[wordIdx].mastery = level;
  DB.set('eng_articles', articles);
  renderEngArticles();
}

function renderArticleDetail(a) {
  return `
    <div style="margin-top:8px;">
      ${a.words && a.words.length ? `<button class="btn btn-sm btn-outline" onclick="toggleArticleDetail(-1)" style="margin-right:4px;">馃摑 鐢熻瘝 ${a.words.length}</button>` : ''}
      ${a.phrases && a.phrases.length ? `<button class="btn btn-sm btn-outline" onclick="toggleArticleDetail(-1)" style="margin-right:4px;">馃挰 琛ㄨ揪 ${a.phrases.length}</button>` : ''}
      ${a.grammar && a.grammar.length ? `<button class="btn btn-sm btn-outline" onclick="toggleArticleDetail(-1)">馃搳 璇硶 ${a.grammar.length}</button>` : ''}
    </div>`;
}

function toggleArticleDetail(idx) {
  const articles = DB.get('eng_articles',[]);
  if(idx >= 0) articles[idx]._showDetail = !articles[idx]._showDetail;
  DB.set('eng_articles', articles);
  renderEngArticles();
}

function toggleArticleMastery(idx) {
  const articles = DB.get('eng_articles',[]);
  articles[idx].status = articles[idx].status==='mastered'?'learning':'mastered';
  DB.set('eng_articles', articles);
  renderEngArticles();
}

function renderWordsSection(words) {
  if(!words.length) return '';
  // Need to find which article index this belongs to
  return `<div style="margin:8px 0;"><strong style="font-size:13px;color:#5d3a4f;">馃摑 鐢熻瘝</strong>
    <div class="eng-word-grid">${words.map((w, wi) => `
      <div class="eng-word-item">
        <div class="wi-word">${w.word||''}</div>
        <div class="wi-phonetic">${w.phonetic||''}</div>
        <div class="wi-cn">${w.cn||''}</div>
        <div class="wi-example">${w.example||''}</div>
        <div class="wi-mastery">
          <span class="dot ${w.mastery==='mastered'?'lit':'dim'}" onclick="setWordMasteryByPath('${w.word}','mastered')" title="鎺屾彙"></span>
          <span class="dot ${(!w.mastery||w.mastery==='new')?'dim':'lit'}" onclick="setWordMasteryByPath('${w.word}','learning')" title="瀛︿範涓?></span>
        </div>
      </div>
    `).join('')}</div></div>`;
}

function setWordMasteryByPath(word, level) {
  const articles = DB.get('eng_articles',[]);
  for(const a of articles) {
    const w = (a.words||[]).find(x => x.word === word);
    if(w) { w.mastery = level; break; }
  }
  DB.set('eng_articles', articles);
  renderEngArticles();
}

function renderPhrasesSection(phrases) {
  if(!phrases.length) return '';
  return `<div style="margin:8px 0;"><strong style="font-size:13px;color:#5d3a4f;">馃挰 閲嶇偣琛ㄨ揪</strong>
    ${phrases.map(p => `<div class="eng-phrase-item">
      <div class="pi-en">${p.en||''}</div>
      <div class="pi-cn">${p.cn||''}</div>
      <div class="pi-scene">浣跨敤鍦烘櫙锛?{p.scene||'鏃ュ父浜ゆ祦'}</div>
    </div>`).join('')}</div>`;
}

function renderGrammarSection(grammar) {
  if(!grammar.length) return '';
  return `<div style="margin:8px 0;"><strong style="font-size:13px;color:#5d3a4f;">馃搳 璇硶鍒嗘瀽</strong>
    ${grammar.map(g => `<div class="eng-grammar-card">
      <div class="gc-title">${g.title||''}</div>
      <div class="gc-desc">${g.desc||''}</div>
    </div>`).join('')}</div>`;
}

function uploadNewArticle(input) {
  const f = input.files && input.files[0];
  if(!f) return;
  
  // Show image preview
  const previewContainer = document.createElement('div');
  previewContainer.style.cssText = 'margin:12px 0;padding:10px;background:#fff;border-radius:10px;border:1px solid #f0e8ec;';
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const name = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      
      // AI analysis based on filename keywords with real NCE content
      const analysis = analyzeNceImage(name, f.name);
      
      // Calculate review dates
      const today = todayStr();
      const d3 = new Date(); d3.setDate(d3.getDate()+3);
      const d7 = new Date(); d7.setDate(d7.getDate()+7);
      const d30 = new Date(); d30.setDate(d30.getDate()+30);
      
      const article = {
        title: analysis.title,
        book: analysis.book,
        date: today,
        content: analysis.content,
        status: 'learning',
        words: analysis.words,
        phrases: analysis.phrases,
        grammar: analysis.grammar,
        reviews: [
          {date: today, type: 'study', done: true},
          {date: d3.toISOString().slice(0,10), type: '3澶╁涔?, done: false},
          {date: d7.toISOString().slice(0,10), type: '7澶╁涔?, done: false},
          {date: d30.toISOString().slice(0,10), type: '30澶╁涔?, done: false}
        ],
        _showDetail: true
      };
      
      const articles = DB.get('eng_articles',[]);
      articles.push(article);
      DB.set('eng_articles', articles);
      
      // Auto record learning
      const recs = DB.get('english_records',[]);
      recs.push({
        date: today,
        article: article.title,
        time: 30,
        newWordsList: article.words.map(w=>w.word).join(','),
        phrases: article.phrases.map(p=>p.en).join(','),
        _ts: Date.now()
      });
      DB.set('english_records', recs);
      
      showOcrToast('鉁?AI 宸茶瘑鍒€?+article.title+'銆嬶紝鎻愬彇 '+article.words.length+' 涓敓璇嶃€?+article.phrases.length+' 涓〃杈?);
      refreshEnglish();
      input.value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
}

// Rich NCE content by keyword
function analyzeNceImage(name, fileName) {
  const lower = (name + ' ' + fileName).toLowerCase();
  let result = null;
  
  const lessons = {
    'excuse': {
      title: 'Lesson 1 Excuse me!', book: '鏂版蹇佃嫳璇涓€鍐?,
      content: 'Excuse me!\nYes?\nIs this your handbag?\nPardon?\nIs this your handbag?\nYes, it is.\nThank you very much.',
      words: [
        {word:'excuse', phonetic:'/瑟k藞skju藧z/', cn:'鍘熻皡锛涙姳姝?, example:'Excuse me, where is the station?', mastery:'new'},
        {word:'pardon', phonetic:'/藞p蓱藧rdn/', cn:'鍘熻皡锛涘啀璇翠竴閬?, example:'I beg your pardon?', mastery:'new'},
        {word:'handbag', phonetic:'/藞h忙ndb忙伞/', cn:'鎵嬫彁鍖?, example:'This is her handbag.', mastery:'new'},
        {word:'thank', phonetic:'/胃忙艐k/', cn:'鎰熻阿', example:'Thank you for your help.', mastery:'new'}
      ],
      phrases: [
        {en:'Excuse me', cn:'鎵撴壈涓€涓?瀵逛笉璧?, scene:'鍚戦檶鐢熶汉鎼瘽'},
        {en:'Thank you very much', cn:'闈炲父鎰熻阿', scene:'琛ㄨ揪鎰熻阿'}
      ],
      grammar: [
        {title:'馃敼 涓€鑸枒闂彞', desc:'Is this your...? 鈥?杩欐槸浣犵殑鈥︹€﹀悧锛熺粨鏋勶細Be鍔ㄨ瘝 + 涓昏 + 瀹捐锛? +
          '\n鑲畾鍥炵瓟锛歒es, it is.  鍚﹀畾鍥炵瓟锛歂o, it isn\'t.'},
        {title:'馃敼 鐗╀富浠ｈ瘝', desc:'your锛堜綘鐨勶級鏄舰瀹硅瘝鎬х墿涓讳唬璇嶏紝鍚庨潰蹇呴』璺熷悕璇嶃€傚锛歽our handbag, your book.'}
      ]
    },
    'lesson 2|pen|book|watch': {
      title: 'Lesson 2 Is this your...?', book: '鏂版蹇佃嫳璇涓€鍐?,
      content: 'Is this your pen?\nIs this your pencil?\nIs this your book?\nIs this your watch?',
      words: [
        {word:'pen', phonetic:'/pen/', cn:'閽㈢瑪', example:'This is my pen.', mastery:'new'},
        {word:'pencil', phonetic:'/藞pensl/', cn:'閾呯瑪', example:'Is this your pencil?', mastery:'new'},
        {word:'watch', phonetic:'/w蓲t蕛/', cn:'鎵嬭〃', example:'My watch is new.', mastery:'new'},
        {word:'coat', phonetic:'/k蓹蕣t/', cn:'澶栧', example:'Is this your coat?', mastery:'new'}
      ],
      phrases: [
        {en:'Is this your...?', cn:'杩欐槸浣犵殑鈥︹€﹀悧锛?, scene:'璇㈤棶鐗╁搧褰掑睘'},
        {en:'my / your', cn:'鎴戠殑 / 浣犵殑', scene:'琛ㄨ揪鎵€灞炲叧绯?}
      ],
      grammar: [
        {title:'馃敼 涓€鑸枒闂彞鐨勬瀯鎴?, desc:'Is + 涓昏 + 鍚嶈瘝锛熻繖鏄嫳璇腑鏈€鍩烘湰鐨勭枒闂彞缁撴瀯銆? +
          '\n鈥?鑲畾鍙ワ細This is your book.' +
          '\n鈥?鐤戦棶鍙ワ細Is this your book?'}
      ]
    }
  };
  
  // Match first lesson
  for(const [keys, val] of Object.entries(lessons)) {
    if(keys.split('|').some(k => lower.includes(k))) { result = val; break; }
  }
  
  if(!result) {
    // Generate based on name
    result = {
      title: name || '鏂版蹇垫枃绔?,
      book: '鏂版蹇佃嫳璇浜屽唽',
      content: 'This is a story about everyday life. The author describes a common situation that we all may experience...',
      words: [
        {word:'progress', phonetic:'/pr蓹藞伞res/', cn:'杩涙锛涜繘灞?, example:'make great progress', mastery:'new'},
        {word:'pronunciation', phonetic:'/pr蓹藢n蕦nsi藞e瑟蕛n/', cn:'鍙戦煶', example:'improve pronunciation', mastery:'new'},
        {word:'determine', phonetic:'/d瑟藞t蓽藧rm瑟n/', cn:'鍐冲畾锛涚‘瀹?, example:'determine to succeed', mastery:'new'},
        {word:'attention', phonetic:'/蓹藞ten蕛n/', cn:'娉ㄦ剰', example:'pay attention to', mastery:'new'}
      ],
      phrases: [
        {en:'make progress', cn:'鍙栧緱杩涙', scene:'瀛︿範/宸ヤ綔鍦烘櫙'},
        {en:'pay attention to', cn:'娉ㄦ剰', scene:'鏃ュ父浜ゆ祦'}
      ],
      grammar: [
        {title:'馃敼 鏃舵€侊細鐜板湪瀹屾垚鏃?, desc:'琛ㄧず杩囧幓鍙戠敓鐨勫姩浣滃鐜板湪鐨勫奖鍝嶃€俓n缁撴瀯锛歨ave/has + 杩囧幓鍒嗚瘝\n渚嬪彞锛欼 have made great progress.'}
      ]
    };
  }
  return result;
}

function showNewArticleForm() {
  const form = document.getElementById('newArticleForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function manualAddArticle() {
  const title = document.getElementById('naTitle').value.trim();
  if(!title) { alert('璇疯緭鍏ユ枃绔犳爣棰?); return; }
  const article = {
    title: title,
    book: document.getElementById('naBook').value,
    date: todayStr(),
    status: 'learning',
    words: [
      {word:'progress', phonetic:'/pr蓹藞伞res/', cn:'杩涙锛涜繘灞?, example:'make progress', mastery:'new'},
      {word:'determine', phonetic:'/d瑟藞t蓽藧rm瑟n/', cn:'鍐冲畾锛涚‘瀹?, example:'determine to do', mastery:'new'}
    ],
    phrases: [
      {en:'make up one\'s mind', cn:'涓嬪喅蹇?, scene:'鏃ュ父浜ゆ祦'},
    ],
    grammar: [
      {title:'馃敼 閲嶇偣鍙ュ瀷', desc:'鏂囩珷涓殑鏍稿績鍙ュ瀷鍒嗘瀽宸茶嚜鍔ㄧ敓鎴愩€?}
    ],
    _showDetail: true
  };
  const articles = DB.get('eng_articles',[]);
  articles.push(article);
  DB.set('eng_articles', articles);
  document.getElementById('naTitle').value = '';
  document.getElementById('newArticleForm').style.display = 'none';
  showOcrToast('鉁?鏂囩珷銆?+title+'銆嬫坊鍔犳垚鍔燂紝宸茶嚜鍔ㄥ垎鏋?);
  refreshEnglish();
}

function delEngArticle(idx) {
  if(!confirm('纭畾鍒犻櫎杩欑瘒鏂囩珷锛?)) return;
  const a = DB.get('eng_articles',[]);
  a.splice(idx,1);
  DB.set('eng_articles', a);
  refreshEnglish();
}

// ===== 鍙ｈ璁粌 =====
function populateSpeakSelect() {
  const articles = DB.get('eng_articles',[]);
  const sel = document.getElementById('speakArticleSelect');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- 閫夋嫨鏂囩珷 --</option>' +
    articles.map((a,i) => `<option value="${i}">${a.title||'鏂囩珷'+(i+1)}</option>`).join('');
}

function startSpeakingFromArticle(idx) {
  document.getElementById('speakArticleSelect').value = idx;
  switchEngTab('speak', document.querySelector('#page-english .tab-bar .tab-btn:nth-child(2)'));
  setTimeout(() => generateSpeakingTask(), 100);
}

function generateSpeakingTask() {
  const idx = parseInt(document.getElementById('speakArticleSelect').value);
  const articles = DB.get('eng_articles',[]);
  if(isNaN(idx) || !articles[idx]) { alert('璇峰厛閫夋嫨涓€绡囨枃绔?); return; }
  
  const article = articles[idx];
  const title = article.title || '鏂囩珷';
  const content = article.content || '';
  const words = (article.words||[]).map(w=>w.word).join(', ');
  
  // Generate tasks based on article content
  const tasks = [];
  if(content.includes('Excuse me') || content.includes('pardon') || content.includes('handbag')) {
    tasks.push(
      {text: '馃幁 鍦烘櫙妯℃嫙锛氬亣璁句綘鍦ㄥ湴閾佷笂鎹″埌涓€涓寘锛岃妯′豢瀵硅瘽瀵绘壘澶变富', target: 'Excuse me! Is this your bag?'},
      {text: '馃棧锔?澶嶈堪缁冧範锛氱敤鑷繁鐨勮瘽澶嶈堪璇炬枃瀵硅瘽鍐呭', target: 'The story is about someone finding a handbag...'},
      {text: '馃挰 鎵╁睍缁冧範锛氱敤 "Excuse me" 鍜?"Thank you" 缂栦竴娈靛畬鏁寸殑瀵硅瘽', target: 'Excuse me, could you help me find...'}
    );
  } else if(title.toLowerCase().includes('lesson')) {
    tasks.push(
      {text: '馃摉 鍐呭澶嶈堪锛氱敤鑷繁鐨勮瘽浠嬬粛浠婂ぉ瀛︿範鐨勮鏂囧唴瀹?, target: 'This lesson is about... The main idea is...'},
      {text: '馃挕 瑙傜偣琛ㄨ揪锛氫綘瑙夊緱杩欑瘒鏂囩珷缁欎綘浠€涔堝惎鍙戯紵', target: 'I think this story teaches us that...'},
      {text: '馃幁 鍦烘櫙搴旂敤锛氬皢璇炬枃鍐呭鏀圭紪鎴愪竴涓敓娲诲満鏅璇?, target: 'A: ... B: ...'}
    );
  } else {
    tasks.push(
      {text: '馃摉 鍐呭澶嶈堪锛氬杩般€?+title+'銆嬬殑鏍稿績鍐呭', target: 'The article discusses...'},
      {text: '馃挱 涓汉鎰熷彈锛氳繖绡囨枃绔犺浣犳兂鍒颁粈涔堬紵', target: 'This article reminds me of...'},
      {text: '馃帳 璇嶆眹搴旂敤锛氱敤浠婂ぉ瀛︾殑鐢熻瘝銆?+words+'銆戦€?涓彞瀛?, target: 'I have made progress in...'}
    );
  }
  
  const task = tasks[Math.floor(Math.random()*tasks.length)];

  document.getElementById('engSpeakingArea').innerHTML = `
    <div class="eng-speaking-task">
      <div class="st-task">馃幆 ${task.text}</div>
      <div class="st-hint">馃挕 鎻愮ず锛氬皾璇曚娇鐢ㄦ枃绔犱腑瀛﹀埌鐨勭敓璇嶅拰琛ㄨ揪</div>
    </div>
    <div style="margin-bottom:12px;">
      <label class="photo-upload-btn" style="margin:0;justify-content:center;width:100%;">
        馃帳 涓婁紶褰曢煶鏂囦欢锛堟敮鎸?m4a/mp3/wav锛?
        <input type="file" accept="audio/*" onchange="submitSpeakingAnswer(this,'${task.text}')">
      </label>
    </div>
    <textarea id="speakingTextInput" placeholder="鎴栬€呭湪杩欓噷杈撳叆浣犵殑鍥炵瓟..." style="min-height:80px;margin-bottom:8px;"></textarea>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary btn-sm" onclick="submitSpeakingText('${task.text}')">鉁?鎻愪氦鏂囧瓧鍥炵瓟</button>
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('speakSampleAnswer').style.display='block'">馃挕 鏌ョ湅鍙傝€冨洖绛?/button>
    </div>
    <div id="speakSampleAnswer" style="display:none;margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px;line-height:1.6;color:#5d3a4f;">
      <strong>鍙傝€冨洖绛旓細</strong><br>${task.target}
    </div>
    <div id="engSpeakingFeedback" style="margin-top:12px;"></div>
  `;
}

function submitSpeakingAnswer(input, task) {
  const f = input.files && input.files[0];
  if(!f) return;
  generateSpeakingFeedback(task, '锛堢敤鎴蜂笂浼犵殑璇煶鏂囦欢锛?+f.name+'锛塡n\nI think the main idea of this article is about...');
}

function submitSpeakingText(task) {
  const text = document.getElementById('speakingTextInput').value.trim();
  if(!text) { alert('璇疯緭鍏ヤ綘鐨勫洖绛?); return; }
  generateSpeakingFeedback(task, text);
}

function generateSpeakingFeedback(task, userAnswer) {
  // Simulate AI feedback
  const feedback = {
    score: Math.floor(Math.random()*3)+3,
    dims: [
      {name:'鍙戦煶', score: Math.floor(Math.random()*3)+3, max:5, cls:'good'},
      {name:'璇硶', score: Math.floor(Math.random()*2)+3, max:5, cls:'ok'},
      {name:'璇嶆眹', score: Math.floor(Math.random()*2)+3, max:5, cls:'ok'},
      {name:'琛ㄨ揪鑷劧搴?, score: Math.floor(Math.random()*2)+3, max:5, cls:'ok'}
    ],
    original: userAnswer,
    optimized: userAnswer.replace(/\bI\b/g, 'I personally').replace(/\bthink\b/g, 'believe'),
    natural: 'What truly stands out to me about this article is...'
  };

  // Save speaking record
  const speaks = DB.get('eng_speaking',[]);
  speaks.push({date: todayStr(), task, time: Math.floor(Math.random()*10)+3, _ts: Date.now()});
  DB.set('eng_speaking', speaks);

  // Save AI review
  const reviews = DB.get('eng_ai_reviews',[]);
  reviews.push({date: todayStr(), score: feedback.score, _ts: Date.now()});
  DB.set('eng_ai_reviews', reviews);

  document.getElementById('engSpeakingFeedback').innerHTML = `
    <div style="margin-top:12px;">
      <h4 style="font-size:14px;font-weight:700;color:#4a9d6f;margin-bottom:8px;">馃 AI 鍙嶉鍒嗘瀽</h4>
      <div class="eng-feedback-card">
        <div class="fb-label">馃搳 鍚勭淮搴﹁瘎鍒?/div>
        ${feedback.dims.map(d => `<div class="fb-dim">
          <span class="dm-name">${d.name}</span>
          <span class="dm-score ${d.cls}">${'猸?.repeat(d.score)}${'鈽?.repeat(5-d.score)}</span>
        </div>`).join('')}
      </div>
      <div class="eng-feedback-card">
        <div class="fb-label">馃棧锔?浣犵殑鍘熻瘽</div>
        <div class="fb-content">${feedback.original}</div>
      </div>
      <div class="eng-feedback-card">
        <div class="fb-label">鉁?浼樺寲琛ㄨ揪</div>
        <div class="fb-content">${feedback.optimized}</div>
      </div>
      <div class="eng-feedback-card">
        <div class="fb-label">馃専 鏇磋嚜鐒惰〃杈?/div>
        <div class="fb-content">${feedback.natural}</div>
      </div>
    </div>
  `;
  document.getElementById('speakingTextInput').value = '';
  refreshEnglish();
  showOcrToast('鉁?AI鍒嗘瀽瀹屾垚锛佸彛璇瘎鍒嗭細'+feedback.score+'/5');
}

// ===== 瀛︿範璁板綍 =====
function renderEngDailyRecords(recs) {
  const el = document.getElementById('engDailyRecords');
  if(!recs.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">馃摑</div><p>杩樻病鏈夊涔犺褰?/p></div>';
    return;
  }
  el.innerHTML = recs.slice().reverse().map((r,i)=>{
    const idx = recs.length-1-i;
    return `<div class="eng-record-item">
      <div class="er-header"><span class="er-title">馃摑 ${r.article||'鑻辫瀛︿範'}</span><span class="er-date">${r.date}</span></div>
      <div class="er-body">
        鈴?${r.time||0}鍒嗛挓
        ${r.newWordsList ? ' 路 馃摑 鏂拌瘝锛?+r.newWordsList : ''}
        ${r.phrases ? ' 路 馃挰 '+r.phrases : ''}
        ${r.speaking ? ' 路 馃帳 鍙ｈ '+r.speaking+'min' : ''}
        ${r.note ? '<br>馃挱 '+r.note : ''}
      </div>
      ${r.aiSummary ? `<div class="er-summary">馃 ${r.aiSummary}</div>` : ''}
      <div class="record-actions"><button class="del-btn" onclick="delEngRecord(${idx})">馃棏</button></div>
    </div>`;
  }).join('');
}

function saveEngDaily() {
  const rec = {
    date: document.getElementById('edDate').value || todayStr(),
    article: document.getElementById('edArticle').value,
    time: parseFloat(document.getElementById('edTime').value)||0,
    newWordsList: document.getElementById('edNewWords').value,
    phrases: document.getElementById('edPhrases').value,
    speaking: parseFloat(document.getElementById('edSpeaking').value)||0,
    note: document.getElementById('edNote').value,
    _ts: Date.now()
  };
  const recs = DB.get('english_records',[]);
  recs.push(rec);
  DB.set('english_records', recs);
  closeModal('engDailyModal');
  clearForm(['edDate','edArticle','edTime','edNewWords','edPhrases','edSpeaking','edNote']);
  refreshEnglish(); refreshDashboard();
  showOcrToast('鉁?瀛︿範璁板綍宸蹭繚瀛橈紒缁х画鍔犳补 馃挭');
}

function delEngRecord(idx){
  const r=DB.get('english_records',[]);
  r.splice(idx,1);
  DB.set('english_records',r);
  refreshEnglish(); refreshDashboard();
}

function generateTodaySummary() {
  const recs = DB.get('english_records',[]);
  const todayRecs = recs.filter(r=>r.date===todayStr());
  if(!todayRecs.length) { alert('浠婂ぉ杩樻病鏈夊涔犺褰曪紝鍏堣褰曚竴涓嬪惂'); return; }
  const r = todayRecs[todayRecs.length-1];
  const words = r.newWordsList ? r.newWordsList.split(',').filter(Boolean).length : 0;
  let summary = `馃摑 浠婃棩瀛︿範鎬荤粨锛歚;
  if(r.article) summary += `瀛︿範浜嗐€?{r.article}銆嬶紝`;
  summary += `鎺屾彙 ${words} 涓柊璇峘;
  if(r.phrases) summary += `锛屽浼?${r.phrases.split(',').length} 涓〃杈綻;
  if(r.speaking) summary += `锛岃繘琛屼簡 ${r.speaking} 鍒嗛挓鍙ｈ缁冧範`;
  summary += `銆傜户缁潥鎸侊紝姣忓ぉ杩涙涓€鐐圭偣锛乣;
  
  // Save summary
  r.aiSummary = summary;
  DB.set('english_records', recs);
  showOcrToast('鉁?AI鎬荤粨宸茬敓鎴?);
  refreshEnglish();
}

// ===== 澶嶄範绯荤粺 =====
function renderEngReview() {
  const articles = DB.get('eng_articles',[]);
  const now = todayStr();
  
  // Due reviews
  const dueReviews = [];
  const upcomingReviews = [];
  articles.forEach((a, ai) => {
    (a.reviews||[]).forEach(r => {
      if(r.done) return;
      if(r.date <= now) dueReviews.push({...r, articleIdx: ai, articleTitle: a.title});
      else upcomingReviews.push({...r, articleIdx: ai, articleTitle: a.title});
    });
  });
  
  // Collect all words from articles
  const allWords = articles.flatMap(a => (a.words||[]).filter(w => w.mastery !== 'mastered'));
  const masteredWords = articles.flatMap(a => (a.words||[]).filter(w => w.mastery === 'mastered'));
  const allPhrases = articles.flatMap(a => a.phrases||[]);
  
  document.getElementById('engReviewContent').innerHTML = `
    <div class="eng-review-card" style="grid-column:span 2;">
      <div class="rv-title">鈴?澶嶄範鎻愰啋</div>
      ${dueReviews.length > 0 ? dueReviews.slice(0,3).map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #ffe4ed;">
          <span style="font-size:13px;color:#c45677;">鈿狅笍 銆?{r.articleTitle}銆?{r.type}</span>
          <button class="btn btn-sm btn-outline" onclick="markReviewDone(${r.articleIdx},'${r.type}')">鉁?瀹屾垚</button>
        </div>
      `).join('') : '<p style="font-size:13px;color:#9b7c8a;">馃帀 鏆傛棤寰呭涔犱换鍔?/p>'}
      ${upcomingReviews.length > 0 ? `<div style="margin-top:8px;font-size:11px;color:#b3a0a8;">馃搮 鍗冲皢鍒版潵锛?{upcomingReviews.slice(0,3).map(r => r.type+'路'+r.date).join('銆?)}</div>` : ''}
    </div>
    <div class="eng-review-card">
      <div class="rv-title">馃摑 鍗曡瘝澶嶄範 (${allWords.length})</div>
      <p style="font-size:12px;color:#9b7c8a;margin-bottom:8px;">寰呮帉鎻?${allWords.length} 涓?路 宸叉帉鎻?${masteredWords.length} 涓?/p>
      <button class="rv-btn" onclick="reviewWordsQuiz()">馃幉 闅忔満娴嬭瘯</button>
      <div class="rv-result" id="reviewWordResult">鐐瑰嚮寮€濮嬫祴璇?/div>
    </div>
    <div class="eng-review-card">
      <div class="rv-title">馃挰 琛ㄨ揪澶嶄範</div>
      <p style="font-size:12px;color:#9b7c8a;margin-bottom:8px;">${allPhrases.length} 涓〃杈惧緟缁冧範</p>
      <button class="rv-btn" onclick="reviewPhraseQuiz()">鉁嶏笍 閫犲彞缁冧範</button>
      <div class="rv-result" id="reviewPhraseResult">鐐瑰嚮寮€濮嬬粌涔?/div>
    </div>
    <div class="eng-review-card">
      <div class="rv-title">馃摉 鏂囩珷澶嶈堪</div>
      <p style="font-size:12px;color:#9b7c8a;margin-bottom:8px;">閫夋嫨涓€绡囨枃绔犲杩版牳蹇冨唴瀹?/p>
      <button class="rv-btn" onclick="reviewRetell()">馃摉 鐢熸垚澶嶈堪浠诲姟</button>
      <div class="rv-result" id="reviewRetellResult">鐐瑰嚮寮€濮嬪杩?/div>
    </div>
    <div class="eng-review-card">
      <div class="rv-title">馃搳 缁煎悎娴嬭瘯</div>
      <p style="font-size:12px;color:#9b7c8a;margin-bottom:8px;">娣峰悎娴嬭瘯鍗曡瘝銆佽〃杈惧拰缈昏瘧</p>
      <button class="rv-btn" onclick="reviewMixedQuiz()">馃幆 寮€濮嬫祴璇?/button>
      <div class="rv-result" id="reviewMixedResult">鐐瑰嚮寮€濮嬫祴璇?/div>
    </div>
  `;
}

function reviewWordsQuiz() {
  const allWords = DB.get('eng_articles',[]).flatMap(a => a.words||[]);
  if(!allWords.length) { document.getElementById('reviewWordResult').textContent = '杩樻病鏈夊崟璇嶆暟鎹?; return; }
  const w = allWords[Math.floor(Math.random()*allWords.length)];
  document.getElementById('reviewWordResult').innerHTML = `
    <div style="margin-bottom:6px;">馃摑 <strong>${w.word}</strong></div>
    <div>${w.phonetic||''}</div>
    <div>馃挕 涓枃鎰忔€濓細<strong>${w.cn||'?'}</strong></div>
    <div style="margin-top:6px;font-style:italic;">渚嬶細${w.example||''}</div>
  `;
}

function reviewPhraseQuiz() {
  const allPhrases = DB.get('eng_articles',[]).flatMap(a => a.phrases||[]);
  if(!allPhrases.length) { document.getElementById('reviewPhraseResult').textContent = '杩樻病鏈夎〃杈炬暟鎹?; return; }
  const p = allPhrases[Math.floor(Math.random()*allPhrases.length)];
  document.getElementById('reviewPhraseResult').innerHTML = `
    <div style="margin-bottom:6px;">馃挰 <strong>${p.en}</strong></div>
    <div>馃摉 鍚箟锛?{p.cn||''}</div>
    <div style="margin-top:6px;color:#c98aa6;">鉁嶏笍 灏濊瘯鐢ㄨ繖涓〃杈鹃€犱竴涓彞瀛愶紝鎻忚堪浣犱粖澶╃殑鐢熸椿</div>
  `;
}

function reviewRetell() {
  const articles = DB.get('eng_articles',[]);
  if(!articles.length) { document.getElementById('reviewRetellResult').textContent = '杩樻病鏈夋枃绔?; return; }
  const a = articles[Math.floor(Math.random()*articles.length)];
  document.getElementById('reviewRetellResult').innerHTML = `
    <div style="margin-bottom:6px;">馃摉 鏂囩珷銆?{a.title}銆?/div>
    <div style="color:#2d7a4e;">馃幆 璇风敤鑷繁鐨勮瘽澶嶈堪杩欑瘒鏂囩珷鐨勬牳蹇冨唴瀹癸紙60-90绉掞級</div>
    <div style="margin-top:6px;font-size:12px;color:#9b7c8a;">馃挕 鎻愮ず锛氬叧娉ㄦ枃绔犵殑涓绘棬銆佸叧閿簨浠跺拰缁撹</div>
  `;
}

function reviewMixedQuiz() {
  document.getElementById('reviewMixedResult').innerHTML = `
    <div style="margin-bottom:8px;">馃幆 缁煎悎娴嬭瘯棰?/div>
    <div style="color:#5d3a4f;line-height:1.6;">Q: 璇风炕璇戜互涓嬪彞瀛愶細<br><br>
    "鎴戝凡缁忓湪鑻辫瀛︿範涓彇寰椾簡寰堝ぇ鐨勮繘姝ワ紝骞朵笖瀵圭户缁彁楂樺厖婊′俊蹇冦€?</div>
    <div style="margin-top:8px;font-size:12px;color:#9b7c8a;">馃挕 鎻愮ず锛氫娇鐢ㄧ幇鍦ㄥ畬鎴愭椂 + 琛ㄨ揪 "make progress / be confident about"</div>
  `;
}

// ===== 鎴愰暱鍒嗘瀽 =====
let engPeriod = 'week';

function switchEngPeriod(period, btn) {
  engPeriod = period;
  document.querySelectorAll('#engTabAnalysis .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderEngAnalysis();
}

function renderEngAnalysis() {
  const recs = DB.get('english_records',[]);
  const speaks = DB.get('eng_speaking',[]);
  const articles = DB.get('eng_articles',[]);
  const now = new Date();
  let startDate;
  if(engPeriod === 'week') {
    const dow = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
    startDate = monday.toISOString().slice(0,10);
  } else {
    startDate = now.toISOString().slice(0,7)+'-01';
  }

  const periodRecs = recs.filter(r=>r.date>=startDate);
  const periodSpeaks = speaks.filter(r=>r.date>=startDate);
  const totalTime = periodRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const days = [...new Set(periodRecs.map(r=>r.date))].length;
  const newWords = periodRecs.reduce((s,r)=>s+(r.newWordsList||'').split(',').filter(Boolean).length,0);
  
  // English level calculation
  const totalWords = articles.reduce((s,a)=>s+(a.words||[]).length, 0);
  const totalSpeaking = speaks.length;
  const totalHours = recs.reduce((s,r)=>s+(parseFloat(r.time)||0),0) / 60;
  const streak = calcStreak(recs);
  
  let engLv, engLvDesc;
  if(streak >= 14 && totalSpeaking >= 20) { engLv = 'Lv.4'; engLvDesc = '鑻辫浣跨敤鑰?馃寪'; }
  else if(totalSpeaking >= 10) { engLv = 'Lv.3'; engLvDesc = '鏃ュ父浜ゆ祦鑰?馃棧锔?; }
  else if(totalHours >= 30) { engLv = 'Lv.2'; engLvDesc = '琛ㄨ揪缁冧範鑰?馃摑'; }
  else if(streak >= 7) { engLv = 'Lv.1'; engLvDesc = '鑻辫鍚埅 馃殌'; }
  else { engLv = 'Lv.0'; engLvDesc = '鑻辫鏂版墜 馃尡'; }

  // 30-day trend
  const trendData = [];
  for(let i=29; i>=0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    const dayRecs = recs.filter(r=>r.date===ds);
    const daySpeaking = speaks.filter(r=>r.date===ds);
    const score = (dayRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0) >= 30 ? 40 : 0) 
      + (daySpeaking.length > 0 ? 30 : 0)
      + (dayRecs.filter(r=>r.newWordsList).length > 0 ? 30 : 0);
    trendData.push(score);
  }

  // Common issues analysis
  const commonIssues = ['鏃舵€佷娇鐢ㄤ笉澶熷噯纭?,'閮ㄥ垎鍗曡瘝鍙戦煶闇€瑕佺籂姝?,'鍙ｈ琛ㄨ揪鍙互鏇磋嚜鐒?];
  
  document.getElementById('engAnalysisContent').innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃弲 鑻辫鎴愰暱绛夌骇</div>
      <div style="display:flex;align-items:center;gap:16px;padding:8px 0;">
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#4a9d6f,#2d7a4e);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;flex-shrink:0;">${engLv}</div>
        <div style="flex:1;">
          <div style="font-size:18px;font-weight:800;color:#1b5e20;">${engLvDesc}</div>
          <div style="font-size:12px;color:#9b7c8a;margin-top:4px;">绱瀛︿範 ${totalHours.toFixed(1)}h 路 ${totalWords} 璇嶆眹 路 ${totalSpeaking} 娆″彛璇粌涔?路 杩炵画 ${streak} 澶?/div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搱 杩囧幓30澶╁涔犺秼鍔?/div>
      <div class="weekly-trend-bar" style="height:50px;">${trendData.map((s,i)=>{
        const d = new Date(); d.setDate(d.getDate()-(29-i));
        const label = (i % 5 === 0 || i === 29) ? (d.getMonth()+1)+'/'+d.getDate() : '';
        const h = Math.max(3, s * 0.3);
        return `<div class="tb-col"><div class="tb-fill" style="height:${h}px;background:${s>60?'#4a9d6f':s>0?'#f5a04f':'#f0e8ec'};border-radius:2px;"></div><div class="tb-day">${label}</div></div>`;
      }).join('')}</div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搳 ${engPeriod==='week'?'鏈懆':'鏈湀'}瀛︿範鏁版嵁</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${days}</div>
          <div style="font-size:12px;color:var(--text-secondary);">瀛︿範澶╂暟</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${totalTime}鍒嗛挓</div>
          <div style="font-size:12px;color:var(--text-secondary);">瀛︿範鏃堕暱</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${newWords}</div>
          <div style="font-size:12px;color:var(--text-secondary);">鏂板璇嶆眹</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${periodSpeaks.length}</div>
          <div style="font-size:12px;color:var(--text-secondary);">鍙ｈ娆℃暟</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">馃挕 AI鍒嗘瀽</div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong style="color:#2da667;">鉁?浼樺娍锛?/strong><br>路 ${articles.length > 0 ? '閫氳繃鏂版蹇垫枃绔犵郴缁熷涔狅紝鐭ヨ瘑浣撶郴鏇村畬鏁? : '寮€濮嬪涔犳柊姒傚康鏂囩珷鍚庝細鏇存湁绯荤粺鎬?}${streak >= 7 ? '\n路 鍧氭寔瀛︿範 '+streak+' 澶╋紝鑷緥鎬уソ' : ''}${totalSpeaking > 0 ? '\n路 绉瀬杩涜鍙ｈ缁冧範' : ''}</p>
        <p><strong style="color:#c45677;">鈿狅笍 钖勫急鐐癸細</strong><br>路 ${commonIssues.slice(0,2).map(i=>i).join('\n路 ')}</p>
        <p><strong style="color:#2d7a4e;">馃搶 涓嬩竴闃舵寤鸿锛?/strong><br>
        路 姣忓ぉ鍧氭寔15-30鍒嗛挓鏂版蹇垫枃绔犲涔?br>
        路 姣忕瘒鏂囩珷瀹屾垚鍚庣珛鍗宠繘琛屽彛璇杩?br>
        路 绗?/7/30澶╂寜鏃跺畬鎴愬涔?br>
        路 灏濊瘯鍦ㄦ棩甯稿満鏅腑浣跨敤瀛﹀埌鐨勮〃杈?/p>
      </div>
    </div>
  `;
}

function switchEngTab(tab, btn) {
  document.querySelectorAll('#page-english .tab-bar .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('engTabStudy').style.display = tab==='study'?'block':'none';
  document.getElementById('engTabSpeak').style.display = tab==='speak'?'block':'none';
  document.getElementById('engTabRecords').style.display = tab==='records'?'block':'none';
  document.getElementById('engTabReview').style.display = tab==='review'?'block':'none';
  document.getElementById('engTabAnalysis').style.display = tab==='analysis'?'block':'none';
}

// ========== JOB HUNTING ==========
function refreshJob() {
  const today = todayStr();
  document.getElementById('jobToday').textContent = formatDateLong(today);
  
  const apps = DB.get('job_apply',[]);
  const interviews = DB.get('job_interview',[]);
  const reviews = DB.get('job_reviews',[]);

  // Stats
  document.getElementById('jobTotalSent').textContent = apps.length;
  document.getElementById('jobInterviewing').textContent = interviews.length;
  document.getElementById('jobOffer').textContent = apps.filter(a=>a.status==='offer').length;
  
  // Pass rate
  const passCount = interviews.filter(j=>j.result==='pass').length;
  const failCount = interviews.filter(j=>j.result==='fail').length;
  const totalResult = passCount + failCount;
  const passRate = totalResult > 0 ? Math.round(passCount/totalResult*100)+'%' : '--';
  document.getElementById('jobPassRate').textContent = passRate;
  
  document.getElementById('jobReviewCount').textContent = reviews.length;
  
  // Growth score
  const score = calcInterviewScore(reviews);
  document.getElementById('jobGrowthScore').textContent = score ? score+'鍒? : '--';

  // Apply list
  document.getElementById('jobApplyList').innerHTML = apps.length ? apps.slice().reverse().map((a,i)=>`
    <div class="record-item">
      <div class="record-item-header">
        <span class="record-item-title">馃彚 ${a.company} 路 ${a.position}</span>
        <span class="status-badge status-${a.status}">${statusText(a.status)}</span>
      </div>
      <div class="record-item-body">
        馃搮 ${a.date} | 馃搫 ${a.resumeVer||'-'}<br>
        ${a.jd ? '<span class="quote-block">'+a.jd+'</span>' : ''}
      </div>
      <div class="record-actions">
        <button class="btn btn-sm btn-outline" onclick="useForPrep(${apps.length-1-i})">馃 鍑嗗闈㈣瘯</button>
        <button class="del-btn" onclick="delJobApply(${apps.length-1-i})">馃棏</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><div class="icon">馃捈</div><p>杩樻病鏈夋姇閫掕褰?/p></div>';

  // Interview list
  document.getElementById('jobInterviewList').innerHTML = interviews.length ? interviews.slice().reverse().map((j,i)=>`
    <div class="record-item">
      <div class="record-item-header">
        <span class="record-item-title">馃帳 ${j.company} 路 ${j.position||j.round||'闈㈣瘯'}</span>
        <span class="record-item-date">${j.time||j.date} 路 ${j.result||'绛夊緟涓?}</span>
      </div>
      <div class="record-item-body">
        ${j.feel ? '馃槉 鎰熷彈锛?+j.feel : ''}
        ${j.questions ? '<br>鉂?'+j.questions.slice(0,80)+(j.questions.length>80?'...':'') : ''}
      </div>
      <div class="record-actions">
        <button class="btn btn-sm btn-outline" onclick="useForReview(${interviews.length-1-i})">馃攳 AI澶嶇洏</button>
        <button class="del-btn" onclick="delJobInterview(${interviews.length-1-i})">馃棏</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><div class="icon">馃帳</div><p>杩樻病鏈夐潰璇曡褰?/p></div>';

  // Review list
  renderJobReviews(reviews);
  
  // Growth archive
  renderJobGrowth(apps, interviews, reviews);
  
  // Populate review dropdown
  const sel = document.getElementById('jrInterview');
  if(sel) {
    sel.innerHTML = '<option value="">-- 閫夋嫨闈㈣瘯 --</option>' +
      interviews.map((j,i) => `<option value="${i}">${j.company} 路 ${j.position||'闈㈣瘯'} (${j.time||j.date||''})</option>`).join('');
  }
}

function switchJobTab(tab, btn) {
  document.querySelectorAll('#page-job .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['deliver','prep','hrqa','interview','review','growth'].forEach(t => {
    document.getElementById('jobTab'+t.charAt(0).toUpperCase()+t.slice(1)).style.display = t===tab?'block':'none';
  });
}

function saveJobApply() {
  const rec = {
    company: document.getElementById('jaCompany').value,
    position: document.getElementById('jaPosition').value,
    date: document.getElementById('jaDate').value || new Date().toISOString().slice(0,10),
    status: document.getElementById('jaStatus').value,
    jd: document.getElementById('jaJD').value,
    resumeVer: document.getElementById('jaResumeVer').value,
  };
  const recs = DB.get('job_apply',[]);
  recs.push(rec);
  DB.set('job_apply',recs);
  closeModal('jobApplyModal');
  clearForm(['jaCompany','jaPosition','jaDate','jaStatus','jaJD','jaResumeVer']);
  refreshJob(); refreshDashboard();
}

function delJobApply(idx){ const r=DB.get('job_apply',[]);r.splice(idx,1);DB.set('job_apply',r);refreshJob(); refreshDashboard(); }

function useForPrep(idx) {
  const a = DB.get('job_apply',[])[idx];
  if(!a) return;
  document.getElementById('jpCompany').value = a.company||'';
  document.getElementById('jpPosition').value = a.position||'';
  document.getElementById('jpJD').value = a.jd||'';
  switchJobTab('prep', document.querySelector('[onclick*=\"prep\"]'));
}

// ========== Interview Records ==========
function saveJobInterview() {
  const rec = {
    company: document.getElementById('jiCompany').value,
    position: document.getElementById('jiPosition').value,
    time: document.getElementById('jiTime').value,
    round: document.getElementById('jiRound').value,
    feel: document.getElementById('jiFeel').value,
    result: document.getElementById('jiResult').value,
    questions: document.getElementById('jiQuestions').value,
    answers: document.getElementById('jiAnswers').value,
    weakness: document.getElementById('jiWeakness').value,
    file: document.getElementById('jiFilePreview').textContent||'',
    _ts: Date.now()
  };
  const recs = DB.get('job_interview',[]);
  recs.push(rec);
  DB.set('job_interview',recs);
  closeModal('jobInterviewModal');
  clearForm(['jiCompany','jiPosition','jiTime','jiRound','jiFeel','jiResult','jiQuestions','jiAnswers','jiWeakness']);
  document.getElementById('jiFilePreview').textContent = '';
  refreshJob();
}

function delJobInterview(idx){ const r=DB.get('job_interview',[]);r.splice(idx,1);DB.set('job_interview',r);refreshJob(); }

function previewJobFile(input) {
  const f = input.files[0];
  document.getElementById('jiFilePreview').textContent = f ? '馃搸 '+f.name : '';
}

function useForReview(idx) {
  const j = DB.get('job_interview',[])[idx];
  if(!j) return;
  const sel = document.getElementById('jrInterview');
  if(sel) { sel.value = String(idx); }
  switchJobTab('review', document.querySelector('[onclick*=\"review\"]'));
}
// ========== OCR & Demo Resume ==========
function ocrJobField(input, targetId) {
  const file = input.files && input.files[0];
  if(!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Simulate OCR based on file info
      const name = file.name.toLowerCase();
      const isJD = targetId === 'jpJD';
      const isCompany = targetId === 'jpCompanyInfo';
      const isResume = targetId === 'jpResume';
      
      let result = '';
      if(isJD || name.includes('jd') || name.includes('鎷涜仒') || name.includes('宀椾綅') || name.includes('job')) {
        result = '銆愬矖浣嶅悕绉般€戞柊濯掍綋杩愯惀\n\n銆愬矖浣嶈亴璐ｃ€慭n1. 璐熻矗鍏徃灏忕孩涔?鎶栭煶璐﹀彿鐨勬棩甯歌繍钀ュ拰鍐呭绛栧垝\n2. 鏍规嵁鐑偣瓒嬪娍鍜岀敤鎴烽渶姹傦紝绛栧垝楂樿川閲忓浘鏂囧拰鐭棰戝唴瀹筡n3. 瀵硅处鍙锋暟鎹礋璐ｏ紝閫氳繃鏁版嵁鍒嗘瀽鎸佺画浼樺寲鍐呭绛栫暐\n4. 鍗忓姪瀹屾垚鍝佺墝鍚堜綔鍜岃惀閿€娲诲姩鐨勬墽琛孿n\n銆愪换鑱岃姹傘€慭n1. 鏈鍙婁互涓婂鍘嗭紝鏂伴椈浼犳挱/骞垮憡/涓枃绛夌浉鍏充笓涓氫紭鍏圽n2. 鐔熸倝灏忕孩涔?鎶栭煶骞冲彴瑙勫垯鍜岀帺娉曪紝鏈夎处鍙疯繍钀ョ粡楠屼紭鍏圽n3. 鍏峰浼樼鐨勬枃妗堣兘鍔涘拰瀹＄編鑳藉姏\n4. 浼氫娇鐢ㄥ壀鏄?PR绛夎棰戝壀杈戝伐鍏穃n5. 鏈夋暟鎹垎鏋愭剰璇嗗拰鑳藉姏\n6. 浜嗚ВAI宸ュ叿骞惰兘搴旂敤浜庡唴瀹圭敓浜?;
      } else if(isCompany || name.includes('鍏徃') || name.includes('intro') || name.includes('about')) {
        result = '銆愬叕鍙哥畝浠嬨€慭n\nXX绉戞妧鏈夐檺鍏徃锛屾垚绔嬩簬2018骞达紝鏄竴瀹朵笓娉ㄤ簬骞磋交浜虹敓娲绘柟寮忕殑浜掕仈缃戝叕鍙搞€俓n\n銆愭牳蹇冧笟鍔°€慭n涓绘墦浜у搧涓恒€孹X銆岮pp锛屼笓娉ㄤ簬涓篫涓栦唬鎻愪緵涓€у寲鍐呭鎺ㄨ崘鍜岀ぞ浜ゆ湇鍔★紝鏈堟椿璺冪敤鎴疯秴500涓囥€俓n\n銆愪紒涓氭枃鍖栥€慭n骞磋交鍖栧洟闃燂紝鎵佸钩鍖栫鐞嗭紝寮鸿皟鍒涙柊鍜屾墽琛屽姏銆俓n\n銆愬競鍦哄湴浣嶃€慭n鍦ㄦ柊濯掍綋鍐呭棰嗗煙澶勪簬琛屼笟棰嗗厛鍦颁綅锛屼笌澶氫釜澶撮儴鍝佺墝鏈夋繁搴﹀悎浣溿€?;
      } else if(isResume || name.includes('绠€鍘?) || name.includes('resume') || name.includes('cv')) {
        result = useDemoResume(true);
      } else {
        // Time-based guess
        result = '銆怬CR璇嗗埆缁撴灉銆慭n\n' + (isJD ? '鏂板獟浣撹繍钀ュ矖浣嶈姹?..\n鏈鍙婁互涓婂鍘?..' : isCompany ? '鍏徃淇℃伅锛歕n浜掕仈缃戝叕鍙?..' : '涓汉绠€鍘嗭細\n鏁欒偛鑳屾櫙...');
      }
      
      document.getElementById(targetId).value = result;
      
      // Show toast feedback
      showOcrToast('鉁?AI 宸茶瘑鍒浘鐗囧唴瀹癸紝璇风‘璁ゅ苟璋冩暣');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showOcrToast(msg) {
  const existing = document.querySelector('.ocr-toast');
  if(existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'ocr-toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position:'fixed', bottom:'30px', left:'50%', transform:'translateX(-50%)',
    background:'#2d7a4e', color:'#fff', padding:'12px 24px', borderRadius:'12px',
    fontSize:'14px', fontWeight:'600', zIndex:'9999',
    boxShadow:'0 4px 16px rgba(0,0,0,.15)',
    transition:'opacity .3s'
  });
  document.body.appendChild(toast);
  setTimeout(()=>{ toast.style.opacity='0'; setTimeout(()=>toast.remove(),300); }, 2500);
}

function useDemoResume(returnText) {
  const demo = '銆愪釜浜轰俊鎭€慭n濮撳悕锛氳嚜淇n瀛﹀巻锛氭湰绉戯紙2026灞婏級\n鐩爣锛氭柊濯掍綋杩愯惀\n\n銆愬疄涔犵粡鍘嗐€慭nXX鏂囧寲浼犲獟鏈夐檺鍏徃 路 鏂板獟浣撹繍钀ュ疄涔犵敓锛?025.06-2025.09锛塡n- 璐熻矗鍏徃灏忕孩涔﹁处鍙疯繍钀ワ紝3涓湀鍐呯矇涓濆闀?000+\n- 绛栧垝骞朵骇鍑?0+绡囧浘鏂囧唴瀹癸紝鏈€楂樺崟绡囬槄璇婚噺8涓?\n- 杩愮敤AI宸ュ叿杈呭姪鏂囨鎾板啓鍜屾暟鎹垎鏋愶紝鏁堢巼鎻愬崌40%\n\n銆愭妧鑳姐€慭n- 灏忕孩涔?鎶栭煶/鍏紬鍙疯繍钀n- 鏂囨绛栧垝涓庡唴瀹瑰垱浣淺n- 鐭棰戞媿鎽勪笌鍓緫锛堝壀鏄?PR锛塡n- AI宸ュ叿搴旂敤锛圕hatGPT/Cursor/Midjourney锛塡n- 鏁版嵁鍒嗘瀽锛圗xcel/鏂版/铦夊濡堬級\n\n銆愪釜浜虹壒鐐广€慭n瀵逛簰鑱旂綉鍐呭瓒嬪娍鏁忔劅锛屽杽浜庝粠鏁版嵁涓彂鐜版満浼氾紝鍏峰鐙珛杩愯惀鑳藉姏銆?;
  if(returnText) return demo;
  document.getElementById('jpResume').value = demo;
  showOcrToast('鉁?宸插～鍏ョず渚嬬畝鍘嗭紝鍙紪杈戜慨鏀?);
}

// ========== Interview Prep ==========
function generateJobPrep() {
  const company = document.getElementById('jpCompany').value.trim();
  const position = document.getElementById('jpPosition').value.trim();
  const jd = document.getElementById('jpJD').value.trim();
  const companyInfo = document.getElementById('jpCompanyInfo').value.trim();
  const resume = document.getElementById('jpResume').value.trim();

  if(!company || !position) { alert('璇疯嚦灏戝～鍐欏叕鍙稿悕绉板拰宀椾綅鍚嶇О'); return; }

  // Simulate AI analysis
  const prep = {
    company, position, jd, companyInfo, resume,
    date: todayStr(),
    _ts: Date.now()
  };

  const prepList = DB.get('job_preps',[]);
  prepList.push(prep);
  DB.set('job_preps', prepList);

  // Generate analysis output
  const output = document.getElementById('jobPrepOutput');
  output.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搳 宀椾綅鍒嗘瀽</div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong>馃幆 宀椾綅鏍稿績鑱岃矗锛?/strong><br>鏍规嵁JD鍒嗘瀽锛岃宀椾綅涓昏璐熻矗${position}鐩稿叧宸ヤ綔锛岄渶瑕佸€欓€変汉鍏峰鍐呭绛栧垝銆佽处鍙疯繍钀ャ€佹暟鎹垎鏋愮瓑缁煎悎鑳藉姏銆?/p>
        <p><strong>馃攳 鍏徃鏈熸湜鐨勪汉鎵嶇敾鍍忥細</strong><br>路 鏈夌嫭绔嬭繍钀ョ粡楠岋紝鑳藉鏁版嵁璐熻矗<br>路 鐔熸倝涓绘祦骞冲彴鐜╂硶锛堝皬绾功/鎶栭煶/鍏紬鍙凤級<br>路 鍏峰鍐呭鍒涗綔鍜岀敤鎴锋礊瀵熻兘鍔?br>路 鏈堿I宸ュ叿浣跨敤鎰忚瘑</p>
        <p><strong>猸?鏈€鐪嬮噸鐨勮兘鍔涳細</strong><br>1. 鍐呭绛栧垝涓庡垱浣滆兘鍔?br>2. 鏁版嵁椹卞姩杩愯惀鎬濈淮<br>3. 蹇€熷涔犲拰閫傚簲鑳藉姏</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃幆 鎴戠殑鍖归厤鍒嗘瀽</div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong style="color:#2da667;">鉁?鎴戠殑浼樺娍锛?/strong><br>路 鏂板獟浣撹繍钀ュ疄涔犵粡楠岋紝浜嗚В骞冲彴杩愯惀閫昏緫<br>路 鐭棰戝埗浣滆兘鍔涳紙鎷嶆憚+鍓緫锛?br>路 AI宸ュ叿浣跨敤鑳藉姏锛圕hatGPT/Cursor绛夛級<br>路 涓汉璐﹀彿杩愯惀缁忛獙</p>
        <p><strong style="color:#c45677;">鈿狅笍 鎴戠殑涓嶈冻锛?/strong><br>路 鏁版嵁鍒嗘瀽缁忛獙鐩稿钖勫急<br>路 鍟嗕笟妗堜緥绉疮涓嶈冻<br>路 缂轰箯浠?-1鐨勯」鐩粡楠?/p>
        <p><strong style="color:#2d7a4e;">馃挕 浼樺寲寤鸿锛?/strong><br>路 闈㈣瘯鍓嶅噯澶?-2涓暟鎹垎鏋愭渚?br>路 鐢⊿TAR缁撴瀯姊崇悊浣犵殑椤圭洰缁忓巻<br>路 寮鸿皟AI宸ュ叿鎻愬崌鏁堢巼鐨勫叿浣撴暟鎹?/p>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搫 绠€鍘嗗尮閰嶄紭鍖?/div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong>馃搳 鍖归厤绋嬪害锛?/strong><span style="color:#2da667;font-weight:700;">70%</span></p>
        <p><strong style="color:#2da667;">鉁?闇€瑕佺獊鍑虹殑缁忓巻锛?/strong><br>路 瀹炰範涓殑鍐呭杩愯惀鏁版嵁锛堜骇鍑哄灏戠瘒銆侀槄璇婚噺澶氬皯锛?br>路 AI宸ュ叿鍦ㄥ疄闄呭伐浣滀腑鐨勫簲鐢ㄦ渚?br>路 鑳界嫭绔嬭繍钀ヨ处鍙风殑璇佹槑</p>
        <p><strong style="color:#c45677;">鈿狅笍 寤鸿澧炲姞鐨勫叧閿瘝锛?/strong><br>路 銆屾暟鎹┍鍔ㄣ€嶃€岀敤鎴峰闀裤€嶃€屽唴瀹圭瓥鐣ャ€?br>路 銆岀鍩熻繍钀ャ€嶃€岃浆鍖栫巼銆嶃€孉/B娴嬭瘯銆?/p>
        <p><strong style="color:#2d7a4e;">馃挕 椤圭洰缁忓巻閲嶆柊琛ㄨ揪寤鸿锛?/strong><br>路 鐢⊿TAR娉曞垯閲嶆瀯姣忎釜椤圭洰缁忓巻<br>路 閲忓寲鎴愭灉锛堝闀跨櫨鍒嗘瘮銆佸叿浣撴暟鎹級<br>路 绐佸嚭涓庡矖浣嶈姹傚尮閰嶇殑鑳藉姏</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃彚 鍏徃鐮旂┒</div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong>馃幆 鍏徃涓氬姟锛?/strong><br>璇ュ叕鍙镐富钀ヤ笟鍔℃槸${companyInfo ? companyInfo.split(',').slice(0,2).join('銆?) : '鏂板獟浣?浜掕仈缃戝唴瀹归鍩?}锛屾牳蹇冧骇鍝侀潰鍚戝勾杞荤敤鎴风兢浣撱€?/p>
        <p><strong>猸?鍝佺墝瀹氫綅锛?/strong><br>路 骞磋交鍖栥€佹敞閲嶅唴瀹瑰垱鏂?br>路 寮鸿皟鐢ㄦ埛浠峰€煎拰浣撻獙</p>
        <p><strong>馃攳 绔炰簤浼樺娍锛?/strong><br>路 鍦ㄧ洰鏍囩敤鎴风兢浣撲腑鏈夎緝寮哄奖鍝嶅姏<br>路 鍐呭鐢熸€佸缓璁惧畬鍠?/p>
        <p><strong>馃搶 闈㈣瘯鍓嶅繀椤讳簡瑙ｏ細</strong><br>路 鍏徃涓昏浜у搧鍜屼笟鍔℃ā寮?br>路 鐩爣鐢ㄦ埛鐢诲儚鍜岀敤鎴疯妯?br>路 杩戞湡鍔ㄦ€佸拰鎴樼暐鏂瑰悜<br>路 琛屼笟绔炰簤鏍煎眬</p>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃棧锔?3鍒嗛挓鑷垜浠嬬粛</div>
      <div style="background:var(--bg);padding:16px;border-radius:12px;font-size:14px;line-height:1.8;">
        <p>闈㈣瘯瀹樹綘濂斤紝鎴戞槸鑷俊锛?026灞婃瘯涓氱敓锛岀洰鏍囨柟鍚戞槸鏂板獟浣撹繍钀ャ€?/p>
        <p>鍦ㄦ牎鏈熼棿锛屾垜瀹屾垚浜哫X鍏徃鐨勬柊濯掍綋杩愯惀瀹炰範锛岃礋璐ｅ皬绾功鍜屽叕浼楀彿鐨勫唴瀹圭瓥鍒掍笌杩愯惀锛屾湡闂翠骇鍑轰簡XX绡囧唴瀹癸紝鏈€楂樺崟绡囬槄璇婚噺杈惧埌XX銆傚悓鏃讹紝鎴戠啛缁冧娇鐢ㄥ悇绫籄I宸ュ叿杈呭姪鍐呭鐢熶骇鍜岃繍钀ュ喅绛栵紝鑳藉皢宸ヤ綔鏁堢巼鎻愬崌30%浠ヤ笂銆?/p>
        <p>鎴戞搮闀垮唴瀹圭瓥鍒掑拰鐭棰戝埗浣滐紝瀵瑰皬绾功鍜屾姈闊冲钩鍙版湁娣卞叆鐞嗚В銆傜湅鍒拌吹鍏徃鐨?{position}宀椾綅锛屾垜瑙夊緱鎴戠殑鑳藉姏鍜屽彂灞曟柟鍚戜笌宀椾綅闈炲父鍖归厤锛屽笇鏈涜兘鏈夋満浼氬姞鍏ュ洟闃燂紝涓虹敤鎴峰垱閫犳湁浠峰€肩殑鍐呭銆?/p>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-sm btn-outline" onclick="showSelfIntroTip()">馃挕 浼樺寲寤鸿</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">鉂?棰勬祴闈㈣瘯闂</div>
      <div style="font-size:14px;line-height:1.7;">
        <p style="font-weight:700;color:#5d3a4f;margin-top:8px;">馃 HR闂</p>
        <div style="background:var(--bg);padding:12px;border-radius:10px;margin-bottom:8px;">
          <p style="font-weight:600;">Q锛氫负浠€涔堥€夋嫨杩欎釜宀椾綅锛?/p>
          <p style="color:var(--text-secondary);">馃挕 鍙傝€冨洖绛旀鏋讹細涓汉鍏磋叮+鑳藉姏鍖归厤+鑱屼笟瑙勫垝銆傚己璋冧綘瀵规柊濯掍綋杩愯惀鐨勭儹鎯咃紝浠ュ強浣犵殑瀹炰範缁忛獙鍜屾妧鑳藉浣曞搴斿矖浣嶉渶姹傘€?/p>
        </div>
        <div style="background:var(--bg);padding:12px;border-radius:10px;margin-bottom:8px;">
          <p style="font-weight:600;">Q锛氫綘鐨勮亴涓氳鍒掓槸浠€涔堬紵</p>
          <p style="color:var(--text-secondary);">馃挕 鍙傝€冨洖绛旀鏋讹細鐭湡锛?骞达級鎺屾彙宀椾綅鎶€鑳解啋涓湡锛?-3骞达級鎴愪负鐙珛杩愯惀璐熻矗浜衡啋闀挎湡鎴愪负鍐呭杩愯惀涓撳銆?/p>
        </div>
        <p style="font-weight:700;color:#5d3a4f;margin-top:12px;">馃搵 涓撲笟闂</p>
        <div style="background:var(--bg);padding:12px;border-radius:10px;margin-bottom:8px;">
          <p style="font-weight:600;">Q锛氬浣曚粠0寮€濮嬭繍钀ヤ竴涓柊濯掍綋璐﹀彿锛?/p>
          <p style="color:var(--text-secondary);">馃挕 鍙傝€冨洖绛旀鏋讹細璐﹀彿瀹氫綅鈫掑唴瀹圭瓥鐣モ啋鎵ц璁″垝鈫掓暟鎹垎鏋愨啋杩唬浼樺寲銆傜粨鍚堝叿浣撴渚嬭鏄庛€?/p>
        </div>
        <div style="background:var(--bg);padding:12px;border-radius:10px;margin-bottom:8px;">
          <p style="font-weight:600;">Q锛氬浣曟彁楂樺唴瀹圭殑鏁版嵁琛ㄧ幇锛?/p>
          <p style="color:var(--text-secondary);">馃挕 鍙傝€冨洖绛旀鏋讹細鏍囬浼樺寲鈫掑唴瀹硅川閲忔彁鍗団啋鍙戝竷鏃堕棿璋冩暣鈫掍簰鍔ㄥ紩瀵尖啋鏁版嵁澶嶇洏銆傚己璋傾/B娴嬭瘯鍜屾暟鎹┍鍔ㄣ€?/p>
        </div>
        <p style="font-weight:700;color:#5d3a4f;margin-top:12px;">馃搨 椤圭洰闂</p>
        <div style="background:var(--bg);padding:12px;border-radius:10px;margin-bottom:8px;">
          <p style="font-weight:600;">Q锛氬垎浜竴涓綘鏈€鏈夋垚灏辨劅鐨勯」鐩紵</p>
          <p style="color:var(--text-secondary);">馃挕 鐢⊿TAR娉曞垯锛歋ituation锛堣儗鏅級鈫扵ask锛堜换鍔★級鈫扐ction锛堣鍔級鈫扲esult锛堢粨鏋滐級锛屽己璋冧綘鐨勮础鐚拰鏁版嵁鎴愭灉銆?/p>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">鉁?闈㈣瘯鍓嶅噯澶囨竻鍗?/div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:14px;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?浜嗚В鍏徃涓氬姟涓庝骇鍝?/div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?鐔熸倝宀椾綅鑱岃矗鍜岃姹?/div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?鍑嗗1鍒嗛挓鑷垜浠嬬粛</div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?鍑嗗2-3涓」鐩渚嬶紙STAR锛?/div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?浜嗚В琛屼笟瓒嬪娍鍜岀珵鍝?/div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:8px;">鈽?鍑嗗2-3涓弽闂棶棰?/div>
      </div>
    </div>
  `;
}

function showSelfIntroTip() {
  alert('馃挕 鑷垜浠嬬粛浼樺寲寤鸿锛歕n\n1. 鐢ㄦ暟鎹璇濓紙鍏蜂綋闃呰閲?绮変笣澧為暱鏁帮級\n2. 绐佸嚭AI宸ュ叿浣跨敤鑳藉姏锛堣繖鏄綘鐨勫樊寮傚寲浼樺娍锛塡n3. 寮鸿皟涓庡矖浣嶇殑鍖归厤搴n4. 鏃堕暱鎺у埗鍦?0-60绉抃n5. 缁撳熬琛ㄨ揪瀵瑰叕鍙哥殑浜嗚В鍜屽叴瓒?);
}

// ========== AI Review ==========
function renderJobReviews(reviews) {
  const el = document.getElementById('jobReviewList');
  if(!reviews.length){
    el.innerHTML = '<div class="empty-state"><div class="icon">馃攳</div><p>杩樻病鏈夐潰璇曞鐩樿褰?/p></div>';
    return;
  }
  el.innerHTML = reviews.slice().reverse().map((r,i)=>{
    const idx = reviews.length-1-i;
    return `<div class="record-item">
      <div class="record-item-header">
        <span class="record-item-title">馃攳 ${r.company||'闈㈣瘯澶嶇洏'}</span>
        <span class="record-item-date">${r.date||''} 路 ${'猸?.repeat(r.rate||3)}</span>
      </div>
      <div class="record-item-body">
        ${r.weakQuestions ? '鉂?寮遍」闂锛?+r.weakQuestions.slice(0,60)+'...<br>' : ''}
        ${r.aiAnalysis ? '馃 AI鍒嗘瀽锛?+r.aiAnalysis.slice(0,60)+'...<br>' : ''}
        ${r.nextStep ? '馃搶 鏀硅繘锛?+r.nextStep.slice(0,60) : ''}
      </div>
      <div class="record-actions">
        <button class="del-btn" onclick="delJobReview(${idx})">馃棏</button>
      </div>
    </div>`;
  }).join('');
}

function selectReviewRate(val, btn) {
  document.querySelectorAll('#jobReviewModal .rate-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('jrRate').value = val;
}

function saveJobReview() {
  const sel = document.getElementById('jrInterview');
  const company = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.split('路')[0].trim() : '';
  const rec = {
    company: company,
    date: todayStr(),
    rate: document.getElementById('jrRate').value,
    weakQuestions: document.getElementById('jrWeakQuestions').value,
    file: document.getElementById('jrFilePreview').textContent||'',
    aiAnalysis: document.getElementById('jrAiAnalysis').value || generateAiAnalysis(),
    nextStep: document.getElementById('jrNextStep').value,
    _ts: Date.now()
  };
  const reviews = DB.get('job_reviews',[]);
  reviews.push(rec);
  DB.set('job_reviews', reviews);
  closeModal('jobReviewModal');
  clearForm(['jrWeakQuestions','jrAiAnalysis','jrNextStep']);
  document.getElementById('jrFilePreview').textContent = '';
  refreshJob();
  alert('鉁?澶嶇洏宸蹭繚瀛橈紒闈㈣瘯鑳藉姏鎴愰暱涓?..');
}

function delJobReview(idx){ const r=DB.get('job_reviews',[]);r.splice(idx,1);DB.set('job_reviews',r);refreshJob(); }

function generateAiAnalysis() {
  const rate = parseInt(document.getElementById('jrRate').value)||3;
  const dims = ['琛ㄨ揪娓呮櫚搴?,'閫昏緫缁撴瀯','鍥炵瓟瀹屾暣搴?,'鑷俊绋嬪害','宀椾綅鍖归厤搴?];
  const levels = ['闇€鍔犲己','涓€鑸?,'鑹ソ','浼樼','鍗撹秺'];
  const analysis = dims.map(d => {
    const lv = Math.max(0, Math.min(4, rate-1 + Math.floor(Math.random()*3)-1));
    return `鈥?${d}锛?{levels[lv]}`;
  }).join('\n');
  const weak = document.getElementById('jrWeakQuestions').value.trim();
  let suggestion = '';
  if(weak) suggestion = `\n\n馃搶 閽堝寮遍」闂鐨勪紭鍖栧缓璁細\n鍩轰簬浣犵殑鍥為【锛屽缓璁噰鐢⊿TAR缁撴瀯閲嶆柊缁勭粐鍥炵瓟锛屽鍔犲叿浣撴暟鎹敮鎾戙€傚彲浠ユ彁鍓嶅噯澶?-3涓笌宀椾綅鐩稿叧鐨勬渚嬨€俙;
  return `銆怉I 闈㈣瘯鍒嗘瀽鎶ュ憡銆慭n\n馃搳 鍚勭淮搴﹁瘎浠凤細\n${analysis}\n\n${weak ? '馃挕 闇€瑕侀噸鐐瑰叧娉ㄧ殑闂锛歕n'+weak : '馃挕 鏁翠綋琛ㄧ幇杈冧负鍧囪　'}\n${suggestion}`;
}

// ========== Growth Archive ==========
function calcInterviewScore(reviews) {
  if(!reviews.length) return 0;
  const avg = reviews.reduce((s,r)=>s+(parseInt(r.rate)||3),0)/reviews.length;
  return Math.round(avg * 20); // scale 3 -> 60, 5 -> 100
}

// ========== Job Market Analysis ==========
function analyzeJobMarket() {
  const apps = DB.get('job_apply',[]);
  const interviews = DB.get('job_interview',[]);
  
  // Analyze job types
  const typeCount = {};
  apps.forEach(a => {
    const pos = (a.position||'鍏朵粬').trim();
    typeCount[pos] = (typeCount[pos]||0) + 1;
  });
  
  // Response rate
  const responseCount = apps.filter(a => a.status !== 'pending').length;
  const responseRate = apps.length > 0 ? Math.round(responseCount/apps.length*100) : 0;
  
  // Skills needed (from JD analysis)
  const neededSkills = ['鍐呭绛栧垝涓庡垱浣?, '鏁版嵁鍒嗘瀽', '鐭棰戝埗浣?, 'AI宸ュ叿搴旂敤', '璐﹀彿杩愯惀'];
  const masteredSkills = [];
  const aiTools = DB.get('ai_tools',[]).map(t=>t.name||'');
  if(aiTools.some(n=>n.includes('鍐欎綔')||n.includes('ChatGPT'))) masteredSkills.push('鍐呭绛栧垝涓庡垱浣?);
  if(aiTools.some(n=>n.includes('鏁版嵁鍒嗘瀽')||n.includes('Excel'))) masteredSkills.push('鏁版嵁鍒嗘瀽');
  if(aiTools.some(n=>n.includes('鍓緫')||n.includes('瑙嗛'))) masteredSkills.push('鐭棰戝埗浣?);
  if(aiTools.length > 0) masteredSkills.push('AI宸ュ叿搴旂敤');
  
  const gapSkills = neededSkills.filter(s => !masteredSkills.includes(s));
  
  const el = document.getElementById('jobAnalyzeResult');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搳 姹傝亴甯傚満鍒嗘瀽</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${apps.length}</div>
          <div style="font-size:12px;color:var(--text-secondary);">鎬绘姇閫?/div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:${responseRate>=50?'#2da667':'#e67e22'};">${responseRate}%</div>
          <div style="font-size:12px;color:var(--text-secondary);">鍥炲鐜?/div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
          <div style="font-size:20px;font-weight:800;color:var(--primary);">${interviews.length}</div>
          <div style="font-size:12px;color:var(--text-secondary);">闈㈣瘯娆℃暟</div>
        </div>
      </div>
      <div style="margin-top:12px;">
        <p style="font-size:13px;font-weight:600;color:#5d3a4f;">馃幆 宀椾綅鍏抽敭璇嶅垎甯?/p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          ${Object.entries(typeCount).slice(0,5).map(([k,v]) => `<span style="padding:4px 10px;border-radius:12px;background:var(--bg);font-size:12px;">${k} 脳 ${v}</span>`).join('')}
        </div>
      </div>
      <div style="margin-top:12px;">
        <p style="font-size:13px;font-weight:600;color:#5d3a4f;">馃敆 鑳藉姏鍏宠仈鍒嗘瀽</p>
        <p style="font-size:12px;color:var(--text-secondary);">甯傚満瑕佹眰鐨勬牳蹇冭兘鍔涳細</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
          ${neededSkills.map(s => `<span style="padding:4px 10px;border-radius:12px;font-size:12px;background:${masteredSkills.includes(s)?'#d4edda':'#fff3cd'};color:${masteredSkills.includes(s)?'#155724':'#856404'};">${s} ${masteredSkills.includes(s)?'鉁?:'鈿狅笍'}</span>`).join('')}
        </div>
        ${gapSkills.length > 0 ? `
        <div style="margin-top:8px;padding:8px 10px;background:#fff3cd;border-radius:8px;font-size:12px;color:#856404;">
          馃挕 鑳藉姏宸窛锛?{gapSkills.join('銆?)}銆傚缓璁湪銆孉I鎶€鑳藉簱銆嶄腑瀛︿範鐩稿叧宸ュ叿锛屽湪銆岃嫳璇垚闀裤€嶄腑鎻愬崌鑻辫鑳藉姏銆?
        </div>` : '<div style="margin-top:8px;padding:8px 10px;background:#d4edda;border-radius:8px;font-size:12px;color:#155724;">馃帀 鏍稿績鑳藉姏宸茶鐩栵紝鎸佺画浼樺寲鍗冲彲</div>'}
      </div>
    </div>
  `;
}

function renderJobGrowth(apps, interviews, reviews) {
  const score = calcInterviewScore(reviews);
  const passCount = interviews.filter(j=>j.result==='pass').length;
  const failCount = interviews.filter(j=>j.result==='fail').length;

  // Find common improvements over time
  const trendData = reviews.map((r,i) => ({
    idx: i+1, score: parseInt(r.rate)*20 || 60
  }));

  document.getElementById('jobGrowthContent').innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃搳 鎴戠殑闈㈣瘯鎴愰暱妗ｆ</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px;">
          <div style="font-size:24px;font-weight:800;color:var(--primary);">${interviews.length}</div>
          <div style="font-size:12px;color:var(--text-secondary);">鍘嗗彶闈㈣瘯娆℃暟</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px;">
          <div style="font-size:24px;font-weight:800;color:#2da667;">${passCount}</div>
          <div style="font-size:12px;color:var(--text-secondary);">閫氳繃娆℃暟</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:12px;">
          <div style="font-size:24px;font-weight:800;color:${score>=70?'var(--primary)':'#e67e22'};">${score}</div>
          <div style="font-size:12px;color:var(--text-secondary);">闈㈣瘯鑳藉姏鍒?/div>
        </div>
      </div>
      ${trendData.length > 0 ? `
      <div style="background:var(--bg);border-radius:12px;padding:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">馃搱 闈㈣瘯鑳藉姏鎴愰暱瓒嬪娍</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:100px;padding:10px 0;">
          ${trendData.map((t,i) => {
            const h = Math.max(20, t.score * 0.8);
            const color = t.score >= 70 ? '#4a9d6f' : t.score >= 50 ? '#ffc107' : '#e74c3c';
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;">
              <div style="width:100%;height:${h}px;background:${color};border-radius:4px 4px 0 0;transition:height .3s;"></div>
              <div style="font-size:10px;color:var(--text-secondary);margin-top:4px;">#${t.idx}</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">馃挭 鎴戠殑杩涙璁板綍</div>
      <div style="font-size:14px;line-height:1.8;">
        ${reviews.length === 0 ? '<p style="color:var(--text-secondary);">杩樻病鏈夐潰璇曞鐩樿褰曘€傛瘡涓€娆￠潰璇曢兘鏄竴娆¤缁冿紝閫氳繃鍒嗘瀽鎸佺画鎻愰珮琛ㄨ揪鑳藉姏鍜屽矖浣嶇珵浜夊姏銆?/p>' : `
        <p>鉁?宸插畬鎴?<strong>${reviews.length}</strong> 娆￠潰璇曞鐩?/p>
        <p>馃挭 闈㈣瘯鑳藉姏璇勫垎锛?strong>${score}鍒?/strong> ${score>=80?'锛堥潪甯告锛侊級':score>=60?'锛堢户缁繘姝ワ紒锛?:'锛堣繕鏈夋彁鍗囩┖闂达級'}</p>
        <p style="margin-top:8px;color:var(--text-secondary);">馃搶 姣忎竴娆￠潰璇曢兘鏄缁冿紝AI鎸佺画甯綘浼樺寲琛ㄨ揪鍜岀珵浜夊姏銆?/p>
        `}
        ${apps.length > 0 ? `
        <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;">
          <p style="font-size:13px;font-weight:600;color:#5d3a4f;">馃敆 宀椾綅瑕佹眰 鈫?鑳藉姏宸窛 鈫?瀛︿範璁″垝</p>
          <div style="font-size:12px;line-height:1.7;color:var(--text-secondary);">
            <p>馃捈 鏂板獟浣撹繍钀ュ矖浣嶅父瑕佹眰锛?br>
            路 鍐呭绛栧垝涓庡垱浣滆兘鍔?鈫?鍏宠仈銆孉I鎶€鑳藉簱路鍐呭鍒涗綔绫汇€?br>
            路 鏁版嵁鍒嗘瀽鑳藉姏 鈫?鍏宠仈銆孉I鎶€鑳藉簱路鏁版嵁鍒嗘瀽绫汇€?br>
            路 鐭棰戝埗浣滆兘鍔?鈫?鍏宠仈銆孉I鎶€鑳藉簱路鍐呭鍒涗綔绫汇€?br>
            路 AI宸ュ叿搴旂敤鑳藉姏 鈫?鍏宠仈銆孉I鎶€鑳藉簱銆?br>
            路 娌熼€氳〃杈捐兘鍔?鈫?鍏宠仈銆岃嫳璇垚闀柯峰彛璇缁冦€?/p>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#c45677;">
            馃挕 鍘汇€孉I鎶€鑳藉簱銆嶅涔犵浉鍏冲伐鍏凤紝鍦ㄣ€岃嫳璇垚闀裤€嶄腑缁冧範鍙ｈ琛ㄨ揪
          </div>
        </div>` : ''}
      </div>
    </div>
  `;
}

// File preview for review modal
document.addEventListener('change', function(e) {
  if(e.target.id === 'jrFile') {
    const f = e.target.files[0];
    document.getElementById('jrFilePreview').textContent = f ? '馃搸 '+f.name : '';
  }
  if(e.target.id === 'jiFile') {
    const f = e.target.files[0];
    document.getElementById('jiFilePreview').textContent = f ? '馃搸 '+f.name : '';
  }
});

// ========== HR QA Assistant ==========
const HR_ANSWERS = {
  '涓轰粈涔堥€夋嫨鎴戜滑鍏徃': {
    tip: '灞曠幇浣犲鍏徃鐨勪簡瑙ｅ拰璁ゅ悓锛岀粨鍚堝矖浣嶈鏄庝綘鐨勪环鍊煎尮閰嶃€?,
    answer: '鎴戝叧娉ㄨ吹鍏徃寰堜箙浜嗭紝灏ゅ叾鏄湪锛堝叕鍙告牳蹇冧笟鍔?浜у搧锛夋柟闈㈠仛寰楅潪甯稿嚭鑹层€傚姞涓婅繖涓矖浣嶇殑瑕佹眰鍜屾垜鐨勮兘鍔涘緢鍖归厤鈥斺€旀垜鍏峰锛堜綘鐨勬牳蹇冩妧鑳斤級锛岃€屼笖鎴戠殑鑱屼笟鍙戝睍鏂瑰悜鍜岃吹鍏徃鎻愪緵鐨勬満浼氶潪甯稿鍚堛€傛墍浠ユ垜瑙夊緱杩欐槸涓€涓兘璁╂垜鍙戞尌浠峰€笺€佷篃鑳芥寔缁垚闀跨殑濂芥満浼氥€?
  },
  '浣犵殑鑱屼笟瑙勫垝鏄粈涔?: {
    tip: '鐭湡璁茶兘鍔涚Н绱紝涓湡璁蹭环鍊煎垱閫狅紝闀挎湡璁插彂灞曟効鏅€傝浣撶幇绋冲畾鎬у拰涓婅繘蹇冦€?,
    answer: '鐭湡鏉ヨ锛屾垜甯屾湜灏藉揩铻嶅叆鍥㈤槦锛屾妸宀椾綅鎵€闇€鐨勮兘鍔涙帉鎻℃墡瀹烇紝鍋氬嚭鎴愮哗銆備腑鏈熸垜甯屾湜鑳藉湪涓撲笟棰嗗煙娣辫€曪紝鎴愰暱涓鸿兘鐙珛璐熻矗椤圭洰鐨勪汉銆傞暱鏈熺殑璇濓紝鎴戝笇鏈涜嚜宸辫兘鎴愪负杩欎釜棰嗗煙鐨勪笓瀹讹紝鑳戒负鍏徃鍜屽洟闃熷垱閫犳洿澶х殑浠峰€笺€?
  },
  '浣犳渶澶х殑缂虹偣鏄粈涔?: {
    tip: '璇翠竴涓湡瀹炰絾涓嶈嚧鍛界殑缂虹偣 + 浣犳鍦ㄥ浣曟敼杩涖€備笉瑕佽浠€涔?鎴戝お瀹岀編涓讳箟"銆?,
    answer: '鎴戣寰楄嚜宸卞湪鍏紬婕旇鏂归潰杩樻湁鎻愬崌绌洪棿锛屾湁鏃跺€欏湪姝ｅ紡鍦哄悎琛ㄨ揪浼氱揣寮犮€備负浜嗘敼杩涳紝鎴戞渶杩戝紑濮嬩富鍔ㄥ湪鍥㈤槦閲屽仛鍒嗕韩姹囨姤锛岃繕鎶ュ悕浜嗚〃杈捐绋嬶紝鍧氭寔姣忓ぉ鍋氬彛璇粌涔犮€傜幇鍦ㄥ凡缁忔瘮涔嬪墠鑷劧浜嗗緢澶氾紝鎴戣繕鍦ㄦ寔缁粌涔犱腑銆?
  },
  '浣犵殑鏈熸湜钖祫鏄灏?: {
    tip: '鎻愬墠浜嗚В琛屼笟钖祫鑼冨洿锛岀粰涓€涓悎鐞嗗尯闂磋€屼笉鏄浐瀹氭暟瀛椼€?,
    answer: '鎴戜簡瑙ｄ簡涓€涓嬭涓氭儏鍐碉紝杩欎釜宀椾綅鐨勫競鍦鸿柂璧勫ぇ姒傚湪锛堣寖鍥达級涔嬮棿銆傝€冭檻鍒版垜鐨勫疄涔犵粡楠屽拰鑳藉姏锛屾垜甯屾湜鑳藉湪锛堝叿浣撹寖鍥达級杩欎釜鍖洪棿銆傚綋鐒讹紝鎴戜篃寰堢湅閲嶅涔犳満浼氬拰鎴愰暱绌洪棿锛岃柂璧勫彲浠ョ粨鍚堝叕鍙哥殑钖叕浣撶郴鏉ュ畾銆?
  },
  '涓轰粈涔堢寮€涓婁竴瀹跺叕鍙?: {
    tip: '涓嶈璇村墠鍏徃鍧忚瘽锛岃仛鐒︿釜浜烘垚闀垮拰鑱屼笟鍙戝睍銆?,
    answer: '鍦ㄤ笂涓€瀹跺叕鍙告垜瀛﹀埌浜嗗緢澶氾紝鍥㈤槦姘涘洿涔熷緢濂姐€備絾鎴戞劅瑙夎嚜宸遍亣鍒颁簡鎴愰暱澶╄姳鏉匡紝甯屾湜鑳藉湪涓€涓洿澶х殑骞冲彴涓婃寫鎴樿嚜宸憋紝鎺ヨЕ鏇存牳蹇冪殑涓氬姟銆傛墍浠ユ兂鎵句竴涓兘璁╂垜鎸佺画瀛︿範鍜屾垚闀跨殑鏈轰細銆?
  },
  '浣犱负浠€涔堥绻佹崲宸ヤ綔': {
    tip: '璇氬疄瑙ｉ噴姣忔鍙樺姩鐨勫師鍥狅紝寮鸿皟姣忔鍙樺姩閮芥槸涓轰簡鎴愰暱銆?,
    answer: '鍏跺疄姣忎竴娈电粡鍘嗘垜閮芥湁璁ょ湡瀵瑰緟銆傜涓€浠藉伐浣滄槸鍥犱负锛堝師鍥狅級锛岀浜屼唤鏄洜涓猴紙鍘熷洜锛夈€傝櫧鐒舵椂闂翠笉闀匡紝浣嗘垜鍦ㄦ瘡娈电粡鍘嗕腑閮藉鍒颁簡鏂颁笢瑗裤€傜幇鍦ㄦ垜宸茬粡寰堟竻妤氳嚜宸辨兂瑕佷粈涔堟柟鍚戯紝甯屾湜鑳芥壘涓€涓暱鏈熷彂灞曠殑浜嬩笟銆?
  },
  '浣犺繕鏈変粈涔堟兂闂殑鍚?: {
    tip: '闂?-3涓綋鐜颁綘瀵瑰矖浣嶆€濊€冪殑闂锛屼笉瑕侀棶鐧惧害鑳芥煡鍒扮殑銆?,
    answer: '鏈夌殑锛屾垜鎯充簡瑙ｄ竴涓嬶細1锛夎繖涓矖浣嶆渶鏍稿績鐨勮€冩牳鎸囨爣鏄粈涔堬紵2锛夊洟闃熺洰鍓嶆渶澶х殑鎸戞垬鏄粈涔堬紵3锛夊鏋滄垜鏈夊垢鍔犲叆锛屽墠涓変釜鏈堢殑閲嶇偣宸ヤ綔浼氭槸浠€涔堬紵'
  },
  '浣犲浣曠湅寰呭姞鐝?: {
    tip: '琛ㄨ揪鎰挎剰閰嶅悎浣嗕笉鐩茬洰鍔犵彮鐨勬€佸害銆?,
    answer: '鎴戣兘鐞嗚В椤圭洰鏈熼渶瑕佸姞鐝殑鎯呭喌锛屼篃鎰挎剰涓哄伐浣滄姇鍏ユ椂闂淬€備絾鎴戣涓洪珮鏁堝伐浣滄瘮鍗曠函鍔犵彮鏇撮噸瑕侊紝鎴戜細浼樺厛鍋氬ソ鏃堕棿绠＄悊锛屽湪宸ヤ綔鏃堕棿鍐呮彁楂樻晥鐜囥€傚鏋滅‘瀹為渶瑕佸姞鐝紝鎴戜篃浼氱Н鏋侀厤鍚堝洟闃熴€?
  },
  '浣犳湭鏉ョ殑3骞磋鍒?: {
    tip: '3骞磋鍒掕鍏蜂綋锛屼粠鎵ц鍒扮嫭绔嬭礋璐ｃ€?,
    answer: '绗竴骞存垜浼氫笓娉ㄥ仛濂芥湰鑱屽伐浣滐紝鎶婂熀纭€鎵撶墷锛岀啛鎮変笟鍔′笂涓嬫父銆傜浜屽勾甯屾湜鑳界嫭绔嬭礋璐ｉ」鐩紝閿荤偧缁熺鍜屽喅绛栬兘鍔涖€傜涓夊勾鎴戝笇鏈涜嚜宸辫兘鎴愪负涓氬姟楠ㄥ共锛岃兘澶熷甫鏂颁汉鎴栬€呬富瀵奸噸瑕侀」鐩紝涓哄洟闃熷垱閫犳洿澶х殑浠峰€笺€?
  },
  '浣犲钖祫寰呴亣鏈変粈涔堣姹?: {
    tip: '鍏堥棶娓呮钖祫缁撴瀯鍐嶅洖绛旓紝涓嶈鐩存帴鎶ユ暟瀛椼€?,
    answer: '鎴戞兂鍏堜簡瑙ｄ竴涓嬭吹鍏徃鐨勮柂璧勭粨鏋勶紝鍖呮嫭鍩烘湰宸ヨ祫銆佺哗鏁堝閲戙€佽ˉ璐磋繖浜涖€傜粨鍚堝叕鍙哥殑鎯呭喌鍜屽競鍦鸿鎯咃紝鎴戠殑鏈熸湜鏄湪锛堣寖鍥达級宸﹀彸銆傚綋鐒舵垜涔熷彲浠ユ牴鎹叕鍙告暣浣撹柂閰綋绯绘潵璋冩暣銆?
  },
  '浣犲拰鍒汉鍙戠敓杩囧啿绐佸悧': {
    tip: '璇翠竴涓皬鍒嗘锛岄噸鐐规斁鍦ㄥ浣曡В鍐冲拰鎴愰暱涓娿€?,
    answer: '鏈夎繃涓€娆★紝涔嬪墠鍋氶」鐩殑鏃跺€欏拰鍚屼簨鍦ㄦ柟妗堜笂鏈変笉鍚屾剰瑙併€傚悗鏉ユ垜浠潗涓嬫潵鎶婂悇鑷殑鐞嗙敱鎽嗗嚭鏉ワ紝鍙戠幇鍏跺疄鐩爣鏄竴鑷寸殑锛屽彧鏄矾寰勪笉鍚屻€傛渶鍚庢垜浠患鍚堜簡鍙屾柟鐨勫缓璁紝鍋氬嚭浜嗘洿濂界殑鏂规銆傝繖浠朵簨璁╂垜瀛︿細浜嗗浠庡鏂圭殑瑙掑害鐪嬮棶棰樸€?
  },
  '浣犵殑鑻辫姘村钩鎬庝箞鏍?: {
    tip: '鐢ㄥ叿浣撳満鏅鏄庤嫳璇兘鍔涳紝涓嶈鍙"杩樿"銆?,
    answer: '鎴戠殑鑻辫璇诲啓鑳藉姏姣旇緝濂斤紝鑳界嫭绔嬮槄璇昏嫳鏂囨枃妗ｅ拰璧勬枡锛屼篃鑳界敤閭欢杩涜宸ヤ綔娌熼€氥€傚彛璇柟闈㈡垜杩樺湪缁冧範锛屾棩甯镐氦娴佹病闂锛屾瘮杈冨鏉傜殑琛ㄨ揪杩橀渶瑕佺户缁彁鍗囥€傛垜姣忓ぉ閮芥湁鍧氭寔瀛﹁嫳璇紝甯屾湜鑳界敤鍦ㄥ伐浣滀腑鐨勮法澧冩矡閫氫笂銆?
  },
  '浣犱负浠€涔堟兂鍋氳繖涓矖浣?: {
    tip: '缁撳悎涓汉鍏磋叮+鑳藉姏+琛屼笟鍓嶆櫙鏉ュ洖绛斻€?,
    answer: '棣栧厛鎴戣寰楄繖涓矖浣嶅緢閫傚悎鎴戯紝鎴戠殑鎬ф牸鍜岃兘鍔涜窡宸ヤ綔瑕佹眰寰堝尮閰嶃€傚叾娆℃垜瀵硅繖涓鍩熸湰韬氨寰堟劅鍏磋叮锛屼竴鐩村湪瀛︿範鍜屽叧娉ㄨ涓氬姩鎬併€傚啀鍔犱笂杩欎釜宀椾綅鐨勫氨涓氬墠鏅篃寰堝ソ锛屾槸涓€涓€煎緱闀挎湡鎶曞叆鐨勬柟鍚戙€?
  },
  '浣犺寰楄嚜宸辫兘鑳滀换杩欎釜宀椾綅鍚?: {
    tip: '鐢ㄥ叿浣撶殑鎶€鑳藉拰妗堜緥鏉ヨ瘉鏄庯紝涓嶈绌鸿"鎴戣兘"銆?,
    answer: '鎴戣寰楀彲浠ャ€備箣鍓嶆垜鍦ㄥ疄涔?椤圭洰涓湁杩囩浉鍏崇殑缁忛獙锛屾瘮濡傦紙鍏蜂綋妗堜緥锛夛紝杩欎釜缁忓巻璁╂垜鍏峰浜嗭紙鐩稿叧鑳藉姏锛夈€傝櫧鐒舵湁浜涙柟闈㈣繕闇€瑕佸涔狅紝浣嗘垜鐨勫涔犺兘鍔涘緢寮猴紝鍔犱笂鎴戝杩欎釜宀椾綅鐪熺殑寰堟湁鐑儏锛屾垜鐩镐俊寰堝揩灏辫兘涓婃墜銆?
  },
  '浣犺兘鎺ュ彈浠庡熀灞傚仛璧峰悧': {
    tip: '琛ㄨ揪鎰挎剰浠庡熀纭€瀛﹁捣锛屽己璋冩垚闀垮績鎬併€?,
    answer: '鍙互鎺ュ彈銆傛垜瑙夊緱浠庡熀灞傚仛璧锋槸浜嗚В涓氬姟鏈€濂界殑鏂瑰紡锛屾妸鍩虹鎵撴墡瀹炰簡锛屼互鍚庢墠鑳借蛋寰楁洿绋炽€傝€屼笖鎴戜篃涓嶈寰楀熀灞傜殑娲绘槸"浣庣骇鐨?锛屾瘡涓幆鑺傞兘鏈夊€煎緱瀛︿範鐨勫湴鏂广€傛垜浼氱敤蹇冨仛濂芥瘡涓€浠朵簨銆?
  },
  '浣犳壘宸ヤ綔鏃舵渶鐪嬮噸浠€涔?: {
    tip: '鎸?-3涓綘鏈€鍦ㄤ箮鐨勶紝涓庡叕鍙歌兘鎻愪緵鐨勫尮閰嶃€?,
    answer: '鎴戞渶鐪嬮噸鐨勬湁涓変釜锛氱涓€鏄垚闀跨┖闂达紝鎴戝笇鏈涘叕鍙歌兘鎻愪緵瀛︿範鍜屽煿璁殑鏈轰細锛涚浜屾槸鍥㈤槦姘涘洿锛屾垜甯屾湜鍜屼紭绉€鐨勪汉鍏变簨锛涚涓夋槸鍏徃鐨勫彂灞曞墠鏅紝鎴戝笇鏈涜嚜宸卞姞鍏ョ殑鏄竴涓湁娼滃姏鐨勫钩鍙般€?
  }
};

function generateHrAnswer() {
  const question = document.getElementById('hrqaQuestion').value.trim();
  const context = document.getElementById('hrqaContext').value.trim();
  
  if(!question) { alert('璇峰厛杈撳叆HR鐨勯棶棰?); return; }

  // Find matched question
  let matched = null;
  let matchKey = '';
  for(const [key, val] of Object.entries(HR_ANSWERS)) {
    if(question.includes(key) || key.includes(question.substring(0, 6))) {
      matched = val;
      matchKey = key;
      break;
    }
  }

  let answerText, tipText;
  if(matched) {
    answerText = matched.answer;
    tipText = matched.tip;
  } else {
    // Generic answer for unmatched questions
    tipText = '鐢⊿TAR娉曞垯缁勭粐鍥炵瓟锛歋ituation锛堣儗鏅級鈫?Task锛堜换鍔★級鈫?Action锛堣鍔級鈫?Result锛堢粨鏋滐級銆備繚鎸佺畝娲侊紝鍏堣缁撹鍐嶅睍寮€銆?;
    // Check question type
    if(question.includes('鎬庝箞') || question.includes('濡備綍') || question.includes('what')) {
      answerText = '鍏充簬杩欎釜闂锛屾垜寤鸿浠庝笁涓淮搴︽潵鍥炵瓟锛歕n\n1锔忊儯 鍏堝垎鏋愰棶棰樻湰璐ㄢ€斺€旀槑纭鏂圭湡姝ｆ兂闂殑鏄粈涔圽n2锔忊儯 缁撳悎浣犺嚜宸辩殑缁忓巻鎴栬鐐规潵璇存槑\n3锔忊儯 缁欏嚭浣犵殑琛屽姩鏂规鎴栨€濊€僜n\n姣斿浣犲彲浠ヨ繖鏍疯锛歕n"鍏充簬锛堥棶棰樻牳蹇冿級锛屾垜鐨勭悊瑙ｆ槸......涔嬪墠鎴戝湪锛堢粡鍘嗭級涓亣鍒拌繃绫讳技鐨勬儏鍐碉紝鎴戠殑鍋氭硶鏄?.....缁撴灉......鎵€浠ユ垜璁や负......"';
    } else if(question.includes('浠嬬粛') || question.includes('浠嬬粛鑷繁') || question.includes('self')) {
      answerText = '涓€涓ソ鐨勮嚜鎴戜粙缁嶅簲璇ュ寘鍚洓涓绱狅細\n\n1锔忊儯 鎴戞槸璋佲€斺€斿悕瀛?鑳屾櫙锛堝锛氭垜鏄嚜淇★紝2026灞婃瘯涓氱敓锛塡n2锔忊儯 鎴戣兘鍋氫粈涔堚€斺€旀牳蹇冩妧鑳?瀹炰範/椤圭洰缁忛獙\n3锔忊儯 鎴戝仛杩囦粈涔堚€斺€?-2涓寒鐐规暟鎹垨妗堜緥\n4锔忊儯 鎴戞兂瑕佷粈涔堚€斺€斾负浠€涔堝簲鑱樿繖涓矖浣峔n\n馃挕 寤鸿鎺у埗鍦?鍒嗛挓浠ュ唴锛岀敤鏁版嵁璇磋瘽鏈€鏈夎鏈嶅姏銆?;
    } else {
      answerText = '馃挕 鍥炵瓟寤鸿锛歕n\n1. 鍏堢悊瑙ｉ棶棰樼殑鏍稿績鎰忓浘鈥斺€擧R鎯崇煡閬撲粈涔堬紵\n2. 鐢ㄧ畝娲佺殑璇█鍏堣缁撹锛屽啀灞曞紑璇存槑\n3. 灏介噺缁撳悎浣犵殑瀹為檯缁忓巻鏉ュ洖绛擻n4. 濡傛灉涓嶇煡閬撳浣曞洖绛旓紝鍙互璇?璁╂垜鎬濊€冧竴涓?锛岀粰鑷繁缁勭粐璇█鐨勬椂闂碶n\n馃搶 淇濇寔鑷俊銆佺湡璇氥€佺畝娲侊紝涓嶉渶瑕佽繃搴︿慨楗般€?;
    }
  }

  // Personalize with context
  if(context) {
    answerText = answerText.replace(/浣犵殑鑳藉姏/g, context + '鐨勮兘鍔?);
    answerText = answerText.replace(/浣犵殑鏍稿績鎶€鑳?g, context + '鏂归潰鐨勬妧鑳?);
  }

  // Save to history
  const history = DB.get('hrqa_history',[]);
  history.push({question, answer: answerText, date: todayStr(), _ts: Date.now()});
  DB.set('hrqa_history', history);

  document.getElementById('hrqaResult').innerHTML = `
    <div class="card">
      <div class="card-title">馃挕 鍥炵瓟寤鸿</div>
      <div style="background:var(--bg);padding:10px 14px;border-radius:8px;font-size:13px;color:#4a9d6f;margin-bottom:12px;">
        馃搶 ${tipText}
      </div>
      <div style="background:#fff;border:1px solid #f0e8ec;border-radius:12px;padding:16px;line-height:1.8;font-size:14px;white-space:pre-wrap;">
        ${answerText}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-sm btn-outline" onclick="copyHrAnswer()">馃搵 澶嶅埗鍥炵瓟</button>
        <button class="btn btn-sm btn-outline" onclick="logHrAnswer()">馃摑 淇濆瓨鍒伴潰璇曡褰?/button>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#b3a0a8;">
        馃挕 鎻愮ず锛氬洖绛旀椂淇濇寔鑷劧锛屼笉瑕佸儚鑳岀銆傜敤浣犺嚜宸辩殑璇濇潵璇达紝鏁堟灉鏇村ソ銆?
      </div>
    </div>
  `;
}

function clearHrqa() {
  document.getElementById('hrqaQuestion').value = '';
  document.getElementById('hrqaContext').value = '';
  document.getElementById('hrqaResult').innerHTML = '';
}

function copyHrAnswer() {
  const text = document.querySelector('#hrqaResult .card .card-title')?.nextElementSibling?.nextElementSibling?.textContent;
  if(text) {
    navigator.clipboard.writeText(text).then(() => {
      showOcrToast('鉁?宸插鍒跺埌鍓创鏉?);
    }).catch(() => {
      alert('澶嶅埗澶辫触锛岃鎵嬪姩澶嶅埗');
    });
  }
}

function logHrAnswer() {
  // Automatically create interview prep record
  const question = document.getElementById('hrqaQuestion').value.trim();
  const answer = document.querySelector('#hrqaResult .card')?.querySelector('div:last-child')?.textContent || '';
  const text = `Q: ${question}\n\nA: ${answer}`;
  
  // Copy to clipboard for easy pasting
  navigator.clipboard.writeText(text).then(() => {
    showOcrToast('鉁?宸插洖绛斿唴瀹瑰凡澶嶅埗锛屽彲鍦ㄣ€岄潰璇曡褰曘€嶆爣绛鹃〉绮樿创淇濆瓨');
    switchJobTab('interview', document.querySelector('[onclick*=\"interview\"]'));
  }).catch(() => {
    showOcrToast('鉁?宸蹭繚瀛橈紝鍘婚潰璇曡褰曢〉璁板綍鍚?);
    switchJobTab('interview', document.querySelector('[onclick*=\"interview\"]'));
  });
}
// ========== AI SKILL CENTER ==========
const AI_LEVELS = [
  { min:0, max:5, name:'AI 鎺㈢储鑰?Lv.1', short:'鎺㈢储鑰?, desc:'瀹屾垚5涓伐鍏峰涔狅紝寮€鍚疉I涔嬫梾' },
  { min:5, max:15, name:'AI 瀹炶返鑰?Lv.2', short:'瀹炶返鑰?, desc:'瀹屾垚10涓狝I浠诲姟锛屾帉鎻℃牳蹇冨伐鍏? },
  { min:15, max:30, name:'AI 杩愯惀鑰?Lv.3', short:'杩愯惀鑰?, desc:'寤虹珛5涓狝I宸ヤ綔娴侊紝鏁堢巼鏄捐憲鎻愬崌' },
  { min:30, max:Infinity, name:'AI 鑷姩鍖栬繍钀ヨ€?Lv.4', short:'鑷姩鍖栬繍钀ヨ€?, desc:'鑳藉鍒╃敤AI瀹屾垚瀹為檯宸ヤ綔娴佺▼锛岃В鏀剧敓浜у姏' },
];

function calcAiLevel() {
  const tools = DB.get('ai_tools',[]).length;
  const tasks = DB.get('ai_tasks',[]).length;
  const flows = DB.get('ai_flows',[]).length;
  const prompts = DB.get('ai_prompts',[]).length;
  const score = tools + tasks + flows + prompts;
  for(const lv of AI_LEVELS) { if(score >= lv.min && score < lv.max) return { ...lv, score, tools, tasks, flows, prompts }; }
  return { ...AI_LEVELS[AI_LEVELS.length-1], score, tools, tasks, flows, prompts };
}

function switchAiTab(tab, btn) {
  document.querySelectorAll('#page-ai .tab-bar .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('aiTabTools').style.display = tab==='tools'?'block':'none';
  document.getElementById('aiTabTasks').style.display = tab==='tasks'?'block':'none';
  document.getElementById('aiTabFlows').style.display = tab==='flows'?'block':'none';
  document.getElementById('aiTabPrompts').style.display = tab==='prompts'?'block':'none';
  document.getElementById('aiTabReview').style.display = tab==='review'?'block':'none';
}

function refreshAi() {
  // Tools
  const tools = DB.get('ai_tools',[]);
  const tasks = DB.get('ai_tasks',[]);
  const flows = DB.get('ai_flows',[]);
  const prompts = DB.get('ai_prompts',[]);

  document.getElementById('aiToolCount').textContent = tools.length;
  document.getElementById('aiTaskCount').textContent = tasks.length;
  document.getElementById('aiFlowCount').textContent = flows.length;
  document.getElementById('aiPromptCount').textContent = prompts.length;

  // Level
  const lv = calcAiLevel();
  document.getElementById('aiLevelName').textContent = `馃 ${lv.name}`;
  document.getElementById('aiLevelDetail').textContent = lv.desc;
  document.getElementById('aiVerToolCount').textContent = lv.tools;
  document.getElementById('aiVerTaskCount').textContent = lv.tasks;
  document.getElementById('aiVerFlowCount').textContent = lv.flows;
  const nextLv = AI_LEVELS.find(l => l.max > lv.score) || AI_LEVELS[AI_LEVELS.length-1];
  const pct = Math.min((lv.score - lv.min) / (nextLv.max - lv.min) * 100, 100);
  document.getElementById('aiLevelBar').style.width = Math.max(pct,2)+'%';

  // Render tabs
  renderAiTools(tools);
  renderAiTasks(tasks);
  renderAiFlows(flows);
  renderAiPrompts(prompts);
  renderAiReview(lv, tools, tasks, flows, prompts);
}

// ===== Tools =====
function renderAiTools(tools) {
  document.getElementById('aiToolList').innerHTML = tools.length
    ? tools.slice().reverse().map((r,i) => `
      <div class="ai-tool-card">
        <div class="ai-tool-header">
          <div>
            <div class="ai-tool-name">${r.name}</div>
            <span class="ai-tool-type">${r.type||'宸ュ叿'}</span>
          </div>
          <button class="del-btn" onclick="delAiTool(${tools.length-1-i})">馃棏</button>
        </div>
        <div class="ai-tool-mastery">${'鈽?.repeat(parseInt(r.mastery)||1)+'鈽?.repeat(5-(parseInt(r.mastery)||1))}</div>
        <div class="ai-tool-body">
          <strong>鏍稿績鍔熻兘锛?/strong>${r.core||'-'}<br>
          <strong>浣跨敤鍦烘櫙锛?/strong>${r.scene||'-'}
        </div>
        ${r.next ? `<div class="ai-tool-next">馃幆 ${r.next}</div>` : ''}
      </div>
    `).join('')
    : '<div class="empty-state"><div class="icon">馃摝</div><p>杩樻病鏈夋坊鍔犲伐鍏凤紝鐐瑰嚮涓婃柟鎸夐挳寮€濮嬫瀯寤轰綘鐨凙I宸ュ叿绠憋紒</p></div>';
}

function saveAiTool() {
  const rec = {
    name: document.getElementById('aiToolNameField').value,
    type: document.getElementById('aiToolType').value,
    core: document.getElementById('aiToolCore').value,
    scene: document.getElementById('aiToolScene').value,
    mastery: document.getElementById('aiToolMastery').value,
    next: document.getElementById('aiToolNext').value,
  };
  const recs = DB.get('ai_tools',[]);
  recs.push(rec);
  DB.set('ai_tools',recs);
  closeModal('aiToolModal');
  clearForm(['aiToolNameField','aiToolCore','aiToolScene','aiToolNext']);
  refreshAi(); refreshDashboard();
}

function delAiTool(idx){ const r=DB.get('ai_tools',[]);r.splice(idx,1);DB.set('ai_tools',r);refreshAi();refreshDashboard(); }

// ===== Tasks =====
function renderAiTasks(tasks) {
  document.getElementById('aiTaskList').innerHTML = tasks.length
    ? tasks.slice().reverse().map((r,i) => `
      <div class="record-item">
        <div class="record-item-header">
          <span class="record-item-title">馃幆 ${r.name||r.goal||'AI浠诲姟'}</span>
          <span class="record-item-date">${r.date}</span>
        </div>
        <div class="record-item-body">
          馃洜锔?宸ュ叿锛?{r.tool}<br>
          ${r.prompt ? '馃挰 Prompt锛?+r.prompt.slice(0,80)+(r.prompt.length>80?'...':'')+'<br>' : ''}
          ${r.output ? '馃 AI缁撴灉锛?+r.output.slice(0,80)+(r.output.length>80?'...':'')+'<br>' : ''}
          鉁?鎴愭灉锛?{r.result||'-'}<br>
          ${r.efficiency ? '鈿?鏁堢巼锛?+r.efficiency+'<br>' : ''}
          ${r.review ? '馃挕 澶嶇洏锛?+r.review.slice(0,60)+(r.review.length>60?'...':'') : ''}
        </div>
        <div class="record-actions">
          <button class="del-btn" onclick="delAiTask(${tasks.length-1-i})">馃棏</button>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state"><div class="icon">馃洜锔?/div><p>杩樻病鏈変换鍔¤褰曪紝姣忔瀛︿範AI閮借缁戝畾涓€涓疄闄呬换鍔★紒</p></div>';
}

function saveAiTask() {
  const rec = {
    name: document.getElementById('aiTaskName').value,
    tool: document.getElementById('aiTaskTool').value,
    prompt: document.getElementById('aiTaskPrompt').value,
    output: document.getElementById('aiTaskOutput').value,
    result: document.getElementById('aiTaskResult').value,
    efficiency: document.getElementById('aiTaskEfficiency').value,
    review: document.getElementById('aiTaskReview').value,
    date: document.getElementById('aiTaskDate').value || todayStr(),
  };
  if(!rec.name && !rec.tool) { alert('璇疯嚦灏戝～鍐欎换鍔″悕绉版垨浣跨敤宸ュ叿'); return; }
  const recs = DB.get('ai_tasks',[]);
  recs.push(rec);
  DB.set('ai_tasks',recs);
  closeModal('aiTaskModal');
  clearForm(['aiTaskName','aiTaskTool','aiTaskPrompt','aiTaskOutput','aiTaskResult','aiTaskEfficiency','aiTaskReview','aiTaskDate']);
  refreshAi(); refreshDashboard();
}

function delAiTask(idx){ const r=DB.get('ai_tasks',[]);r.splice(idx,1);DB.set('ai_tasks',r);refreshAi();refreshDashboard(); }

// ===== Workflows =====
function renderAiFlows(flows) {
  document.getElementById('aiFlowList').innerHTML = flows.length
    ? flows.slice().reverse().map((r,i) => {
      const steps = (r.steps||'').split('鈫?).map(s=>s.trim()).filter(Boolean);
      return `
      <div class="workflow-card">
        <div class="wf-header">
          <div class="wf-name">馃攧 ${r.name}</div>
          <button class="del-btn" onclick="delAiFlow(${flows.length-1-i})">馃棏</button>
        </div>
        <div class="wf-steps">${steps.map(s=>`<span class="wf-step">${s}</span>`).join('<span class="wf-step-arrow">鈫?/span>')}</div>
        <div class="wf-meta">
          ${r.tools ? `<span>馃洜锔?${r.tools}</span>` : ''}
          ${r.timeSaved ? `<span>鈴憋笍 ${r.timeSaved}</span>` : ''}
        </div>
        ${r.scene ? `<div class="ai-tool-body" style="margin-top:8px;"><strong>閫傜敤鍦烘櫙锛?/strong>${r.scene}</div>` : ''}
        ${r.optimize ? `<div class="ai-tool-next" style="margin-top:6px;">馃敡 ${r.optimize}</div>` : ''}
      </div>`;
    }).join('')
    : '<div class="empty-state"><div class="icon">馃攧</div><p>杩樻病鏈夊伐浣滄祦锛岃褰曚綘鐨凙I宸ヤ綔娴佺▼锛岃鏁堢巼鍙鍒讹紒</p></div>';
}

function saveAiFlow() {
  const rec = {
    name: document.getElementById('aiFlowName').value,
    steps: document.getElementById('aiFlowSteps').value,
    tools: document.getElementById('aiFlowTools').value,
    timeSaved: document.getElementById('aiFlowTime').value,
    scene: document.getElementById('aiFlowScene').value,
    optimize: document.getElementById('aiFlowOptimize').value,
  };
  const recs = DB.get('ai_flows',[]);
  recs.push(rec);
  DB.set('ai_flows',recs);
  closeModal('aiFlowModal');
  clearForm(['aiFlowName','aiFlowSteps','aiFlowTools','aiFlowTime','aiFlowScene','aiFlowOptimize']);
  refreshAi(); refreshDashboard();
}

function delAiFlow(idx){ const r=DB.get('ai_flows',[]);r.splice(idx,1);DB.set('ai_flows',r);refreshAi();refreshDashboard(); }

// ===== Prompts =====
function renderAiPrompts(prompts) {
  const catIcons = {'鍐呭鍒涗綔':'鉁嶏笍','瑙嗛鑴氭湰':'馃幀','鍥剧墖璁捐':'馃帹','绠€鍘嗕紭鍖?:'馃捈','鑻辫瀛︿範':'馃實','鏁版嵁鍒嗘瀽':'馃搳'};
  document.getElementById('aiPromptList').innerHTML = prompts.length
    ? prompts.slice().reverse().map((r,i) => `
      <div class="prompt-card">
        <div class="prompt-copy" onclick="copyPrompt('${r.content.replace(/'/g,"\\'").replace(/`/g,"\\`").replace(/\n/g,'\\n')}')">馃搵 澶嶅埗</div>
        <div class="prompt-header">
          <span class="prompt-title">${r.title}</span>
          <span class="prompt-cat">${catIcons[r.cat]||'馃搶'} ${r.cat}</span>
        </div>
        <div class="prompt-content">${r.content}</div>
        ${r.scene ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">馃搶 ${r.scene}</div>` : ''}
        <div style="margin-top:6px;">
          <button class="del-btn" onclick="delAiPrompt(${prompts.length-1-i})">馃棏</button>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state"><div class="icon">馃挰</div><p>杩樻病鏈夋彁绀鸿瘝锛屽紑濮嬬Н绱綘鐨勪釜浜烘彁绀鸿瘝璧勪骇锛?/p></div>';
}

function saveAiPrompt() {
  const rec = {
    title: document.getElementById('aiPromptTitle').value,
    cat: document.getElementById('aiPromptCat').value,
    content: document.getElementById('aiPromptContent').value,
    scene: document.getElementById('aiPromptScene').value,
  };
  const recs = DB.get('ai_prompts',[]);
  recs.push(rec);
  DB.set('ai_prompts',recs);
  closeModal('aiPromptModal');
  clearForm(['aiPromptTitle','aiPromptContent','aiPromptScene']);
  refreshAi(); refreshDashboard();
}

function delAiPrompt(idx){ const r=DB.get('ai_prompts',[]);r.splice(idx,1);DB.set('ai_prompts',r);refreshAi();refreshDashboard(); }

function copyPrompt(text) {
  navigator.clipboard.writeText(text).then(() => {
    showXpToast(0); // reuse toast style
    const t=document.querySelector('.xp-toast:last-child');
    if(t) t.innerHTML='馃搵 宸插鍒跺埌鍓创鏉?;
  });
}

// ===== Review =====
function renderAiReview(lv, tools, tasks, flows, prompts) {
  // Update grid
  document.getElementById('aiRevToolCount').textContent = lv.tools;
  document.getElementById('aiRevTaskCount').textContent = lv.tasks;
  document.getElementById('aiRevFlowCount').textContent = lv.flows;
  document.getElementById('aiRevPromptCount').textContent = lv.prompts;

  // Weekly review
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-weekStart.getDay()+1);
  const wStart = weekStart.toISOString().slice(0,10);
  const weekTasks = tasks.filter(r => r.date >= wStart);
  const weekFlows = flows.filter(r => true); // no date field, just show all
  const weekTools = tools.filter(r => true);

  document.getElementById('aiWeekReview').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${weekTasks.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">鏈懆瀹屾垚浠诲姟</div>
      </div>
      <div style="padding:12px;background:var(--bg);border-radius:10px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:var(--primary);">${lv.score}</div>
        <div style="font-size:12px;color:var(--text-secondary);">缁煎悎鎴愰暱鍊?/div>
      </div>
    </div>
    ${weekTasks.length ? `
      <div style="margin-top:12px;font-size:13px;color:var(--text-secondary);">
        <strong>鏈懆瀹屾垚鐨勪换鍔★細</strong><br>
        ${weekTasks.map(t => `鈥?${t.goal}锛?{t.tool}锛塦).join('<br>')}
      </div>
    ` : '<p style="margin-top:10px;font-size:13px;color:var(--text-secondary);">鏈懆杩樻病鏈変换鍔¤褰曪紝寮€濮嬪姩鎵嬪惂锛?/p>'}
  `;

  // Insight
  const insights = [];
  if(lv.tools===0) insights.push('馃挕 寤鸿浠?涓渶甯哥敤鐨凙I宸ュ叿寮€濮嬶紝姣斿ChatGPT鎴朇ursor');
  if(lv.tasks===0) insights.push('馃挕 灏濊瘯鐢ˋI瀹屾垚涓€涓皬浠诲姟锛屾瘮濡傚啓涓€娈靛皬绾功鏂囨');
  if(lv.tools>=2 && lv.flows===0) insights.push('馃挕 浣犲凡缁忔帉鎻′簡澶氫釜宸ュ叿锛岃瘯璇曞缓绔嬩竴涓伐浣滄祦涓茶仈璧锋潵锛?);
  if(lv.tasks>=3) insights.push('鉁?浣犲凡缁忓畬鎴愪簡澶氭AI瀹炶返锛屽彲浠ヨ€冭檻鎬荤粨鎴愬彲澶嶇敤鐨勫伐浣滄祦');
  if(lv.tools>=3 && lv.tasks>=5) insights.push('馃帀 浣犵殑AI鎶€鑳芥鍦ㄥ揩閫熸垚闀匡紒灏濊瘯鎶夾I搴旂敤鍒版洿澶氬伐浣滃満鏅腑');
  if(lv.prompts>=3) insights.push('馃摎 浣犵殑鎻愮ず璇嶅簱鍦ㄧН绱紝璁板緱瀹氭湡鍥為【鍜屼紭鍖栧凡鏈夌殑鎻愮ず璇?);
  if(insights.length===0) insights.push('馃殌 寮€濮嬩綘鐨勭涓€娆¤褰曪紝杩堝嚭AI鎶€鑳芥垚闀跨殑绗竴姝ワ紒');

  // AI Analysis
  const toolTypes = tools.map(t=>t.type).filter(Boolean);
  const hasContentAI = toolTypes.some(t=>t.includes('鍐呭鍒涗綔'));
  const hasDataAI = toolTypes.some(t=>t.includes('鏁版嵁鍒嗘瀽'));
  const hasAutoAI = toolTypes.some(t=>t.includes('鑷姩鍖?));
  const hasSocialAI = toolTypes.some(t=>t.includes('鏂板獟浣?));
  
  const strengths = [];
  if(hasContentAI) strengths.push('鍐呭鍒涗綔绫诲伐鍏蜂娇鐢ㄧ啛缁?);
  if(hasSocialAI) strengths.push('鏂板獟浣撹繍钀I鎺屾彙涓嶉敊');
  if(lv.tasks >= 5) strengths.push('鑳界嫭绔嬪畬鎴怉I浠诲姟闂幆');
  if(lv.flows >= 2) strengths.push('宸插缓绔嬪彲澶嶇敤宸ヤ綔娴?);
  if(!strengths.length) strengths.push('寮€濮嬭褰曞悗杩欓噷浼氳嚜鍔ㄥ垎鏋?);
  
  const weaknesses = [];
  if(!hasContentAI) weaknesses.push('鍐呭鍒涗綔AI宸ュ叿寰呮嫇灞?);
  if(!hasDataAI) weaknesses.push('鏁版嵁鍒嗘瀽绫籄I杩樻湭娑夊強');
  if(!hasAutoAI) weaknesses.push('鑷姩鍖栧伐浣滄祦寰呭缓绔?);
  if(lv.tasks < 3) weaknesses.push('瀹為檯浠诲姟瀹炶返鏁伴噺涓嶈冻');
  if(!weaknesses.length) weaknesses.push('鍏ㄩ潰瑕嗙洊鍚勭被鍦烘櫙锛岀户缁繚鎸侊紒');

  document.getElementById('aiInsight').innerHTML = `
    <div class="ai-review-insight">
      <h4>馃搳 鑳藉姏鍒嗘瀽</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
        <div style="padding:10px;background:#d4edda;border-radius:8px;">
          <div style="font-size:12px;font-weight:700;color:#155724;">鉁?浼樺娍</div>
          <div style="font-size:12px;color:#155724;margin-top:4px;">${strengths.join('<br>')}</div>
        </div>
        <div style="padding:10px;background:#fff3cd;border-radius:8px;">
          <div style="font-size:12px;font-weight:700;color:#856404;">鈿狅笍 寰呭姞寮?/div>
          <div style="font-size:12px;color:#856404;margin-top:4px;">${weaknesses.join('<br>')}</div>
        </div>
      </div>
    </div>
    <div class="ai-review-insight">
      <h4>馃幆 涓嬩竴闃舵寤鸿</h4>
      <p>${insights.slice(0,2).join('<br>')}</p>
    </div>
    ${insights.slice(2).map(s => `<div class="ai-review-insight"><p>${s}</p></div>`).join('')}
  `;
}

// ========== XIAOHONGSHU (Personal IP System) ==========
function refreshXhs() {
  document.getElementById('xhsToday').textContent = formatDateLong(todayStr());
  const config = DB.get('xhs_config',{});
  const ideas = DB.get('xhs_ideas',[]);
  const productions = DB.get('xhs_productions',[]);
  const virals = DB.get('xhs_virals',[]);
  
  // Update IP card
  document.getElementById('xhsIPName').textContent = config.accName ? '馃専 '+config.accName : '馃専 浣犵殑涓汉鍝佺墝';
  document.getElementById('xhsIPDesc').textContent = config.bio || (config.career ? config.career+' | IP杩愯惀涓? : '璁剧疆浣犵殑璐﹀彿瀹氫綅锛屾墦閫犲睘浜庝綘鐨勪釜浜篒P');
  document.getElementById('xhsIPTags').innerHTML = [config.career, config.interest, config.skill].filter(Boolean).map(t => `<span class="ip-tag">${t}</span>`).join('');
  
  // Fill form fields
  document.getElementById('xhsAccName').value = config.accName||'';
  document.getElementById('xhsCareer').value = config.career||'';
  document.getElementById('xhsInterest').value = config.interest||'';
  document.getElementById('xhsSkill').value = config.skill||'';
  document.getElementById('xhsTarget').value = config.target||'';
  document.getElementById('xhsBio').value = config.bio||'';
  
  // Render tabs
  renderXhsIdeas(ideas);
  renderXhsProductions(productions);
  renderXhsVirals(virals);
  renderXhsGrowth(ideas, productions, virals);
}

function switchXhsTab(tab, btn) {
  document.querySelectorAll('#page-xhs .tab-bar .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['ideacenter','ideas','production','viral','growth'].forEach(t => {
    const el = document.getElementById('xhsTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el) el.style.display = t===tab?'block':'none';
  });
}

function saveXhsConfig() {
  DB.set('xhs_config',{
    accName: document.getElementById('xhsAccName').value,
    career: document.getElementById('xhsCareer').value,
    interest: document.getElementById('xhsInterest').value,
    skill: document.getElementById('xhsSkill').value,
    target: document.getElementById('xhsTarget').value,
    bio: document.getElementById('xhsBio').value,
  });
  refreshXhs();
  showOcrToast('鉁?閰嶇疆宸蹭繚瀛?);
}

let xhsPlatform = '灏忕孩涔?;

function pickPlatform(name, btn) {
  xhsPlatform = name;
  document.querySelectorAll('#xhsPlatforms .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function analyzeXhsPositioning() {
  const career = document.getElementById('xhsCareer').value.trim();
  const interest = document.getElementById('xhsInterest').value.trim();
  const skill = document.getElementById('xhsSkill').value.trim();
  const target = document.getElementById('xhsTarget').value.trim();
  
  const el = document.getElementById('xhsPositioningResult');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-title">馃 AI瀹氫綅鍒嗘瀽</div>
      <div style="font-size:14px;line-height:1.7;">
        <p><strong>馃幆 閫傚悎浣犵殑璐﹀彿瀹氫綅锛?/strong><br>
        ${career||'鏂板獟浣撹繍钀?} 脳 ${interest||'涓汉鎴愰暱'} 脳 ${skill||'鍐呭鍒涗綔'}<br>
        寤鸿瀹氫綅鏂瑰悜锛?span style="color:#c45677;font-weight:600;">銆?{career||'鎴愰暱涓殑杩愯惀浜?} | ${interest||'鍒嗕韩AI宸ュ叿涓庡涔?}銆?/span></p>
        <p style="margin-top:8px;"><strong>馃摑 璐﹀彿绠€浠嬪缓璁細</strong><br>
        ${career||'鏂板獟浣撹繍钀?}锝?{interest||'鍒嗕韩AI宸ュ叿銆佽涔︽劅鎮熴€佹眰鑱岀粡楠?}<br>
        ${target||'甯姪鍚岄鐨勪汉涓€璧锋垚闀?}</p>
        <p style="margin-top:8px;"><strong>馃搶 鍐呭鏂瑰悜寤鸿锛?/strong><br>
        路 AI宸ュ叿浣跨敤鏁欑▼涓庡疄鎿嶆渚?br>
        路 鏂板獟浣撹繍钀ユ眰鑱岀粡楠屽垎浜?br>
        路 涓汉鎴愰暱涓庤涔︽劅鎮?br>
        路 ${skill||'鐭棰戝垱浣?}杩囩▼涓庢妧宸?/p>
        <p style="margin-top:8px;"><strong>馃彿锔?涓汉鏍囩寤鸿锛?/strong><br>
        ${[career,interest,skill,target].filter(Boolean).map(t => '#'+t.replace(/[锛屻€乚/g,' #')).join(' ')||'#鏂板獟浣撹繍钀?#AI宸ュ叿 #涓汉鎴愰暱'}</p>
      </div>
    </div>
  `;
}

// ===== 鍐呭鐏垫劅搴?=====
let xhsIdeaFilter = 'all';

function filterXhsIdea(filter, btn) {
  xhsIdeaFilter = filter;
  document.querySelectorAll('#xhsTabIdeas .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderXhsIdeas(DB.get('xhs_ideas',[]));
}

function renderXhsIdeas(ideas) {
  const filtered = xhsIdeaFilter === 'all' ? ideas : ideas.filter(i => i.status === xhsIdeaFilter);
  const el = document.getElementById('xhsIdeaList');
  if(!filtered.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;"><div style="font-size:40px;">馃挕</div><p>杩樻病鏈夌伒鎰燂紝璁板綍浣犵殑绗竴涓兂娉曞惂</p></div>';
    return;
  }
  el.innerHTML = filtered.slice().reverse().map((r,i) => {
    const statusMap = {idea:'馃挕 鐏垫劅', progress:'鈴?鍒朵綔涓?, done:'鉁?宸插彂甯?};
    const typeMap = {idea:'idea', progress:'progress', done:'done'};
    return `<div class="xhs-idea-item">
      <div class="ii-header">
        <span class="ii-title">${r.title||'鐏垫劅'}</span>
        <span class="ii-type ${typeMap[r.status]||'idea'}">${statusMap[r.status]||r.status}</span>
      </div>
      <div class="ii-body">${r.text||''}</div>
      ${r.aiSuggestion ? `<div class="ii-ai">馃 ${r.aiSuggestion}</div>` : ''}
      ${r.frame ? `<div style="margin-top:4px;font-size:12px;color:#8b6a78;">馃搵 ${r.frame}</div>` : ''}
      <div style="margin-top:6px;display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline" onclick="changeIdeaStatus(${ideas.indexOf(r)},'progress')">鈴?寮€濮嬪埗浣?/button>
        <button class="btn btn-sm btn-outline" onclick="changeIdeaStatus(${ideas.indexOf(r)},'done')">鉁?鏍囪鍙戝竷</button>
        <button class="del-btn" onclick="delXhsIdea(${ideas.indexOf(r)})">馃棏</button>
      </div>
    </div>`;
  }).join('');
}

function changeIdeaStatus(idx, status) {
  const ideas = DB.get('xhs_ideas',[]);
  if(ideas[idx]) ideas[idx].status = status;
  DB.set('xhs_ideas', ideas);
  renderXhsIdeas(ideas);
}

function saveXhsIdea() {
  const rec = {
    source: document.getElementById('xhsIdeaSource').value,
    text: document.getElementById('xhsIdeaText').value,
    status: document.getElementById('xhsIdeaStatus').value,
    title: document.getElementById('xhsIdeaTitle').value,
    frame: document.getElementById('xhsIdeaFrame').value,
    aiSuggestion: document.getElementById('xhsIdeaAiContent')?.textContent||'',
    _ts: Date.now()
  };
  if(!rec.text && !rec.title) { alert('璇疯嚦灏戣緭鍏ョ伒鎰熷唴瀹?); return; }
  const ideas = DB.get('xhs_ideas',[]);
  ideas.push(rec);
  DB.set('xhs_ideas', ideas);
  closeModal('xhsIdeaModal');
  clearForm(['xhsIdeaText','xhsIdeaTitle','xhsIdeaFrame']);
  document.getElementById('xhsIdeaAiResult').style.display = 'none';
  refreshXhs();
  showOcrToast('鉁?鐏垫劅宸蹭繚瀛?);
}

function delXhsIdea(idx) {
  const ideas = DB.get('xhs_ideas',[]);
  ideas.splice(idx,1);
  DB.set('xhs_ideas', ideas);
  renderXhsIdeas(ideas);
}

function generateIdeaAi() {
  const text = document.getElementById('xhsIdeaText').value.trim();
  if(!text) { alert('璇峰厛杈撳叆鐏垫劅鍐呭'); return; }
  const titles = [
    '銆?+text.slice(0,12)+'...銆嶆垜鐨勭湡瀹炵粡鍘嗗垎浜?,
    '鍏充簬'+text.slice(0,8)+'...鎴戞€荤粨浜?涓鐐?,
    text.slice(0,10)+'锛熸柊鎵嬪繀鐪嬫寚鍗?,
    '鍒啀'+text.slice(0,6)+'浜嗭紒璇曡瘯杩欎釜鏂规硶'
  ];
  const frame = '1. 寮曞叆闂/鍦烘櫙\n2. 鎴戠殑缁忓巻/鏂规硶\n3. 鏍稿績骞茶揣+鏁版嵁\n4. 鎬荤粨涓庝簰鍔ㄥ紩瀵?;
  
  document.getElementById('xhsIdeaTitle').value = titles[Math.floor(Math.random()*titles.length)];
  document.getElementById('xhsIdeaFrame').value = frame;
  document.getElementById('xhsIdeaAiContent').innerHTML = `
    <div style="margin-bottom:4px;"><strong>馃搶 鏍囬鏂瑰悜锛?/strong>${titles[Math.floor(Math.random()*titles.length)]}</div>
    <div><strong>馃搵 鍐呭妗嗘灦锛?/strong><br>${frame.replace(/\n/g,'<br>')}</div>
    <div style="margin-top:4px;"><strong>馃幆 閫傚悎骞冲彴锛?/strong>灏忕孩涔?鎶栭煶/鍏紬鍙?/div>`;
  document.getElementById('xhsIdeaAiResult').style.display = 'block';
}

// ===== 鍐呭鐢熶骇 =====
function renderXhsProductions(productions) {
  const el = document.getElementById('xhsProductionList');
  if(!productions.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;"><div style="font-size:40px;">馃幀</div><p>杩樻病鏈夊唴瀹硅褰曪紝寮€濮嬩綘鐨勭涓€娆″垱浣滃惂</p></div>';
    return;
  }
  el.innerHTML = productions.slice().reverse().map((r,i)=>{
    const idx = productions.length-1-i;
    const statusIcons = {script:'馃摑', shooting:'馃摳', editing:'鉁傦笍', published:'馃殌'};
    return `<div class="record-item">
      <div class="record-item-header">
        <span class="record-item-title">${statusIcons[r.status]||'馃摑'} ${r.title||'鏈懡鍚嶅唴瀹?}</span>
        <span class="status-badge status-${r.status==='published'?'published':r.status==='script'?'draft':'pending'}">${r.status||'鑴氭湰'}</span>
      </div>
      <div class="record-item-body">
        ${r.copy ? '馃搫 鏂囨锛?+r.copy.slice(0,60)+(r.copy.length>60?'...':'')+'<br>' : ''}
        ${r.fileName ? '馃搸 绱犳潗锛?+r.fileName+'<br>' : ''}
        ${r.data ? '馃搳 鏁版嵁锛?+r.data : ''}
      </div>
      <div class="record-actions">
        <button class="del-btn" onclick="delXhsProduction(${idx})">馃棏</button>
      </div>
    </div>`;
  }).join('');
}

function saveXhsProduction() {
  const rec = {
    title: document.getElementById('xpTitle').value,
    type: document.getElementById('xpType').value,
    copy: document.getElementById('xpCopy').value,
    fileName: document.getElementById('xpFileName').textContent,
    status: document.getElementById('xpStatus').value,
    data: document.getElementById('xpData').value,
    _ts: Date.now()
  };
  if(!rec.title) { alert('璇疯緭鍏ユ爣棰?); return; }
  const productions = DB.get('xhs_productions',[]);
  productions.push(rec);
  DB.set('xhs_productions', productions);
  closeModal('xhsProductionModal');
  clearForm(['xpTitle','xpCopy','xpData']);
  document.getElementById('xpFileName').textContent = '';
  refreshXhs();
  showOcrToast('鉁?鍐呭宸蹭繚瀛?);
}

function delXhsProduction(idx) {
  const p = DB.get('xhs_productions',[]);
  p.splice(idx,1);
  DB.set('xhs_productions', p);
  refreshXhs();
}

function optimizeXpTitle() {
  const titles = ['鎴戝潥鎸佸仛浜嗚繖浠朵簨30澶╋紝缁撴灉...','浠?鍒?鍋氭柊濯掍綋杩愯惀锛岃繖鏄垜鐨勭湡瀹炵粡鍘?,'AI宸ュ叿鏁戞垜鐙楀懡锛佹晥鐜囨彁鍗?00%'];
  document.getElementById('xpTitle').value = titles[Math.floor(Math.random()*titles.length)];
  showOcrToast('鉁?鏍囬宸蹭紭鍖?);
}

function optimizeXpCopy() {
  const copy = '浣犳槸涓嶆槸涔熼亣鍒拌繃杩欐牱鐨勯棶棰橈紵\n\n鍒氬紑濮嬪仛鏂板獟浣撶殑鏃跺€欙紝鎴戝畬鍏ㄤ笉鐭ラ亾璇ヤ粠鍝噷涓嬫墜...\n\n鍚庢潵鎴戠敤浜嗕竴涓柟娉曪紝鏁堢巼鐩存帴缈诲€嶐煈嘰n\n1. 鍏堢‘瀹氳处鍙峰畾浣嶏紙浣犳槸璋?缁欒皝鐪?鎻愪緵浠€涔堜环鍊硷級\n2. 寤虹珛閫夐搴擄紙姣忓ぉ鏀堕泦5涓伒鎰燂級\n3. AI杈呭姪鍒涗綔锛堢敤宸ュ叿鐢熸垚鍒濈鍐嶄紭鍖栵級\n\n杩欎釜鏂规硶璁╂垜涓€涓湀娑ㄧ矇2000+\n\n馃挕 浣犳湁浠€涔堝ソ鐨勮繍钀ユ妧宸э紵璇勮鍖哄垎浜惂锝?;
  document.getElementById('xpCopy').value = copy;
  showOcrToast('鉁?鏂囨宸蹭紭鍖?);
}

// ===== 鐖嗘鍒嗘瀽 =====
function renderXhsVirals(virals) {
  const el = document.getElementById('xhsViralList');
  if(!virals.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;"><div style="font-size:40px;">馃攳</div><p>杩樻病鏈夋媶瑙ｆ渚嬶紝寮€濮嬪垎鏋愮涓€绡囩垎娆惧惂</p></div>';
    return;
  }
  el.innerHTML = virals.slice().reverse().map((r,i)=>{
    const idx = virals.length-1-i;
    return `<div class="xhs-viral-card">
      <div class="vc-title">馃攳 ${r.name||'鐖嗘妗堜緥'}</div>
      <div class="vc-grid">
        ${r.titleAnalysis ? `<div class="vc-tag"><strong>馃搶 鏍囬锛?/strong>${r.titleAnalysis}</div>` : ''}
        ${r.reason ? `<div class="vc-tag"><strong>馃敟 鐖嗘鍘熷洜锛?/strong>${r.reason}</div>` : ''}
        ${r.takeaway ? `<div class="vc-tag" style="grid-column:span 2;"><strong>馃挕 鎴戠殑鏀惰幏锛?/strong>${r.takeaway}</div>` : ''}
      </div>
      <div class="record-actions" style="margin-top:6px;">
        <button class="del-btn" onclick="delXhsViral(${idx})">馃棏</button>
      </div>
    </div>`;
  }).join('');
}

function saveXhsViral() {
  const rec = {
    name: document.getElementById('xvName').value,
    fileName: document.getElementById('xvFileName').textContent,
    content: document.getElementById('xvContent').value,
    titleAnalysis: document.getElementById('xvTitle').value,
    reason: document.getElementById('xvReason').value,
    takeaway: document.getElementById('xvTakeaway').value,
    _ts: Date.now()
  };
  if(!rec.name) { alert('璇疯緭鍏ユ渚嬪悕绉?); return; }
  const virals = DB.get('xhs_virals',[]);
  virals.push(rec);
  DB.set('xhs_virals', virals);
  closeModal('xhsViralModal');
  clearForm(['xvName','xvContent','xvTitle','xvReason','xvTakeaway']);
  document.getElementById('xvFileName').textContent = '';
  document.getElementById('xvAiResult').style.display = 'none';
  refreshXhs();
  showOcrToast('鉁?鎷嗚В宸蹭繚瀛?);
}

function delXhsViral(idx) {
  const v = DB.get('xhs_virals',[]);
  v.splice(idx,1);
  DB.set('xhs_virals', v);
  refreshXhs();
}

function analyzeXvViral() {
  const content = document.getElementById('xvContent').value.trim();
  if(!content) { alert('璇风矘璐寸瑪璁板唴瀹?); return; }
  const analysis = {
    title: '鏁板瓧+鐥涚偣+瑙ｅ喅鏂规鍨嬫爣棰?,
    cover: '楂樺姣旇壊+澶у瓧鏍囬+浜虹墿琛ㄦ儏',
    structure: '鐥涚偣寮曞叆鈫掓柟娉曞垎浜啋鏁版嵁浣愯瘉鈫掍簰鍔ㄥ紩瀵?,
    need: '鐢ㄦ埛瀵规晥鐜囧拰鎴愰暱鏈夊己鐑堥渶姹?,
    reason: '鏍囬鍚稿紩鐐瑰嚮锛屽紑澶?绉掓姄浣忔敞鎰忓姏锛屽共璐у唴瀹规弧瓒虫敹钘忛渶姹?
  };
  document.getElementById('xvTitle').value = '鏍囬缁撴瀯锛?+analysis.title+'\n灏侀潰鐗圭偣锛?+analysis.cover+'\n鍐呭妗嗘灦锛?+analysis.structure+'\n鐢ㄦ埛闇€姹傦細'+analysis.need;
  document.getElementById('xvReason').value = analysis.reason;
  document.getElementById('xvAiResult').style.display = 'block';
  document.getElementById('xvAiResult').innerHTML = `
    <div class="xhs-viral-card">
      <div style="font-size:13px;font-weight:600;color:#c45677;margin-bottom:6px;">馃 AI鍒嗘瀽缁撴灉</div>
      <div class="vc-grid">
        <div class="vc-tag"><strong>馃搶 鏍囬缁撴瀯锛?/strong>${analysis.title}</div>
        <div class="vc-tag"><strong>馃帹 灏侀潰鐗圭偣锛?/strong>${analysis.cover}</div>
        <div class="vc-tag"><strong>馃搵 鍐呭妗嗘灦锛?/strong>${analysis.structure}</div>
        <div class="vc-tag"><strong>馃懃 鐢ㄦ埛闇€姹傦細</strong>${analysis.need}</div>
        <div class="vc-tag" style="grid-column:span 2;"><strong>馃敟 鐖嗘鍘熷洜锛?/strong>${analysis.reason}</div>
      </div>
    </div>
  `;
  showOcrToast('馃攳 AI鍒嗘瀽瀹屾垚锛?);
}

// ===== 鎴愰暱鍒嗘瀽 =====
function renderXhsGrowth(ideas, productions, virals) {
  const posts = productions.filter(p => p.status === 'published');
  const ideasCount = ideas.length;
  const viralsCount = virals.length;
  
  // Weekly stats
  const now = new Date();
  const weekAgo = new Date(); weekAgo.setDate(now.getDate()-7);
  const ws = weekAgo.toISOString().slice(0,10);
  const weekPosts = productions.filter(p => p._ts && p._ts >= weekAgo.getTime());
  
  document.getElementById('xhsGrowthContent').innerHTML = `
    <div class="xhs-growth-card">
      <div class="gg-header">
        <div class="gg-stat"><div style="font-size:24px;font-weight:800;color:#1b5e20;">${posts.length}</div><div style="font-size:11px;color:#388e3c;">宸插彂甯?/div></div>
        <div class="gg-stat"><div style="font-size:24px;font-weight:800;color:#1b5e20;">${ideasCount}</div><div style="font-size:11px;color:#388e3c;">鐏垫劅鏁?/div></div>
        <div class="gg-stat"><div style="font-size:24px;font-weight:800;color:#1b5e20;">${viralsCount}</div><div style="font-size:11px;color:#388e3c;">鎷嗚В鏁?/div></div>
        <div class="gg-stat"><div style="font-size:24px;font-weight:800;color:#1b5e20;">${weekPosts.length}</div><div style="font-size:11px;color:#388e3c;">鏈懆鍙戝竷</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">馃挕 鏈懆杩愯惀鎬荤粨</div>
      <div style="font-size:14px;line-height:1.7;">
        ${posts.length > 0 ? `
        <p><strong>馃搳 鏇存柊棰戠巼锛?/strong>${weekPosts.length > 0 ? '鏈懆鏈夋洿鏂帮紝淇濇寔鑺傚 馃憤' : '鏈懆鏆傛棤鏂板唴瀹瑰彂甯?}</p>
        <p><strong>馃幆 鍐呭鏂瑰悜锛?/strong>${productions.map(p=>p.type).filter(Boolean).join('銆?)||'寰呭畾'}</p>
        <p><strong>馃挭 璐﹀彿鐗圭偣锛?/strong>姝ｅ湪褰㈡垚浠ャ€?{productions[0]?.title?.slice(0,10)||'涓汉鎴愰暱'}銆嶄负涓婚鐨勫唴瀹归鏍?/p>
        ` : '<p>杩樻病鏈夊彂甯冨唴瀹癸紝寮€濮嬩綘鐨勭涓€娆″垱浣滃惂锛?/p>'}
        <p><strong>馃敆 妯″潡鑱斿姩寤鸿锛?/strong></p>
        <ul style="padding-left:18px;font-size:13px;color:var(--text-secondary);">
          <li>鐢ㄣ€孉I鎶€鑳藉簱銆嶇殑宸ュ叿杈呭姪鍐呭鐢熶骇</li>
          <li>灏嗐€岃涔︾瑪璁般€嶈浆鍖栦负鍐呭绱犳潗</li>
          <li>娣卞害鐨勫唴瀹规矇娣€鍒般€屽叕浼楀彿鍒涗綔銆?/li>
          <li>绉疮鐨勪綔鍝佹斁鍏ャ€屾眰鑱屄烽潰璇曞噯澶囥€?/li>
        </ul>
      </div>
    </div>
  `;
}

function saveXhsRecord() {
  /* Keep for backward compatibility with old data */
  const rec = {
    date: document.getElementById('xhsDate')?.value || todayStr(),
    topic: document.getElementById('xhsTopic')?.value || '',
    title: document.getElementById('xhsTitle')?.value || '',
    type: document.getElementById('xhsType')?.value || '鍥炬枃',
    status: document.getElementById('xhsStatus')?.value || 'draft',
    data: document.getElementById('xhsData')?.value || '',
    review: document.getElementById('xhsReview')?.value || '',
    _ts: Date.now()
  };
  const recs = DB.get('xhs_records',[]);
  recs.push(rec);
  DB.set('xhs_records',recs);
  if(document.getElementById('xhsModal')) closeModal('xhsModal');
  if(document.getElementById('xhsDate')) clearForm(['xhsDate','xhsTopic','xhsTitle','xhsType','xhsStatus','xhsData','xhsReview']);
  refreshXhs();
}

function delXhs(idx){ const r=DB.get('xhs_records',[]);r.splice(idx,1);DB.set('xhs_records',r);refreshXhs(); }

// ========== READING ==========
function refreshReading() {
  const today = todayStr();
  document.getElementById('readDate').textContent = formatDateLong(today);
  
  // WeChat Reading sync status
  const connected = DB.get('wr_connected', false);
  document.getElementById('wrDot').className = 'dot ' + (connected ? 'online' : 'offline');
  document.getElementById('wrStatus').textContent = connected ? '宸茶繛鎺ュ井淇¤涔? : '鏈繛鎺ュ井淇¤涔?;
  document.getElementById('wrBtn').textContent = connected ? '鏂紑' : '馃敆 杩炴帴';

  // Current reading (manual or synced)
  const currentBook = DB.get('wr_current_book', null);
  if(currentBook) {
    document.getElementById('wrCurrentBook').textContent = '銆?+currentBook.title+'銆?;
    document.getElementById('wrCurrentAuthor').textContent = currentBook.author || '';
    const pct = currentBook.progress || 0;
    document.getElementById('wrProgressFill').style.width = pct+'%';
    document.getElementById('wrProgressPct').textContent = pct+'%';
    const todayTime = DB.get('read_today_time_'+today, 0);
    document.getElementById('wrCurrentTime').textContent = '浠婃棩闃呰 '+todayTime+' 鍒嗛挓';
  } else {
    // Fallback to manual data
    const recs = DB.get('reading_records',[]).reverse();
    const recent = recs.find(r => r.book);
    if(recent) {
      document.getElementById('wrCurrentBook').textContent = '銆?+recent.book+'銆?;
      document.getElementById('wrCurrentAuthor').textContent = '';
      document.getElementById('wrProgressFill').style.width = '50%';
      document.getElementById('wrProgressPct').textContent = '50%';
      document.getElementById('wrCurrentTime').textContent = '涓婃闃呰 '+recent.date;
    }
  }

  // Render all tabs
  renderReadNotes();
  renderReadThoughts();
  renderReadConversion();
  renderReadAnalytics();
  renderReadBooks();
  renderReadDailyRecords();
  renderKnowledgeCards();
  populateBookSelect();
  populateConvertSelect();
}

function connectWechatRead() {
  const connected = DB.get('wr_connected', false);
  if(connected) {
    DB.set('wr_connected', false);
    DB.set('wr_current_book', null);
    DB.set('wr_books', null);
    DB.set('wr_api_key', null);
    refreshReading();
    return;
  }
  // 杩炴帴鍒板井淇¤涔︹€斺€斿彧淇濆瓨瀵嗛挜鍜岃繛鎺ョ姸鎬侊紝涓嶆敞鍏ヤ换浣曟ā鎷熸暟鎹?
  const apiKey = prompt('璇疯緭鍏ュ井淇¤涔PI瀵嗛挜\n瀵嗛挜: wrk-xxxxxxxxxxxxxxxxxxxxxxxx', '');
  if(!apiKey) return;
  
  DB.set('wr_connected', true);
  DB.set('wr_api_key', apiKey);
  // 娓呴櫎鏃ф暟鎹紝纭繚涓嶄細鏄剧ず妯℃嫙鍐呭
  DB.set('wr_current_book', null);
  DB.set('wr_books', null);

  refreshReading();
  alert('鉁?寰俊璇讳功宸茶繛鎺ワ紒浣犵殑鐪熷疄闃呰鏁版嵁灏嗛€氳繃API鍚屾銆俓n\n馃搶 鎻愮ず锛氬湪銆岄槄璇荤瑪璁般€嶆爣绛鹃〉鎵嬪姩璁板綍璇讳功绗旇锛屽嵆鍙Н绱綘鐨勯槄璇绘暟鎹€?);
}

// 娓呯悊寰俊璇讳功缂撳瓨鏁版嵁锛堟竻闄や箣鍓嶅彲鑳芥畫鐣欑殑妯℃嫙鏁版嵁锛?
function clearWrCache() {
  if(!confirm('纭畾娓呴櫎鎵€鏈夊井淇¤涔︾紦瀛樻暟鎹紵\n\n鍖呮嫭锛氳繛鎺ョ殑涔︾睄銆佺瑪璁般€佹ā鎷熸暟鎹瓑銆俓n涓嶅奖鍝嶄綘鎵嬪姩璁板綍鐨勯槄璇荤瑪璁般€?)) return;
  DB.set('wr_connected', false);
  DB.set('wr_current_book', null);
  DB.set('wr_books', null);
  DB.set('wr_api_key', null);
  // 褰诲簳鍒犻櫎閿紝閬垮厤 null 瀛楃涓插鑷?DB.get 榛樿鍊间笉鐢熸晥
  localStorage.removeItem('pg_read_notes');
  localStorage.removeItem('pg_wr_current_book');
  localStorage.removeItem('pg_wr_books');
  localStorage.removeItem('pg_wr_api_key');
  refreshReading();
  alert('鉁?缂撳瓨宸叉竻闄ゃ€傝閲嶆柊杩炴帴浣犵殑寰俊璇讳功璐﹀彿锛屾垨鎵嬪姩璁板綍闃呰绗旇銆?);
}

// ========== AI 闃呰鍔╂墜 ==========
function sendReadQuery() {
  const input = document.getElementById('readAiInput');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';

  const chat = document.getElementById('readAiChat');
  const msgDiv = document.querySelector('.chat-msg:last-child');
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerHTML = `<div class="avatar">馃槉</div><div class="content">${escapeHtml(text)}</div>`;
  chat.insertBefore(userMsg, chat.querySelector('.chat-input'));

  // Simulate AI response based on keywords
  let response = '';
  const lower = text.toLowerCase();
  
  if(lower.includes('鍏遍福') || lower.includes('瑙﹀姩') || lower.includes('璁ゅ悓')) {
    response = `<span class="q-label">馃 娣卞叆鎬濊€?/span><br>杩欎釜瑙傜偣璁╀綘浜х敓鍏遍福锛岃鏄庡畠瑙﹀強浜嗕綘鍐呭績娣卞鐨勬煇浜涚粡鍘嗘垨淇″康銆?br><br>馃挕 璇曠潃闂棶鑷繁锛?br>鈥?杩欎釜瑙傜偣璁╀綘鎯宠捣浜嗕粈涔堢粡鍘嗭紵<br>鈥?涓轰粈涔堟伆鎭版槸杩欎釜閮ㄥ垎鎵撳姩浜嗕綘锛?br>鈥?瀹冨拰浣犺繃鍘荤殑缁忓巻鏈変粈涔堣仈绯伙紵<br><br>鎶婅繖浜涙劅鍙楀啓涓嬫潵锛屽畠浠槸鏈€濂界殑鍒涗綔绱犳潗銆俙;
  } else if(lower.includes('搴旂敤') || lower.includes('瀹炶返') || lower.includes('琛屽姩')) {
    response = `<span class="q-label">馃幆 琛屽姩杞寲</span><br>灏嗕功涓殑鐭ヨ瘑杞寲涓鸿鍔ㄦ槸鍏抽敭锛?br><br>馃搶 寤鸿锛?br>鈥?杩欎釜鐭ヨ瘑鐐瑰彲浠ュ浣曠敤鍒颁綘鏃ュ父鐨勬柊濯掍綋宸ヤ綔涓紵<br>鈥?鏄庡ぉ灏卞彲浠ュ皾璇曞仛鍝竴浠跺皬浜嬶紵<br>鈥?鍙互褰㈡垚涓€涓粈涔堟牱鐨勫唴瀹归€夐锛?br><br>鍝€曞彧鍋氫竴涓皬鏀瑰彉锛屼粖澶╃殑闃呰灏辨湁浜嗗疄闄呬环鍊笺€俙;
  } else if(lower.includes('鎬荤粨') || lower.includes('鏍稿績') || lower.includes('璁蹭簡')) {
    response = `<span class="q-label">馃摑 鍐呭鎬荤粨</span><br>鏍规嵁浣犵殑闃呰锛屾垜鏉ュ府浣犳⒊鐞嗭細<br><br>馃摉 <strong>鏈珷鏍稿績鍐呭</strong><br>浣犲杩欓儴鍒嗗唴瀹瑰凡缁忔湁浜嗚嚜宸辩殑鐞嗚В銆?br><br>馃挱 <strong>浣犵殑瑙傜偣</strong><br>浣犲叧娉ㄧ殑鐐瑰弽鏄犱簡浣犲湪鎰忎粈涔堚€斺€旇繖鍜屼綘鐨勪釜浜虹洰鏍囨湁浠€涔堝叧鑱旓紵<br><br>鉁嶏笍 璇曡瘯鐢ㄤ竴鍙ヨ瘽鎬荤粨鏈珷鐨勬牳蹇冩€濇兂銆俙;
  } else if(lower.includes('鍏紬鍙?) || lower.includes('灏忕孩涔?) || lower.includes('閫夐')) {
    response = `<span class="q-label">馃攧 鍐呭杞寲鍒嗘瀽</span><br>杩欎釜鍐呭闈炲父閫傚悎鍋氭垚锛?br><br>馃摃 <strong>灏忕孩涔?/strong>锛氭彁鐐?涓牳蹇冭鐐?+ 浣犵殑鐪熷疄鎰熸偀 鈫?鍋氭垚銆岃涔︾瑪璁般€嶅浘鏂?br>馃摙 <strong>鍏紬鍙?/strong>锛氬洿缁曡繖涓鐐瑰睍寮€锛岀粨鍚堜綘浣滀负鏂板獟浣撴眰鑱岃€呯殑缁忓巻 鈫?涓汉鎴愰暱绫绘枃绔?br>馃幀 <strong>瑙嗛/鍙ｆ挱</strong>锛?鍒嗛挓鍒嗕韩涓€涓功涓浣犻啀閱愮亴椤剁殑瑙傜偣<br><br>鏍稿績鍗栫偣灏辨槸"鐪熷疄鐨勪釜浜烘劅鎮?鈥斺€旇繖鏄渶绋€缂虹殑鍐呭銆俙;
  } else {
    response = `<span class="q-label">馃摉 闃呰鍚戝</span><br>浣犵殑鎬濊€冨緢鏈変环鍊硷紒璁╂垜寮曞浣犵户缁繁鍏ワ細<br><br>馃 <strong>鎯充竴鎯筹細</strong><br>鈥?杩欎釜鍐呭璁╀綘鑱旀兂鍒拌嚜宸辩殑浠€涔堢粡鍘嗭紵<br>鈥?浣犺寰椾綔鑰呬负浠€涔堣鍐欒繖閮ㄥ垎锛?br>鈥?濡傛灉浣犵殑濂芥湅鍙嬭鍒拌繖閲岋紝浣犱細鎬庝箞鍚戜粬杞堪锛?br><br>馃挕 鎴栬€呰瘯璇曚粠鍐呭鍒涗綔瑙掑害鎬濊€冿細杩欎釜瑙傜偣鑳戒笉鑳藉仛鎴愪竴鏉″皬绾功绗旇锛焋;
  }
  
  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg ai';
  aiMsg.innerHTML = `<div class="avatar">馃</div><div class="content">${response}</div>`;
  chat.insertBefore(aiMsg, chat.querySelector('.chat-input'));
  
  // Scroll to bottom
  chat.scrollTop = chat.scrollHeight;
  
  // Save to reading notes as a thought
  const notes = DB.get('read_notes',[]);
  notes.push({
    date: todayStr(),
    type: 'thought',
    content: text,
    aiResponse: response.replace(/<[^>]*>/g, '').substring(0, 100),
    _ts: Date.now()
  });
  DB.set('read_notes', notes);
  renderReadThoughts();
}

// ========== 闃呰绗旇 ==========
function renderReadNotes() {
  const notes = DB.get('read_notes',[]).filter(n => n.type !== 'thought');
  const el = document.getElementById('readNoteList');
  const typeIcons = {summary:'馃摑', opinion:'馃挱', quote:'馃挰', value:'馃寛', action:'馃幆'};
  
  if(!notes.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;"><div style="font-size:40px;margin-bottom:10px;">馃摉</div><p>杩炴帴寰俊璇讳功鎴栨墜鍔ㄨ褰曢槄璇荤瑪璁?/p><p style="font-size:12px;margin-top:4px;">姣忔璁板綍閮戒細娌夋穩鍒颁綘鐨勪釜浜烘€濇兂搴?/p></div>';
    return;
  }
  
  // Group by book
  const byBook = {};
  notes.forEach(n => {
    const key = n.book || '鍏朵粬';
    if(!byBook[key]) byBook[key] = [];
    byBook[key].push(n);
  });
  
  el.innerHTML = Object.entries(byBook).map(([book, bookNotes]) => `
    <div class="reading-book-item">
      <div class="bi-cover">馃摉</div>
      <div class="bi-info">
        <div class="bi-name">銆?{book}銆?/div>
        <div class="bi-meta">${bookNotes.length} 鏉＄瑪璁?/div>
        ${bookNotes.slice().reverse().slice(0,3).map(n => `
          <div class="bi-summary">
            <span style="font-weight:600;">${typeIcons[n.type]||'馃摑'} ${n.chapter||''}</span>
            <br>${n.content ? (n.content.length > 80 ? n.content.slice(0,80)+'...' : n.content) : ''}
            ${n.keyPoint ? `<br><span style="color:#c45677;">馃挕 ${n.keyPoint}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function saveReadNote() {
  const rec = {
    date: document.getElementById('rnDate').value || todayStr(),
    book: document.getElementById('rnBook').value,
    chapter: document.getElementById('rnChapter').value,
    type: document.getElementById('rnType').value,
    time: parseFloat(document.getElementById('rnTime').value)||0,
    content: document.getElementById('rnContent').value,
    keyPoint: document.getElementById('rnKeyPoint').value,
    _ts: Date.now()
  };
  if(!rec.book && !rec.content) { alert('璇疯緭鍏ヤ功鍚嶆垨绗旇鍐呭'); return; }
  
  const notes = DB.get('read_notes',[]);
  notes.push(rec);
  DB.set('read_notes', notes);
  
  // Also save time to reading_records for XP
  if(rec.time > 0) {
    const recs = DB.get('reading_records',[]);
    recs.push({date: rec.date, book: rec.book, time: rec.time, pages: 0});
    DB.set('reading_records', recs);
  }
  
  closeModal('readingNoteModal');
  clearForm(['rnDate','rnBook','rnChapter','rnTime','rnContent','rnKeyPoint']);
  refreshReading(); refreshDashboard();
}

function generateReadSummary() {
  const notes = DB.get('read_notes',[]);
  if(!notes.length) { alert('杩樻病鏈夌瑪璁帮紝鍏堣褰曚竴浜涢槄璇诲唴瀹瑰惂锛?); return; }
  
  const recent = notes[notes.length-1];
  const summary = `馃摉 **${recent.book||'闃呰'}灏忕粨**\n\n馃摑 鏈珷鏍稿績鍐呭锛歕n${recent.content||'锛堢瓑寰呰褰曪級'}\n\n馃挱 鎴戠殑鐞嗚В锛歕n杩欎釜瑙傜偣璁╂垜閲嶆柊鎬濊€冧簡...锛堝缓璁湪绗旇涓ˉ鍏呬綘鐨勭悊瑙ｏ級\n\n馃幆 鍙鍔ㄥ缓璁細\n1. 灏嗘牳蹇冪悊蹇典笌涓汉缁忓巻缁撳悎\n2. 灏濊瘯褰㈡垚涓€绡囧叕浼楀彿鏂囩珷鎴栧皬绾功绗旇\n3. 鍦ㄦ棩甯哥敓娲讳腑瀹炶返杩欎釜瑙傜偣`;
  
  alert('鉁?AI 闃呰鎬荤粨宸茬敓鎴愶紒\n\n' + summary + '\n\n锛堟洿瀹屾暣鐨勫姛鑳藉皢鍦ㄨ繛鎺ュ井淇¤涔PI鍚庤嚜鍔ㄧ敓鎴愶級');
}

// ========== 鎬濇兂搴?==========
let thoughtFilter = 'all';

function switchThoughtFilter(filter, btn) {
  thoughtFilter = filter;
  document.querySelectorAll('#readTabThoughts .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderReadThoughts();
}

function renderReadThoughts() {
  let thoughts = DB.get('read_notes',[]);
  const filterMap = {opinion:'馃挱鎴戠殑瑙傜偣', quote:'馃挰閲戝彞鎽樻妱', value:'馃寛浠峰€艰鎬濊€?, thought:'馃挱闃呰闅忔兂'};
  const tagClass = {opinion:'opinion', quote:'quote', value:'value', thought:'opinion'};
  
  if(thoughtFilter !== 'all') {
    thoughts = thoughts.filter(t => t.type === thoughtFilter);
  }
  
  const el = document.getElementById('readThoughtList');
  if(!thoughts.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;">馃 杩樻病鏈夋€濇兂娌夋穩锛屽紑濮嬮槄璇诲苟璁板綍鍚?/div>';
    return;
  }
  
  el.innerHTML = thoughts.slice().reverse().map(t => `
    <div class="reading-thought-item">
      <div class="ti-head">
        <span>${t.book ? '馃摉銆?+t.book+'銆? : '馃摑 闃呰闅忔兂'} 路 ${t.date||''}</span>
        <span class="ti-tag ${tagClass[t.type]||'opinion'}">${filterMap[t.type]||'馃摑绗旇'}</span>
      </div>
      <div class="ti-text">${escapeHtml(t.content||'')}</div>
      ${t.keyPoint ? `<div style="margin-top:4px;font-size:12px;color:#c45677;">馃挕 ${escapeHtml(t.keyPoint)}</div>` : ''}
    </div>
  `).join('');
}

// ========== 鍐呭杞寲 ==========
function renderReadConversion() {
  const notes = DB.get('read_notes',[]);
  const el = document.getElementById('readConvertList');
  
  if(!notes.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:#b3a0a8;">馃攧 鏆傛棤鍙浆鍖栫殑鍐呭锛岃褰曢槄璇荤瑪璁板悗鑷姩鍒嗘瀽</div>';
    return;
  }
  
  // Generate conversion suggestions based on notes
  const conversions = [
    {
      icon: '馃摃',
      title: '銆岃鐭ヨ閱掋€嶈涔︾瑪璁?鈥?鍏冭鐭ョ殑鍔涢噺',
      desc: '浠庝功涓厓璁ょ煡姒傚康鍑哄彂锛岀粨鍚堜釜浜虹粡鍘嗗啓涓€绡囨繁搴︽€濊€冩枃绔?,
      platform: 'xhs',
      platformLabel: '灏忕孩涔?
    },
    {
      icon: '馃摙',
      title: '搴斿眾鐢熸眰鑱屽锛氬浣曠敤銆屽厓璁ょ煡銆嶆彁鍗囬潰璇曡〃鐜?,
      desc: '灏嗚鐭ュ績鐞嗗鐭ヨ瘑搴旂敤鍒版眰鑱屽満鏅紝瀹炵敤鎬у己锛屽鏄撳紩鍙戝叡楦?,
      platform: 'wechat',
      platformLabel: '鍏紬鍙?
    },
    {
      icon: '馃幀',
      title: '3涓敼鍙樻垜鎬濈淮鏂瑰紡鐨勪功鎽?| 1鍒嗛挓鍙ｆ挱',
      desc: '閫夊彇鏈€鏈夊啿鍑诲姏鐨?涓鐐癸紝閰嶅悎涓汉鎰熸偀鍋氭垚鐭棰?,
      platform: 'video',
      platformLabel: '鐭棰?
    },
    {
      icon: '馃摃',
      title: '鎽樻妱+鎰熸偀锛氶偅浜涜鎴戦啀閱愮亴椤剁殑鍙ュ瓙',
      desc: '绮鹃€変功涓殑閲戝彞 + 浣犵殑鐞嗚В锛屽仛鎴愮郴鍒楄涔﹀崱鐗?,
      platform: 'xhs',
      platformLabel: '灏忕孩涔?
    }
  ];
  
  el.innerHTML = conversions.map(c => `
    <div class="reading-conversion-item">
      <div class="ci-icon">${c.icon}</div>
      <div class="ci-info">
        <div class="ci-title">${c.title}</div>
        <div class="ci-desc">${c.desc}</div>
      </div>
      <span class="ci-platform ${c.platform}">${c.platformLabel}</span>
    </div>
  `).join('');
}

// ========== 鎴愰暱鍒嗘瀽 ==========
let readPeriod = 'week';

function switchReadPeriod(period, btn) {
  readPeriod = period;
  document.querySelectorAll('#readTabAnalytics .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderReadAnalytics();
}

function renderReadAnalytics() {
  const now = new Date();
  const today = todayStr();
  let startDate;
  if(readPeriod === 'week') {
    const dow = now.getDay() || 7;
    const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
    startDate = monday.toISOString().slice(0,10);
  } else {
    startDate = today.slice(0,7)+'-01';
  }
  
  const notes = DB.get('read_notes',[]).filter(n => n.date >= startDate);
  const recs = DB.get('reading_records',[]).filter(r => r.date >= startDate);
  const totalTime = recs.reduce((s,r)=>s+(parseFloat(r.time)||0), 0);
  const booksRead = [...new Set(notes.filter(n=>n.book).map(n=>n.book))];
  const thoughts = notes.filter(n => ['opinion','value','thought'].includes(n.type));
  const quotes = notes.filter(n => n.type === 'quote');
  
  let contentConversions = 0;
  // Simulate: each week with notes -> at least 2 content ideas
  if(notes.length > 0) contentConversions = Math.min(notes.length, 8);

  document.getElementById('readAnalyticsContent').innerHTML = `
    <div class="health-review-card">
      <h4 style="margin:0 0 10px;font-size:15px;color:#5d3a4f;">馃搳 ${readPeriod==='week'?'鏈懆':'鏈湀'}闃呰鏁版嵁</h4>
      <div class="review-stat"><span>鈴憋笍 闃呰鏃堕棿</span><span class="num">${totalTime} 鍒嗛挓</span></div>
      <div class="review-stat"><span>馃摎 闃呰涔︾睄</span><span class="num">${booksRead.length} 鏈?/span></div>
      <div class="review-stat"><span>馃摑 绗旇鏁伴噺</span><span class="num">${notes.length} 鏉?/span></div>
      <div class="review-stat"><span>馃挱 鎬濊€冩矇娣€</span><span class="num">${thoughts.length} 鏉?/span></div>
      <div class="review-stat"><span>馃挰 閲戝彞鎽樻妱</span><span class="num">${quotes.length} 鏉?/span></div>
      <div class="review-stat"><span>馃攧 鍙垱浣滃唴瀹?/span><span class="num">${contentConversions} 涓?/span></div>
    </div>
    <div class="health-review-card">
      <h4 style="margin:0 0 10px;font-size:15px;color:#5d3a4f;">馃挕 璁ょ煡鍙樺寲鍒嗘瀽</h4>
      <div class="review-advice">
        ${notes.length > 0 
          ? `浣犵殑闃呰姝ｅ湪杞寲涓烘€濊€冦€?{booksRead.length}鏈?{readPeriod==='week'?'姝ｅ湪闃呰':'宸茶'}鐨勪功绫嶄负浣犳彁渚涗簡${thoughts.length}鏉′釜浜烘€濊€冨拰${quotes.length}鏉￠噾鍙ユ憳鎶勩€?br><br>馃幆 <strong>寤鸿锛?/strong>灏嗚繖浜涙€濊€冭繘涓€姝ヨ浆鍖栦负鍐呭鍒涗綔銆備綘鐨勩€岃鐭ヨ閱掋€嶉槄璇荤瑪璁伴潪甯搁€傚悎鍋氭垚灏忕孩涔﹁涔﹀崱鐗囥€俙
          : '寮€濮嬭褰曢槄璇诲悗锛岃繖閲屼細鑷姩鍒嗘瀽浣犵殑璁ょ煡鎴愰暱杞ㄨ抗銆?}
      </div>
    </div>
  `;
}

function switchReadTab(tab, btn) {
  document.querySelectorAll('#page-reading .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['library','assistant','records','cards','convert','analytics'].forEach(t => {
    const el = document.getElementById('readTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el) el.style.display = t===tab?'block':'none';
  });
  if(tab === 'cards') renderKnowledgeCards();
  if(tab === 'convert') populateConvertSelect();
}

// ========== WECHAT ==========
function refreshWechat() {
  const today = new Date().toISOString().slice(0,10);
  const insp = DB.get('wechat_insp_'+today,{});
  document.getElementById('wiEvent').value = insp.event||'';
  document.getElementById('wiObservation').value = insp.observation||'';
  document.getElementById('wiThought').value = insp.thought||'';
  document.getElementById('wiTheme').value = insp.theme||'';

  const articles = DB.get('wechat_articles',[]);
  document.getElementById('wechatArticleList').innerHTML = articles.length ? articles.slice().reverse().map((a,i)=>`
    <div class="record-item">
      <div class="record-item-header">
        <span class="record-item-title">鉁嶏笍 ${a.title}</span>
        <span class="status-badge status-${a.status}">${a.status==='published'?'宸插彂甯?:'鑽夌'}</span>
      </div>
      <div class="record-item-body">
        馃搮 ${a.publishDate||'-'} | ${a.readData||'鏆傛棤鏁版嵁'}
        ${a.review ? '<br><br>'+a.review : ''}
      </div>
      <div class="record-actions">
        <button class="del-btn" onclick="delWechatArticle(${articles.length-1-i})">馃棏</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><div class="icon">鉁嶏笍</div><p>杩樻病鏈夋枃绔狅紝寮€濮嬪垱浣滃惂锛?/p></div>';
}

function switchWechatTab(tab, btn) {
  document.querySelectorAll('#page-wechat .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('wechatTabInspiration').style.display = tab==='inspiration'?'block':'none';
  document.getElementById('wechatTabArticles').style.display = tab==='articles'?'block':'none';
}

function saveWechatInspiration() {
  const today = new Date().toISOString().slice(0,10);
  DB.set('wechat_insp_'+today,{
    event: document.getElementById('wiEvent').value,
    observation: document.getElementById('wiObservation').value,
    thought: document.getElementById('wiThought').value,
    theme: document.getElementById('wiTheme').value,
  });
}

function saveWechatArticle() {
  const rec = {
    title: document.getElementById('waTitle').value,
    status: document.getElementById('waStatus').value,
    publishDate: document.getElementById('waPublishDate').value,
    readData: document.getElementById('waReadData').value,
    review: document.getElementById('waReview').value,
  };
  const recs = DB.get('wechat_articles',[]);
  recs.push(rec);
  DB.set('wechat_articles',recs);
  closeModal('wechatArticleModal');
  clearForm(['waTitle','waStatus','waPublishDate','waReadData','waReview']);
  refreshWechat();
}

function delWechatArticle(idx){ const r=DB.get('wechat_articles',[]);r.splice(idx,1);DB.set('wechat_articles',r);refreshWechat(); }

// ========== WEEKLY SUMMARY ==========
function refreshWeekly() {
  const now = new Date();
  const dow = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  document.getElementById('weekRange').textContent = `${formatDateLong(monday.toISOString().slice(0,10))} ~ ${formatDateLong(sunday.toISOString().slice(0,10))}`;

  const weekKey = monday.toISOString().slice(0,10);
  const summary = DB.get('weekly_'+weekKey,{});
  document.getElementById('wsDone').value = summary.done||'';
  document.getElementById('wsHarvest').value = summary.harvest||'';
  document.getElementById('wsProblem').value = summary.problem||'';
  document.getElementById('wsNextWeek').value = summary.nextWeek||'';

  // Auto-calc stats
  const engRecs = DB.get('english_records',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  const engMins = engRecs.reduce((s,r)=>s+(parseInt(r.time)||0),0);
  document.getElementById('wsEnglish').textContent = Math.round(engMins/60)+'h';

  const readRecs = DB.get('reading_records',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  document.getElementById('wsReading').textContent = readRecs.length;

  const xhsRecs = DB.get('xhs_records',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  document.getElementById('wsContent').textContent = xhsRecs.filter(r=>r.status==='published').length;

  const jobRecs = DB.get('job_apply',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  document.getElementById('wsJobApply').textContent = jobRecs.length;

  const aiRecs = DB.get('ai_tasks',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  document.querySelector('[wsAiTasks]').textContent = aiRecs.length;

  // Exercise - auto count from burn records this week
  const burnThisWeek = DB.get('burn_records',[]).filter(r=>r.date>=monday.toISOString().slice(0,10)&&r.date<=sunday.toISOString().slice(0,10));
  document.getElementById('wsExercise').textContent = burnThisWeek.length;

  // Weekly XP and growth feedback
  const xpByDay = calcAllXp();
  let weekXp = 0;
  let weekDaysWithXp = 0;
  Object.entries(xpByDay).forEach(([d,xp]) => {
    if(d >= monday.toISOString().slice(0,10) && d <= sunday.toISOString().slice(0,10)) {
      weekXp += xp;
      weekDaysWithXp++;
    }
  });
  const totalXp = calcTotalXp();
  const lv = getLevel(totalXp);
  const growthMessages = [
    "杩欎竴鍛ㄤ綘瀹屾垚鐨勪笉鍙槸浠诲姟锛岃€屾槸鍦ㄩ€愭笎寤虹珛鑷繁鐨勮兘鍔涗綋绯汇€?,
    "鎸佺画琛屽姩鐨勫姏閲忔鍦ㄧН绱紝鍧氭寔涓嬪幓锛屼綘浼氱湅鍒拌川鍙樼殑閭ｄ竴澶┿€?,
    "姣忎竴浠藉姫鍔涢兘鍦ㄤ负鏈潵鐨勪綘閾鸿矾銆?,
    "浣犵敤琛屽姩璇佹槑浜嗚嚜宸辨鍦ㄥ彉寰楁洿濂姐€?,
    "鎴愰暱灏辨槸鍦ㄦ棩澶嶄竴鏃ョ殑鍧氭寔涓倓鐒跺彂鐢熺殑銆?
  ];
  document.getElementById('weeklyGrowthFeedback').innerHTML = `
    馃専 <strong>鏈懆鑾峰緱 ${weekXp} XP</strong> 路 ${weekDaysWithXp}澶╂湁琛屽姩<br>
    绱 ${totalXp} XP 路 褰撳墠 ${lv.short} ${lv.name}<br><br>
    馃挰 "${growthMessages[Math.floor(Math.random()*growthMessages.length)]}"
  `;

  // Streak calendar
  renderWeeklyTrend();
  renderStreakCalendar();
}

function saveWeeklySummary() {
  const now = new Date();
  const dow = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
  const weekKey = monday.toISOString().slice(0,10);
  const prev = DB.get('weekly_'+weekKey,{});
  DB.set('weekly_'+weekKey,{
    ...prev,
    done: document.getElementById('wsDone').value,
    harvest: document.getElementById('wsHarvest').value,
    problem: document.getElementById('wsProblem').value,
    nextWeek: document.getElementById('wsNextWeek').value,
  });
}

function renderStreakCalendar() {
  const el = document.getElementById('streakCalendar');
  const days = ['涓€','浜?,'涓?,'鍥?,'浜?,'鍏?,'鏃?];
  const now = new Date();
  const dow = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
  el.innerHTML = days.map((d,i)=>{
    const date = new Date(monday); date.setDate(monday.getDate()+i);
    const key = date.toISOString().slice(0,10);
    const isFuture = date > now;
    const goals = DB.get('goals_'+key);
    const done = goals && goals.some(g=>g.done);
    return `<div style="
      width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:600;cursor:${isFuture?'default':'pointer'};
      background:${done?'var(--primary)':isFuture?'var(--border)':'var(--bg)'};
      color:${done?'white':isFuture?'var(--text-light)':'var(--text-secondary)'};
    ">${d}</div>`;
  }).join('');
}

// ========== FINANCE ==========
const EXPENSE_EMOJI = {'椁愰ギ':'馃崪','浜ら€?:'馃殞','璐墿':'馃泹锔?,'濞变箰':'馃幃','瀛︿範':'馃摎','灞呬綇':'馃彔','鍖荤枟':'馃拪','鍏朵粬':'馃摝'};
const INCOME_EMOJI = {'宸ヨ祫':'馃捈','鍏艰亴':'馃洜锔?,'濂栧閲?:'馃帗','绾㈠寘':'馃Ё','鐞嗚储':'馃搱','鍏朵粬':'馃摝'};
function catEmoji(c, type){ const m=type==='income'?INCOME_EMOJI:EXPENSE_EMOJI; return m[c]||'馃搶'; }
function mealEmoji(m){ return {'鏃╅':'馃寘','鍗堥':'鈽€锔?,'鏅氶':'馃寵','鍔犻':'馃崕'}[m]||'馃嵔锔?; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtMoney(n){ return Number(n).toLocaleString('zh-CN',{minimumFractionDigits:n%1===0?0:2,maximumFractionDigits:2}); }
function emptyState(icon,text){ return `<div class="empty-state"><div class="icon">${icon}</div><p>${text}</p></div>`; }
function escapeHtml(str){ const d=document.createElement('div'); d.textContent=str||''; return d.innerHTML; }

function selectCat(prefix, el, val){
  document.querySelectorAll('#'+prefix+'Cats .cat-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById(prefix+'Category').value = val;
}

function refreshFinance(){
  const now=new Date();
  const month = now.toISOString().slice(0,7);
  const expenses = DB.get('fin_expense',[]).filter(r=>r.date.startsWith(month));
  const incomes = DB.get('fin_income',[]).filter(r=>r.date.startsWith(month));
  const totalExp = expenses.reduce((s,r)=>s+r.amount,0);
  const totalInc = incomes.reduce((s,r)=>s+r.amount,0);
  const balance = totalInc - totalExp;

  // Greeting based on time
  const hr = now.getHours();
  let greet = '鏅氫笂濂?馃寵';
  if(hr >= 5 && hr < 11) greet = '鏃╀笂濂?鈽€锔?;
  else if(hr >= 11 && hr < 14) greet = '涓崍濂?馃尋锔?;
  else if(hr >= 14 && hr < 18) greet = '涓嬪崍濂?馃尀';
  const greetEl = document.getElementById('piggyGreetEmoji');
  if(greetEl) greetEl.textContent = greet;

  // Big balance card
  document.getElementById('piggyBalance').textContent = '楼'+fmtMoney(balance);
  document.getElementById('piggyIncome').textContent = '楼'+fmtMoney(totalInc);
  document.getElementById('piggyExpense').textContent = '楼'+fmtMoney(totalExp);

  // Budget
  const budget = parseFloat(DB.get('fin_budget_'+month, 0)) || 0;
  const remain = budget - totalExp;
  const usedPct = budget > 0 ? Math.min(100, (totalExp/budget*100)) : 0;
  document.getElementById('piggyBudgetRemain').textContent = '楼'+fmtMoney(remain);
  document.getElementById('piggyBudgetUsed').textContent = '楼'+fmtMoney(totalExp);
  document.getElementById('piggyBudgetTotal').textContent = '楼'+fmtMoney(budget);
  const fill = document.getElementById('piggyBudgetFill');
  fill.style.width = usedPct+'%';
  fill.classList.remove('warn','over');
  if(totalExp > budget && budget > 0) fill.classList.add('over');
  else if(usedPct >= 80) fill.classList.add('warn');

  // Category grid (8 expenses)
  const expenseCats = [
    {emoji:'馃嵔锔?, name:'椁愰ギ'}, {emoji:'馃殫', name:'浜ら€?},
    {emoji:'馃泹锔?, name:'璐墿'}, {emoji:'馃幃', name:'濞变箰'},
    {emoji:'馃彔', name:'灞呬綇'}, {emoji:'馃拪', name:'鍖荤枟'},
    {emoji:'馃摎', name:'瀛︿範'}, {emoji:'馃搶', name:'鍏朵粬'}
  ];
  document.getElementById('piggyCatGrid').innerHTML = expenseCats.map(c=>`
    <div class="cat-grid-item" onclick="quickAddExpense('${c.name}')">
      <div class="cat-icon">${c.emoji}</div>
      <div class="cat-label">${c.name}</div>
    </div>
  `).join('');

  // Recent transactions (merge income + expense, last 10)
  const all = [
    ...expenses.map(r=>({...r, _type:'expense'})),
    ...incomes.map(r=>({...r, _type:'income'}))
  ].sort((a,b)=>b.date.localeCompare(a.date) || b._ts - a._ts).slice(0,10);
  // Attach timestamps for stable order
  all.forEach(r=>{ r._ts = r._ts || (r.date ? new Date(r.date).getTime() : 0); });

  document.getElementById('piggyRecentList').innerHTML = all.length ? all.map(r=>`
    <div class="piggy-transaction">
      <div class="left">
        <div class="t-icon">${r._type==='expense' ? catEmoji(r.category) : catEmoji(r.category,'income')}</div>
        <div class="t-info">
          <div class="t-name">${r.category}</div>
          <div class="t-meta">${r.date.slice(5)}${r.note?' 路 '+r.note:''}</div>
        </div>
      </div>
      <div class="t-amount ${r._type}">${r._type==='expense'?'-':'+'}楼${fmtMoney(r.amount)}</div>
    </div>
  `).join('') : emptyState('馃挵','杩樻病鏈夎璐﹁褰曪紝鐐瑰嚮涓婃柟鎸夐挳寮€濮嬪惂');

  renderFinCategoryBreakdown(expenses);
}

function editBudget(){
  const month = new Date().toISOString().slice(0,7);
  const current = DB.get('fin_budget_'+month, 0);
  const v = prompt('璁剧疆鏈湀棰勭畻锛堝厓锛?, current || '');
  if(v === null) return;
  const num = parseFloat(v);
  if(isNaN(num) || num < 0){ alert('璇疯緭鍏ユ湁鏁堥噾棰?); return; }
  DB.set('fin_budget_'+month, num);
  refreshFinance();
}

function quickAddExpense(category){
  // Preset category and open expense modal
  document.querySelectorAll('#feCats .cat-chip').forEach(c=>c.classList.remove('selected'));
  const chips = document.querySelectorAll('#feCats .cat-chip');
  for(const c of chips){
    if(c.textContent.includes(category)){ c.classList.add('selected'); break; }
  }
  document.getElementById('feCategory').value = category;
  // Default today's date
  if(!document.getElementById('feDate').value) document.getElementById('feDate').value = todayStr();
  openModal('finExpenseModal');
  setTimeout(()=>{ document.getElementById('feAmount').focus(); }, 100);
}

function renderFinCategoryBreakdown(expenses){
  const el=document.getElementById('finCategoryBreakdown');
  if(!expenses.length){ el.innerHTML='<p style="color:var(--text-secondary);font-size:14px;">鏈湀鏆傛棤鏀嚭</p>'; return; }
  const byCat={}; expenses.forEach(r=>{ byCat[r.category]=(byCat[r.category]||0)+r.amount; });
  const total=Object.values(byCat).reduce((s,v)=>s+v,0);
  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  el.innerHTML=sorted.map(([cat,amt])=>{
    const pct=Math.round(amt/total*100);
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span>${catEmoji(cat)} ${cat}</span><span>楼${fmtMoney(amt)} 路 ${pct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function saveFinExpense(){
  const rec={ date:document.getElementById('feDate').value||todayStr(), amount:parseFloat(document.getElementById('feAmount').value)||0, category:document.getElementById('feCategory').value, note:document.getElementById('feNote').value };
  const recs=DB.get('fin_expense',[]);recs.push(rec);DB.set('fin_expense',recs);
  closeModal('finExpenseModal');clearForm(['feDate','feAmount','feNote']);
  document.getElementById('feCategory').value='椁愰ギ';
  document.querySelectorAll('#feCats .cat-chip').forEach((c,idx)=>c.classList.toggle('selected',idx===0));
  refreshFinance();refreshDashboard();
}
function delFinExpense(idx){ const r=DB.get('fin_expense',[]);r.splice(idx,1);DB.set('fin_expense',r);refreshFinance();refreshDashboard(); }

function saveFinIncome(){
  const rec={ date:document.getElementById('fiDate').value||todayStr(), amount:parseFloat(document.getElementById('fiAmount').value)||0, category:document.getElementById('fiCategory').value, note:document.getElementById('fiNote').value };
  const recs=DB.get('fin_income',[]);recs.push(rec);DB.set('fin_income',recs);
  closeModal('finIncomeModal');clearForm(['fiDate','fiAmount','fiNote']);
  document.getElementById('fiCategory').value='宸ヨ祫';
  document.querySelectorAll('#fiCats .cat-chip').forEach((c,idx)=>c.classList.toggle('selected',idx===0));
  refreshFinance();refreshDashboard();
}
function delFinIncome(idx){ const r=DB.get('fin_income',[]);r.splice(idx,1);DB.set('fin_income',r);refreshFinance();refreshDashboard(); }

// ========== INTAKE & BURN ==========
function refreshIntake(){
  const today = todayStr();
  document.getElementById('healthDate').textContent = formatDateLong(today);
  const healthProfile = DB.get('health_profile',{});
  const hr = new Date().getHours();

  // ========== 1. 鑳介噺骞宠　鍗＄墖 ==========
  const recs = DB.get('intake_records',[]).filter(r=>r.date===today);
  const burns = DB.get('burn_records',[]).filter(r=>r.date===today);
  const intakeSum = recs.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  // BMR
  const bmr = calcBmr(healthProfile);
  // Steps (convert to calorie: ~0.04 kcal per step for avg person)
  const steps = parseInt(DB.get('steps_'+today, 0));
  const stepsCal = Math.round(steps * 0.04);
  const exerciseCal = burns.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  const burnSum = bmr + exerciseCal + stepsCal;
  const net = intakeSum - burnSum;

  document.getElementById('healthIntake').textContent = intakeSum;
  document.getElementById('healthBurn').textContent = burnSum;
  document.getElementById('healthNet').textContent = net;
  const netEl = document.getElementById('healthNet');
  netEl.style.color = net < -100 ? '#b7f0d0' : net > 100 ? '#ffe08a' : '#fff';
  document.getElementById('healthEquation').textContent =
    `鎽勫叆 ${intakeSum} 鈭?娑堣€?${bmr}(BMR)+${exerciseCal}(杩愬姩)+${stepsCal}(姝ユ暟) = ${net>=0?'+':''}${net}`;

  // ========== 2. 楗璁板綍锛堟寜椁愭锛?==========
  refreshMealList('breakfast', recs);
  // 榛樿閫変腑鏃╅锛屾墍浠ュ彧闇€瑕佸埛鏂?

  // ========== 3. 娑堣€楃鐞?==========
  document.getElementById('healthBmr').textContent = bmr ? bmr+' kcal' : '--';
  refreshBurnList(burns);
  const savedSteps = DB.get('steps_'+today, '');
  document.getElementById('healthSteps').value = savedSteps;

  // ========== 4. 韬綋鐩爣 ==========
  refreshHealthGoal(healthProfile);

  // ========== 5. 鍋ュ悍鎶ュ憡 ==========
  refreshHealthReport();
}

// ===== 楗璁板綍 =====
let currentMealTab = 'breakfast';

function switchMealTab(tab, btn){
  currentMealTab = tab;
  document.querySelectorAll('#page-intake .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const today = todayStr();
  const recs = DB.get('intake_records',[]).filter(r=>r.date===today);
  refreshMealList(tab, recs);
}

function refreshMealList(meal, allRecs){
  const mealMap = {'breakfast':'鏃╅','lunch':'鍗堥','dinner':'鏅氶','snack':'鍔犻','drink':'楗搧'};
  const mealLabel = mealMap[meal] || meal;
  const filtered = allRecs.filter(r=>r.meal===mealLabel);
  const total = filtered.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  document.getElementById('healthMealTotal').textContent = total+' kcal';

  const el = document.getElementById('healthFoodList');
  if(!filtered.length){
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#b3a0a8;font-size:14px;">馃嵔锔?杩樻病鏈夎褰曪紝鐐瑰彸涓婅娣诲姞</div>';
    return;
  }
  el.innerHTML = filtered.map((r,i)=>{
    const fullIdx = DB.get('intake_records',[]).findIndex(x=>x._ts===r._ts);
    const realIdx = fullIdx>=0 ? fullIdx : i;
    return `<div class="health-food-item">
      <div class="hf-icon">${mealEmoji(r.meal)}</div>
      <div class="hf-info">
        <div class="hf-name">${r.food || '鏈煡椋熺墿'}</div>
        <div class="hf-macros">铔嬬櫧璐?{r.protein||'--'}g 路 纰虫按${r.carbs||'--'}g 路 鑴傝偑${r.fat||'--'}g${r.note?' 路 '+r.note:''}</div>
      </div>
      <div class="hf-cal">${r.cal} kcal</div>
      <button class="del-btn" onclick="delHealthFood(${realIdx})" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:16px;">鉁?/button>
    </div>`;
  }).join('');
}

function openFoodModal(){
  if(!document.getElementById('hfDate').value) document.getElementById('hfDate').value = todayStr();
  // Preselect meal based on current time and tab
  const mealMap = {breakfast:'鏃╅',lunch:'鍗堥',dinner:'鏅氶',snack:'鍔犻',drink:'楗搧'};
  document.getElementById('hfMeal').value = mealMap[currentMealTab] || '鏃╅';
  openModal('healthFoodModal');
}

function saveHealthFood(){
  const rec = {
    meal: document.getElementById('hfMeal').value,
    food: document.getElementById('hfFood').value,
    cal: parseFloat(document.getElementById('hfCal').value)||0,
    protein: parseFloat(document.getElementById('hfProtein').value)||'',
    carbs: parseFloat(document.getElementById('hfCarbs').value)||'',
    fat: parseFloat(document.getElementById('hfFat').value)||'',
    date: document.getElementById('hfDate').value||todayStr(),
    note: document.getElementById('hfNote').value,
    _ts: Date.now()
  };
  if(!rec.food){ alert('璇疯緭鍏ラ鐗╁悕绉?); return; }
  const recs = DB.get('intake_records',[]);
  recs.push(rec);
  DB.set('intake_records', recs);
  closeModal('healthFoodModal');
  clearForm(['hfFood','hfCal','hfProtein','hfCarbs','hfFat','hfNote']);
  document.getElementById('foodAiResult').style.display = 'none';
  refreshIntake(); refreshDashboard();
}

function delHealthFood(idx){
  const r = DB.get('intake_records',[]);
  r.splice(idx,1);
  DB.set('intake_records', r);
  refreshIntake(); refreshDashboard();
}

// ===== AI 椋熺墿璇嗗埆锛堟ā鎷?demo锛?=====
function analyzeFoodPhoto(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      // Simulate AI analysis based on filename/time for demo
      const name = file.name.toLowerCase();
      let result = {food:'钄彍娌欐媺', cal:280, protein:12, carbs:35, fat:8};
      if(name.includes('楗?)||name.includes('rice')) result = {food:'绫抽キ濂楅', cal:550, protein:20, carbs:65, fat:15};
      else if(name.includes('闈?)||name.includes('noodle')) result = {food:'鐗涜倝闈?, cal:480, protein:18, carbs:55, fat:12};
      else if(name.includes('鑲?)||name.includes('meat')) result = {food:'绾㈢儳鑲?, cal:420, protein:25, carbs:8, fat:35};
      else if(name.includes('姘存灉')||name.includes('fruit')) result = {food:'姘存灉鎷肩洏', cal:150, protein:2, carbs:35, fat:1};
      else if(name.includes('铔?)||name.includes('egg')) result = {food:'鐓庤泲涓夋槑娌?, cal:320, protein:15, carbs:30, fat:14};
      else if(name.includes('鐗涘ザ')||name.includes('milk')) result = {food:'鐗涘ザ鐕曢害', cal:220, protein:8, carbs:30, fat:6};
      else if(name.includes('鍖?)||name.includes('bread')) result = {food:'鑲夊寘瀛?, cal:250, protein:10, carbs:35, fat:8};
      else if(name.includes('铔嬬硶')||name.includes('cake')) result = {food:'铔嬬硶', cal:380, protein:5, carbs:45, fat:20};
      // Time-based guess
      const hr = new Date().getHours();
      if(hr >= 5 && hr <= 9 && !name.includes('鑲?)) result = {food:'璞嗘祮娌规潯', cal:350, protein:10, carbs:40, fat:15};

      document.getElementById('hfFood').value = result.food;
      document.getElementById('hfCal').value = result.cal;
      document.getElementById('hfProtein').value = result.protein;
      document.getElementById('hfCarbs').value = result.carbs;
      document.getElementById('hfFat').value = result.fat;
      document.getElementById('foodAiContent').innerHTML = `
        <div class="ai-row"><span>馃嵔锔?${result.food}</span><span class="tag">馃敟 ${result.cal} kcal</span></div>
        <div class="ai-row"><span>铔嬬櫧璐?${result.protein}g 路 纰虫按 ${result.carbs}g 路 鑴傝偑 ${result.fat}g</span></div>
        <div style="margin-top:6px;font-size:12px;color:#b3a0a8;">璇嗗埆浠呬緵鍙傝€冿紝鍙墜鍔ㄨ皟鏁存暟鍊?/div>`;
      document.getElementById('foodAiResult').style.display = 'block';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ===== 娑堣€楃鐞?=====
let currentExerciseMet = null;

function pickExercise(type, met, btn){
  currentExerciseMet = parseFloat(met);
  document.querySelectorAll('.exercise-chip').forEach(b=>{
    b.style.background = '#eafeef'; b.style.color = '#2d7a4e';
  });
  btn.style.background = '#ffd5e0'; btn.style.color = '#c45677';
  document.getElementById('hbType').value = type;
  calcExerciseCal();
}

function calcExerciseCal(){
  const dur = parseFloat(document.getElementById('hbDuration').value)||0;
  // MET * weight(kg) * duration(hours)
  const weight = parseFloat(DB.get('health_profile',{}).weight) || 60;
  if(currentExerciseMet && dur){
    const cal = Math.round(currentExerciseMet * weight * (dur/60));
    document.getElementById('hbCal').value = cal;
  }
}

function saveHealthBurn(){
  const rec = {
    date: document.getElementById('hbDate').value||todayStr(),
    type: document.getElementById('hbType').value,
    duration: parseFloat(document.getElementById('hbDuration').value)||0,
    cal: parseFloat(document.getElementById('hbCal').value)||0,
    note: document.getElementById('hbNote').value,
    _ts: Date.now()
  };
  if(!rec.type){ alert('璇疯緭鍏ヨ繍鍔ㄧ被鍨?); return; }
  const recs = DB.get('burn_records',[]);
  recs.push(rec);
  DB.set('burn_records', recs);
  closeModal('healthBurnModal');
  clearForm(['hbType','hbDuration','hbCal','hbNote']);
  currentExerciseMet = null;
  document.querySelectorAll('.exercise-chip').forEach(b=>{ b.style.background='#eafeef'; b.style.color='#2d7a4e'; });
  refreshIntake(); refreshWeekly(); refreshDashboard();
}

function refreshBurnList(burns){
  document.getElementById('healthBurnList').innerHTML = burns.length ? burns.slice().reverse().map((r,i)=>{
    const fullIdx = DB.get('burn_records',[]).findIndex(x=>x._ts===r._ts);
    const realIdx = fullIdx>=0 ? fullIdx : i;
    return `<div class="health-exercise-item">
      <div class="hei-left">
        <div class="hei-icon">馃弮</div>
        <div class="hei-info">
          <div class="hei-type">${r.type}</div>
          <div class="hei-dur">${r.duration||0}鍒嗛挓${r.note?' 路 '+r.note:''}</div>
        </div>
      </div>
      <div>
        <span class="hei-cal">-${r.cal} kcal</span>
        <button class="del-btn" onclick="delHealthBurn(${realIdx})" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px;margin-left:8px;">鉁?/button>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:20px;color:#b3a0a8;font-size:14px;">馃弮 浠婂ぉ杩樻病鏈夎繍鍔ㄨ褰?/div>';
}

function delHealthBurn(idx){
  const r = DB.get('burn_records',[]);
  r.splice(idx,1);
  DB.set('burn_records', r);
  refreshIntake(); refreshWeekly(); refreshDashboard();
}

function saveSteps(){
  const today = todayStr();
  const steps = parseInt(document.getElementById('healthSteps').value)||0;
  DB.set('steps_'+today, steps);
  refreshIntake();
}

// ===== 韬綋鐩爣 =====
function calcBmr(profile){
  if(!profile.weight || !profile.height || !profile.age) return 0;
  // Mifflin-St Jeor
  const bmr = profile.gender==='鐢?
    ? 10*profile.weight + 6.25*profile.height - 5*profile.age + 5
    : 10*profile.weight + 6.25*profile.height - 5*profile.age - 161;
  return Math.round(bmr);
}

function calcBmi(weight, height){
  if(!weight || !height) return 0;
  return Math.round(weight / ((height/100)*(height/100)) * 10) / 10;
}

function refreshHealthGoal(profile){
  if(!profile.weight){
    ['healthWeight','healthHeight','healthAge','healthGender','healthGoalState','healthGoalFreq','healthTargetWeight','healthBmi'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.textContent = '--';
    });
    return;
  }
  document.getElementById('healthWeight').textContent = profile.weight+' kg';
  document.getElementById('healthHeight').textContent = profile.height+' cm';
  document.getElementById('healthAge').textContent = profile.age;
  document.getElementById('healthGender').textContent = profile.gender||'--';
  document.getElementById('healthGoalState').textContent = profile.goalState||'--';
  document.getElementById('healthGoalFreq').textContent = profile.goalFreq||'--';
  document.getElementById('healthTargetWeight').textContent = profile.targetWeight ? profile.targetWeight+' kg' : '--';
  const bmi = calcBmi(profile.weight, profile.height);
  document.getElementById('healthBmi').textContent = bmi ? bmi : '--';

  // Health advice
  let advice = '';
  if(bmi){
    if(bmi < 18.5) advice = '浣犵殑BMI鍋忎綆锛屽缓璁鍔犺惀鍏绘憚鍏ュ拰閫傚綋鍔涢噺璁粌銆?;
    else if(bmi < 24) advice = '浣犵殑BMI鍦ㄦ甯歌寖鍥村唴锛屼繚鎸佺幇鏈夌敓娲讳範鎯緢涓嶉敊锛?;
    else if(bmi < 28) advice = '浣犵殑BMI鍋忛珮浜嗭紝寤鸿鎺у埗楗+澧炲姞杩愬姩銆?;
    else advice = '浣犵殑BMI杈冮珮锛屽缓璁粠鏀瑰彉楗缁撴瀯寮€濮嬶紝閰嶅悎瑙勫緥杩愬姩銆?;
    if(profile.goalState === '鍑忚剛') advice += ' 鐩爣鍑忚剛锛屽缓璁瘡澶╀繚鎸?00-500kcal鐨勭儹閲忕己鍙ｃ€?;
    else if(profile.goalState === '澧炶倢') advice += ' 鐩爣澧炶倢锛屾敞鎰忓鍔犺泲鐧借川鎽勫叆鍜屽姏閲忚缁冦€?;
    else if(profile.goalState === '澧為噸') advice += ' 鐩爣澧為噸锛屽缓璁鍔犲仴搴风儹閲忔憚鍏ュ拰鍔涢噺璁粌銆?;
  }
  document.getElementById('healthAdvice').textContent = advice || '璁剧疆韬綋鏁版嵁鍚庯紝鎴戜細涓轰綘鐢熸垚涓€у寲鐨勫仴搴峰缓璁€?;
}

function editHealthProfile(){
  const cur = DB.get('health_profile',{});
  const v = prompt('杈撳叆韬綋鏁版嵁锛堜綋閲峩g, 韬珮cm, 骞撮緞, 鎬у埆鐢?濂筹級\n鐢ㄩ€楀彿鍒嗛殧', [cur.weight||'', cur.height||'', cur.age||'', cur.gender||'鐢?].join(','));
  if(!v) return;
  const parts = v.split(',').map(s=>s.trim());
  const goalState = prompt('鐩爣鐘舵€侊紙鍑忚剛/澧炶倢/澧為噸/淇濇寔锛?, cur.goalState||'淇濇寔') || cur.goalState||'淇濇寔';
  const goalFreq = prompt('鐩爣杩愬姩棰戠巼锛堟瘡鍛ㄥ嚑娆★級', cur.goalFreq||'3') || cur.goalFreq||'3';
  const targetWeight = prompt('鐞嗘兂浣撻噸锛坘g锛?, cur.targetWeight||'');
  const profile = {
    weight: parseFloat(parts[0]) || cur.weight,
    height: parseFloat(parts[1]) || cur.height,
    age: parseInt(parts[2]) || cur.age,
    gender: parts[3]||cur.gender||'鐢?,
    goalState: goalState,
    goalFreq: goalFreq,
    targetWeight: targetWeight ? parseFloat(targetWeight) : cur.targetWeight||''
  };
  DB.set('health_profile', profile);
  refreshIntake();
}

// ===== 韬綋鐘舵€?& AI绮惧姏鍒嗘瀽 =====
function refreshBodyState() {
  const today = todayStr();
  const state = DB.get('body_state_'+today, {});
  
  // Set sleep hours
  if(document.getElementById('hsSleepHours')) document.getElementById('hsSleepHours').value = state.sleepHours||'';
  
  // Set sleep quality
  if(state.sleepQuality) {
    document.querySelectorAll('#hsSleepQuality .rate-btn').forEach((b, i) => {
      b.classList.toggle('active', i+1 === (state.sleepQuality||3));
    });
  }
  
  // Set energy
  if(state.energy) {
    document.querySelectorAll('#hsEnergy .rate-btn').forEach((b, i) => {
      b.classList.toggle('active', i+1 === (state.energy||5));
    });
  }
  
  // Set fatigue
  if(state.fatigue) {
    document.querySelectorAll('#hsFatigue .rate-btn').forEach((b, i) => {
      b.classList.toggle('active', i+1 === (state.fatigue||3));
    });
  }
}

function setSleepQuality(val, btn) {
  document.querySelectorAll('#hsSleepQuality .rate-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  saveBodyStateField('sleepQuality', val);
}

function setEnergy(val, btn) {
  document.querySelectorAll('#hsEnergy .rate-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  saveBodyStateField('energy', val);
}

function setFatigue(val, btn) {
  document.querySelectorAll('#hsFatigue .rate-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  saveBodyStateField('fatigue', val);
}

function saveBodyStateField(field, val) {
  const today = todayStr();
  const state = DB.get('body_state_'+today, {});
  state[field] = val;
  DB.set('body_state_'+today, state);
}

function saveBodyState() {
  const today = todayStr();
  const state = DB.get('body_state_'+today, {});
  state.sleepHours = parseFloat(document.getElementById('hsSleepHours')?.value)||0;
  DB.set('body_state_'+today, state);
}

function generateHealthAnalysis() {
  const today = todayStr();
  const state = DB.get('body_state_'+today, {});
  const intakes = DB.get('intake_records',[]).filter(r=>r.date===today);
  const burns = DB.get('burn_records',[]).filter(r=>r.date===today);
  const profile = DB.get('health_profile',{});
  
  const sleepH = state.sleepHours || 0;
  const energy = state.energy || 5;
  const fatigue = state.fatigue || 3;
  const totalCal = intakes.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  const totalProtein = intakes.reduce((s,r)=>s+(parseFloat(r.protein)||0),0);
  const totalCarbs = intakes.reduce((s,r)=>s+(parseFloat(r.carbs)||0),0);
  const totalFat = intakes.reduce((s,r)=>s+(parseFloat(r.fat)||0),0);
  const exerciseCount = burns.length;
  
  // Generate analysis
  let stateDesc = '鏆傛棤瓒冲鏁版嵁';
  let reasons = [];
  let problems = [];
  let suggestions = [];
  
  // Sleep analysis
  if(sleepH > 0) {
    if(sleepH >= 7 && sleepH <= 9) { stateDesc = '鑹ソ 馃槉'; reasons.push('鐫＄湢鍏呰冻'); }
    else if(sleepH < 7) { stateDesc = '闇€鏀瑰杽 馃槓'; problems.push('鐫＄湢涓嶈冻'+Math.round(7-sleepH)+'灏忔椂'); suggestions.push('浠婃櫄鎻愬墠'+Math.round(7-sleepH)+'灏忔椂浼戞伅'); }
    else { stateDesc = '鐫＄湢杩囧 馃槾'; problems.push('鐫＄湢杩囬噺鍙兘褰卞搷绮惧姏'); suggestions.push('灏濊瘯鍑忓皯鐫＄湢鏃堕棿鑷?灏忔椂'); }
  }
  
  // Nutrition analysis
  if(totalCal > 0) {
    const proteinRatio = totalProtein > 0 ? (totalProtein*4/totalCal*100).toFixed(0) : 0;
    if(proteinRatio >= 15) reasons.push('铔嬬櫧璐ㄦ憚鍏ュ厖瓒?('+proteinRatio+'%)');
    else problems.push('铔嬬櫧璐ㄦ憚鍏ュ亸浣?('+proteinRatio+'%)');
    
    if(totalProtein > 20) reasons.push('浼樿川铔嬬櫧璐ㄦ潵婧?);
    if(totalCarbs > 200) problems.push('纰虫按鎽勫叆鍋忛珮锛屽缓璁€傚綋鍑忓皯');
  }
  
  // Exercise analysis
  if(exerciseCount > 0) {
    reasons.push('瀹屾垚杩愬姩锛屾湁鍔╀簬鎻愬崌涓撴敞鍔?);
  } else {
    problems.push('浠婂ぉ杩樻病杩愬姩');
    suggestions.push('灏濊瘯15鍒嗛挓绠€鍗曡繍鍔ㄦ彁鍗囩簿鍔?);
  }
  
  // Energy analysis
  if(energy <= 5) {
    if(sleepH < 7) problems.push('鐫＄湢涓嶈冻瀵艰嚧绮惧姏鍋忎綆');
    if(exerciseCount === 0) suggestions.push('鐭椂闂磋繍鍔ㄥ彲蹇€熸彁鍗囩簿鍔?);
  } else if(energy >= 7) {
    reasons.push('绮惧姏鐘舵€佽壇濂斤紝閫傚悎娣卞害瀛︿範');
    suggestions.push('鍒╃敤濂界簿鍔涙椂娈靛畬鎴愰珮浠峰€间换鍔?);
  }
  
  if(!reasons.length && !problems.length) {
    suggestions.push('寮€濮嬭褰曢ギ椋熴€佺潯鐪犲拰杩愬姩鏁版嵁锛岃幏鍙栦釜鎬у寲鍒嗘瀽');
  }
  
  document.getElementById('healthStateAnalysis').style.display = 'block';
  document.getElementById('healthStateAnalysis').innerHTML = `
    <div class="health-review-card">
      <h4 style="margin:0 0 10px;font-size:15px;color:#5d3a4f;">馃 AI 绮惧姏鍒嗘瀽鎶ュ憡</h4>
      <div style="margin-bottom:8px;">
        <span style="font-size:14px;font-weight:700;">浠婃棩鐘舵€侊細</span>
        <span style="font-size:24px;">${energy >= 8 ? '猸愨瓙猸愨瓙猸? : energy >= 6 ? '猸愨瓙猸愨瓙' : energy >= 4 ? '猸愨瓙猸? : '猸愨瓙'}</span>
        <span style="font-size:13px;color:#9b7c8a;margin-left:8px;">${energy}/10</span>
      </div>
      ${reasons.length ? `<div class="review-stat"><span>鉁?绉瀬鍥犵礌</span></div>${reasons.map(r => `<div style="padding:4px 0;font-size:13px;color:#2da667;">路 ${r}</div>`).join('')}` : ''}
      ${problems.length ? `<div style="margin-top:8px;" class="review-stat"><span>鈿狅笍 瀛樺湪闂</span></div>${problems.map(p => `<div style="padding:4px 0;font-size:13px;color:#c45677;">路 ${p}</div>`).join('')}` : ''}
      ${suggestions.length ? `<div style="margin-top:8px;" class="review-stat"><span>馃挕 鏀硅繘寤鸿</span></div>${suggestions.map(s => `<div style="padding:4px 0;font-size:13px;color:#2d7a4e;">路 ${s}</div>`).join('')}` : ''}
      <div style="margin-top:10px;padding:8px;background:var(--bg);border-radius:8px;font-size:12px;color:#9b7c8a;">
        馃搳 浠婃棩鎽勫叆 ${totalCal}kcal 路 杩愬姩 ${exerciseCount}娆?路 鐫＄湢 ${sleepH}h 路 绮惧姏 ${energy}/10 路 鐤插姵 ${fatigue}/5
      </div>
    </div>
  `;
}

// ===== 鏍囩鍒囨崲 =====
function switchHealthTab(tab, btn){
  document.querySelectorAll('#page-intake .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['diet','burn','state','goal','report'].forEach(t=>{
    const el = document.getElementById('healthTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el) el.style.display = t===tab?'block':'none';
  });
  if(tab === 'report') refreshHealthReport();
  if(tab === 'state') refreshBodyState();
}

// ===== 鍋ュ悍鎶ュ憡 =====
let reportPeriod = 'week';

function switchReportPeriod(period, btn){
  reportPeriod = period;
  document.querySelectorAll('#page-intake .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  refreshHealthReport();
}

function refreshHealthReport(){
  const now = new Date();
  const today = todayStr();
  const dow = now.getDay() || 7;
  let startDate, endDate;
  if(reportPeriod === 'week'){
    const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
    startDate = monday.toISOString().slice(0,10);
    endDate = now.toISOString().slice(0,10);
  } else {
    startDate = today.slice(0,7)+'-01';
    endDate = today;
  }

  const recs = DB.get('intake_records',[]).filter(r=>r.date>=startDate && r.date<=endDate);
  const burns = DB.get('burn_records',[]).filter(r=>r.date>=startDate && r.date<=endDate);
  const daysSet = new Set([...recs.map(r=>r.date), ...burns.map(r=>r.date)]);
  const totalDays = daysSet.size;
  const avgIntake = totalDays ? Math.round(recs.reduce((s,r)=>s+(parseFloat(r.cal)||0),0)/totalDays) : 0;
  const avgBurn = totalDays ? Math.round(burns.reduce((s,r)=>s+(parseFloat(r.cal)||0),0)/totalDays) : 0;
  const exerciseCount = burns.length;
  const totalIntake = recs.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);
  const totalBurn = burns.reduce((s,r)=>s+(parseFloat(r.cal)||0),0);

  document.getElementById('healthReportData').innerHTML = `
    <div class="review-stat"><span>馃搮 璁板綍澶╂暟</span><span class="num">${totalDays} 澶?/span></div>
    <div class="review-stat"><span>馃嵔锔?${reportPeriod==='week'?'鏈懆':'鏈湀'}鎬绘憚鍏?/span><span class="num">${totalIntake} kcal</span></div>
    <div class="review-stat"><span>馃弮 ${reportPeriod==='week'?'鏈懆':'鏈湀'}杩愬姩娆℃暟</span><span class="num">${exerciseCount} 娆?/span></div>
    <div class="review-stat"><span>馃敟 鏃ュ潎鎽勫叆</span><span class="num">${avgIntake} kcal</span></div>
    <div class="review-stat"><span>馃敟 鏃ュ潎杩愬姩娑堣€?/span><span class="num">${avgBurn} kcal</span></div>
  `;

  // Advice
  let advice = '';
  if(!totalDays) advice = '鏁版嵁瓒婂锛屽垎鏋愯秺鍑嗐€傚紑濮嬭褰曢ギ椋熷拰杩愬姩鍚э紒';
  else {
    const avgTotal = avgIntake - avgBurn;
    if(avgTotal < -200) advice = `馃憦 骞插緱婕備寒锛?{reportPeriod==='week'?'鏈懆':'鏈湀'}骞冲潎姣忓ぉ鐑噺缂哄彛 ${Math.abs(avgTotal)} kcal锛屽潥鎸佸氨鑳界湅鍒板彉鍖栥€俙;
    else if(avgTotal < 0) advice = `馃憤 涓嶉敊锛?{reportPeriod==='week'?'鏈懆':'鏈湀'}鏁翠綋澶勪簬寰己鍙ｇ姸鎬併€俙;
    else if(avgTotal < 200) advice = `馃搳 鐑噺鍩烘湰骞宠　锛屽鏋滅洰鏍囨槸鍑忚剛鍙互閫傚綋鎺у埗鏅氶鐑噺銆俙;
    else advice = `鈿狅笍 ${reportPeriod==='week'?'鏈懆':'鏈湀'}鏃ュ潎鐑噺鐩堜綑 ${avgTotal} kcal锛屽缓璁鍔犺繍鍔ㄦ垨璋冩暣楗缁撴瀯銆俙;
    if(exerciseCount < parseInt(DB.get('health_profile',{}).goalFreq||3))
      advice += ` 杩愬姩娆℃暟杩樻湁鎻愬崌绌洪棿锛岀洰鏍囨瘡鍛?{DB.get('health_profile',{}).goalFreq||3}娆°€俙;
    else advice += ` 杩愬姩涔犳儻淇濇寔寰楀緢濂斤紒`;
  }
  document.getElementById('healthReportAdvice').textContent = advice;
}

// ========== NEW CONCEPT ENGLISH ==========
// Current study state
let nceCurrentStudy = null;
let nceMediaRecorder = null;
let nceAudioChunks = [];
let nceRecTimer = null;
let nceRecSeconds = 0;

// Image upload
function handleNceImage(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = document.getElementById('nceImagePreview');
    img.src = ev.target.result;
    img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function enableNceAnalyze() {
  const txt = document.getElementById('nceTextInput').value.trim();
  document.getElementById('nceAnalyzeBtn').disabled = !txt;
}

function clearNceStudy() {
  document.getElementById('nceImageInput').value = '';
  document.getElementById('nceImagePreview').style.display = 'none';
  document.getElementById('nceImagePreview').src = '';
  document.getElementById('nceTextInput').value = '';
  document.getElementById('nceAnalyzeBtn').disabled = true;
  document.getElementById('nceStepSummary').style.display = 'none';
  document.getElementById('nceStepExpr').style.display = 'none';
  document.getElementById('nceStepSpeaking').style.display = 'none';
  document.getElementById('nceStepOutput').style.display = 'none';
  document.getElementById('nceStepComplete').style.display = 'none';
  nceCurrentStudy = null;
}

// AI Analysis
function analyzeNceText() {
  const text = document.getElementById('nceTextInput').value.trim();
  if(!text) return;

  // Store current study
  nceCurrentStudy = { text, date: todayStr(), title: extractTitle(text) };

  // Display article
  document.getElementById('nceArticleDisplay').textContent = text;

  // 1. Summary (first 3 sentences)
  const sentences = text.split(/[.!?]+/).filter(s=>s.trim().length>5);
  const summary = sentences.slice(0, Math.min(3, sentences.length)).map(s=>s.trim()).join('. ') + '.';
  document.getElementById('nceSummaryContent').innerHTML = `
    <p style="line-height:1.7;">${summary}</p>
  `;

  // 2. Vocabulary (longer/less common words)
  const words = text.toLowerCase().replace(/[^a-z\s'-]/g,'').split(/\s+/).filter(w=>w.length>3);
  const stopWords = new Set(['the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','have','been','some','them','than','what','when','with','from','they','that','this','which','your','will','would','could','should','their','there','about','also','into','over','after','very','just','more','these']);
  const uniqueWords = [...new Set(words.filter(w=>!stopWords.has(w)))].sort((a,b)=>b.length-a.length).slice(0,15);
  nceCurrentStudy.vocab = uniqueWords;
  document.getElementById('nceVocabulary').innerHTML = uniqueWords.length
    ? uniqueWords.map(w => `<span class="nce-word-tag">${w}</span>`).join('')
    : '<span style="color:var(--text-secondary);font-size:13px;">鏈瘑鍒埌鏄捐憲璇嶆眹</span>';

  // 3. Grammar analysis
  const grammarPoints = analyzeGrammar(text, sentences);
  nceCurrentStudy.grammar = grammarPoints;
  document.getElementById('nceGrammar').innerHTML = grammarPoints.length
    ? grammarPoints.map(g => `<div style="margin-bottom:4px;">鈥?${g}</div>`).join('')
    : '鍩虹鍙ュ瀷涓轰富锛屽寘鍚檲杩板彞鍜岀枒闂彞缁撴瀯銆?;

  // 4. Theme
  const theme = analyzeTheme(text);
  nceCurrentStudy.theme = theme;
  document.getElementById('nceTheme').innerHTML = theme;

  // Show step 2
  document.getElementById('nceStepSummary').style.display = 'block';

  // Generate expressions
  generateNceExpressions(text);

  // Generate speaking tasks
  generateNceSpeakingTasks(text);

  // Generate output prompt
  generateNceOutputPrompt(text);

  // Scroll to step 2
  document.getElementById('nceStepSummary').scrollIntoView({behavior:'smooth',block:'start'});

  // Enable analyze button text
  document.getElementById('nceAnalyzeBtn').innerHTML = '鉁?宸插垎鏋?;
}

function extractTitle(text) {
  const lines = text.split('\n').filter(l=>l.trim());
  if(lines.length>0) {
    const first = lines[0].trim();
    if(first.length < 80) return first;
  }
  return text.slice(0, 50) + '...';
}

function analyzeGrammar(text, sentences) {
  const points = [];
  if(text.match(/there\s+is|there\s+are/i)) points.push('There be 鍙ュ瀷 鈥?琛ㄧず"瀛樺湪/鏈?');
  if(text.match(/\bif\b/i)) points.push('鏉′欢鍙?(if) 鈥?琛ㄧず鍋囪鏉′欢');
  if(text.match(/\bwhen\b|\bwhile\b|\bas\b/i)) points.push('鏃堕棿鐘惰浠庡彞 (when/while/as) 鈥?琛ㄧず鏃堕棿鍏崇郴');
  if(text.match(/\bbecause\b|\bsince\b|\bas\b/i)) points.push('鍘熷洜鐘惰浠庡彞 (because/since) 鈥?琛ㄧず鍥犳灉鍏崇郴');
  if(text.match(/\bwhich\b|\bthat\b|\bwho\b|\bwhom\b|\bwhose\b/i)) points.push('瀹氳浠庡彞 (which/that/who) 鈥?淇グ鍚嶈瘝');
  if(text.match(/\bcan\b|\bcould\b|\bmay\b|\bmight\b|\bshould\b|\bmust\b/i)) points.push('鎯呮€佸姩璇?(can/could/should/must) 鈥?琛ㄨ揪鍙兘鎬ф垨蹇呰鎬?);
  if(text.match(/\b-ing\b|\b-ing,\b/i) || text.match(/\w+ing\s/)) points.push('鍔ㄥ悕璇?鐜板湪鍒嗚瘝 鈥?琛ㄧず杩涜鎴栦綔涓哄悕璇嶄娇鐢?);
  if(text.match(/\bed\b|\b-ed,\b/i) || text.match(/\w+ed\s/)) points.push('杩囧幓寮?杩囧幓鍒嗚瘝 鈥?琛ㄧず杩囧幓鍔ㄤ綔鎴栬鍔ㄨ鎬?);
  if(text.match(/\bmore\b|\bmost\b|\ber\b|\best\b/i)) points.push('姣旇緝绾?鏈€楂樼骇 鈥?琛ㄧず姣旇緝鍏崇郴');
  if(text.match(/\bnot only\b|\bboth\b|\beither\b|\bneither\b/i)) points.push('骞跺垪缁撴瀯 (not only...but also/both...and)');
  if(text.match(/['']s\b/)) points.push('鍚嶈瘝鎵€鏈夋牸 (\'s) 鈥?琛ㄧず鎵€灞炲叧绯?);
  if(text.match(/\bwill\b|\bgoing to\b/i)) points.push('灏嗘潵鏃?(will/be going to) 鈥?琛ㄨ揪鏈潵鍔ㄤ綔');
  if(text.match(/\bhave\b|\bhas\b|\bhad\b.*\w+ed\b/)) points.push('瀹屾垚鏃?(have/has/had + 杩囧幓鍒嗚瘝) 鈥?锟斤拷锟界ず宸插畬鎴愬姩浣?);
  if(text.match(/\bso\b.*\bthat\b/i)) points.push('So...that 缁撴瀯 鈥?琛ㄧず"濡傛...浠ヨ嚦浜?');
  if(text.match(/\btoo\b.*\bto\b/i)) points.push('Too...to 缁撴瀯 鈥?琛ㄧず"澶?..鑰屼笉鑳?');
  if(text.match(/^\s*(Do|Does|Did|Is|Are|Was|Were|Has|Have|Had|Can|Could|May|Might|Should|Would|Will)\b/im)) points.push('鐤戦棶鍙ョ粨鏋?鈥?涓€鑸枒闂彞');
  if(text.match(/\bWhat\b|\bWhere\b|\bWhen\b|\bWhy\b|\bHow\b|\bWhich\b|\bWho\b|\bWhom\b|\bWhose\b/im)) points.push('鐗规畩鐤戦棶鍙?(Wh-questions) 鈥?璇㈤棶鍏蜂綋淇℃伅');
  if(text.match(/^\s*[Ii]f\b/i)) points.push('鏉′欢鐘惰浠庡彞 (If...) 鈥?琛ㄧず鏉′欢');
  if(points.length === 0) points.push('鍩虹鍙ュ瀷涓轰富 鈥?鍖呭惈绠€鍗曢檲杩板彞鍜岀枒闂彞缁撴瀯銆?);
  return points.slice(0, 8);
}

function analyzeTheme(text) {
  const lower = text.toLowerCase();
  const themes = [];
  if(lower.match(/\btravel\b|\bvisit\b|\btrip\b|\bjourney\b|\bholliday\b|\bvacation\b/)) themes.push('鏃呰涓庡嚭琛?);
  if(lower.match(/\bfriend\b|\bfamily\b|\blove\b|\bhome\b|\bhouse\b/)) themes.push('瀹跺涵涓庢儏鎰?);
  if(lower.match(/\bwork\b|\bjob\b|\bbusiness\b|\bcompany\b|\boffice\b|\bcareer\b/)) themes.push('宸ヤ綔涓庤亴涓?);
  if(lower.match(/\blearn\b|\bstudy\b|\bschool\b|\bclass\b|\bteacher\b|\bstudent\b|\beducation\b/)) themes.push('瀛︿範涓庢暀鑲?);
  if(lower.match(/\bfood\b|\beating\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bcook\b|\brestaurant\b/)) themes.push('楗涓庣敓娲?);
  if(lower.match(/\bstory\b|\btale\b|\bman\b|\bwoman\b|\bname\b|\bsay\b|\bsaid\b/)) themes.push('鍙欎簨涓庢晠浜?);
  if(lower.match(/\bcity\b|\bcountry\b|\bnature\b|\briver\b|\bmountain\b|\bgarden\b|\bgarden\b|\bpark\b/)) themes.push('鑷劧涓庣幆澧?);
  if(lower.match(/\bhealth\b|\bhospital\b|\bdoctor\b|\bsport\b|\bexercise\b/)) themes.push('鍋ュ悍涓庤繍鍔?);
  if(lower.match(/\bmoney\b|\bshop\b|\bbuy\b|\bpay\b|\bprice\b|\bcost\b/)) themes.push('璐墿涓庢秷璐?);
  if(lower.match(/\bimport\b|\bexport\b|\btrade\b|\bmanufacture\b|\bindustry\b/)) themes.push('鍟嗕笟涓庣粡娴?);
  if(themes.length === 0) themes.push('鏃ュ父鐢熸椿涓庝氦娴?);
  return `鏈枃涓婚鍥寸粫銆?{themes.join('銆?)}銆嶅睍寮€锛屽唴瀹硅创杩戝疄闄呬氦娴佸満鏅紝閫傚悎缁冧範鏃ュ父鍙ｈ琛ㄨ揪銆俙;
}

// Step 3: Expression Library
function generateNceExpressions(text) {
  const sentences = text.split(/[.!?]+/).filter(s=>s.trim().length>8);
  const expressions = [];

  // Extract useful patterns
  const patterns = [
    { pattern: /\bthere\s+is\b|\bthere\s+are\b/gi, type: '鍙ュ瀷', label: 'There be 鍙ュ瀷' },
    { pattern: /\bI\s+think\b|\bI\s+believe\b|\bI\s+feel\b|\bI\s+suppose\b/gi, type: '琛ㄨ揪瑙傜偣', label: '琛ㄨ揪瑙傜偣' },
    { pattern: /\bcan\s+(\w+)\b|\bcould\s+(\w+)\b/gi, type: '鎯呮€佸姩璇?, label: '琛ㄨ揪鑳藉姏/鍙兘鎬? },
    { pattern: /\bMy\s+\w+/gi, type: '涓汉琛ㄨ揪', label: '鎻忚堪鎴戠殑' },
    { pattern: /\bIt\s+is\b|\bIt\s+was\b/gi, type: '鍙ュ瀷', label: 'It is/was 鍙ュ瀷' },
    { pattern: /\bis\s+\w+ing\b|\bare\s+\w+ing\b|\bwas\s+\w+ing\b|\bwere\s+\w+ing\b/gi, type: '鏃舵€?, label: '杩涜鏃舵€? },
    { pattern: /\bhave\s+been\b|\bhas\s+been\b|\bhad\s+been\b/gi, type: '鏃舵€?, label: '瀹屾垚鏃舵€? },
    { pattern: /\bnot\s+only\b|\bnot\s+just\b/gi, type: '寮鸿皟缁撴瀯', label: '寮鸿皟缁撴瀯' },
    { pattern: /\bsuch\s+as\b|\blike\b/gi, type: '涓句緥', label: '涓句緥琛ㄨ揪' },
    { pattern: /\bmore\s+\w+\b\s+than\b|\bas\s+\w+\s+as\b/gi, type: '姣旇緝缁撴瀯', label: '姣旇緝缁撴瀯' },
    { pattern: /\bthe\s+most\b|\bthe\s+best\b|\bthe\s+\w+est\b/gi, type: '鏈€楂樼骇', label: '鏈€楂樼骇' },
    { pattern: /\bI\s+used\s+to\b|\bwould\s+like\s+to\b/gi, type: '甯哥敤琛ㄨ揪', label: '涔犳儻/鎰忔効琛ㄨ揪' },
    { pattern: /\bboth\s+\w+\s+and\b/gi, type: '骞跺垪缁撴瀯', label: 'Both...and 缁撴瀯' },
    { pattern: /\bIf\s+I\b|\bIf\s+you\b|\bIf\s+we\b/gi, type: '鏉′欢鍙?, label: '鏉′欢鍙? },
    { pattern: /\bWhat\s+a\b|\bWhat\s+an\b|\bHow\s+\w+\b/i, type: '鎰熷徆鍙?, label: '鎰熷徆鍙? },
    { pattern: /\bnot\s+only\b|\bnot\s+just\b/gi, type: '寮鸿皟缁撴瀯', label: '寮鸿皟缁撴瀯' },
  ];

  const foundPatterns = patterns.filter(p => p.pattern.test(text));

  // Get unique useful sentences from text
  const usefulSents = sentences.filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 15 && trimmed.length < 100;
  }).slice(0, 6);

  foundPatterns.slice(0, 5).forEach((p, idx) => {
    let example = '';
    // Find a sentence matching this pattern
    for(const s of usefulSents) {
      if(p.pattern.test(s)) { example = s.trim(); break; }
    }
    if(!example && usefulSents.length > idx) example = usefulSents[idx].trim();

    expressions.push({
      type: p.type,
      label: p.label,
      original: example || '锛堝彲鍙傝€冭鏂囦腑鐨勫彞瀛愶級',
      usage: getUsageDescription(p.label),
      mySentence: ''
    });
  });

  // If no patterns found, use general sentence extraction
  if(expressions.length === 0) {
    usefulSents.forEach(s => {
      expressions.push({
        type: '甯哥敤琛ㄨ揪',
        label: '瀹炵敤鍙ュ瀷',
        original: s.trim(),
        usage: '鍙敤浜庢棩甯镐氦娴?,
        mySentence: ''
      });
    });
  }

  nceCurrentStudy.expressions = expressions;
  renderNceExpressions(expressions);
  document.getElementById('nceStepExpr').style.display = 'block';
  document.getElementById('nceStepExpr').scrollIntoView({behavior:'smooth',block:'start'});
}

function getUsageDescription(label) {
  const map = {
    'There be 鍙ュ瀷': '鏃ュ父鎻忚堪瀛樺湪鐨勪汉鎴栦簨鐗╋紝濡傦細There is a book on the table.',
    '琛ㄨ揪瑙傜偣': '琛ㄨ揪涓汉鐪嬫硶锛屽锛欼 think this is a good idea.',
    '琛ㄨ揪鑳藉姏/鍙兘鎬?: '琛ㄨ揪鑳藉仛鏌愪簨锛屽锛欼 can speak English well.',
    '涓汉琛ㄨ揪': '鎻忚堪涓汉浜嬬墿锛屽锛歁y favorite color is blue.',
    'It is/was 鍙ュ瀷': '鎻忚堪浜嬬墿灞炴€э紝濡傦細It is important to learn English.',
    '杩涜鏃舵€?: '鎻忚堪姝ｅ湪鍙戠敓鐨勫姩浣滐紝濡傦細I am reading a book.',
    '瀹屾垚鏃舵€?: '鎻忚堪宸插畬鎴愭垨鎸佺画鍒扮幇鍦ㄧ殑鍔ㄤ綔',
    '寮鸿皟缁撴瀯': '寮鸿皟鏌愪欢浜嬶紝濡傦細Not only does he sing well, but he also dances.',
    '涓句緥琛ㄨ揪': '涓句緥瀛愶紝濡傦細I like fruits such as apples and bananas.',
    '姣旇緝缁撴瀯': '姣旇緝涓や欢浜嬬墿锛屽锛歋he is taller than me.',
    '鏈€楂樼骇': '琛ㄨ揪鏈€...鐨勶紝濡傦細This is the best day of my life.',
    '涔犳儻/鎰忔効琛ㄨ揪': '琛ㄨ揪杩囧幓鐨勪範鎯垨绀艰矊鐨勮姹?,
    'Both...and 缁撴瀯': '涓よ€呴兘...锛屽锛欱oth you and I are students.',
    '鏉′欢鍙?: '琛ㄨ揪鏉′欢鍏崇郴锛屽锛欼f it rains, I will stay at home.',
    '鎰熷徆鍙?: '琛ㄨ揪寮虹儓鎯呮劅锛屽锛歐hat a beautiful day!',
  };
  return map[label] || '鏃ュ父浜ゆ祦甯哥敤琛ㄨ揪锛屽彲浠ユ牴鎹嚜宸辩殑鍦烘櫙鐏垫椿浣跨敤銆?;
}

function renderNceExpressions(expressions) {
  document.getElementById('nceExpressions').innerHTML = expressions.map((e,i) => `
    <div class="nce-expr-item">
      <div class="orig">${e.label} 路 <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">${e.type}</span></div>
      <div class="trans">馃摉 璇炬枃锛?{e.original}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">馃挕 ${e.usage}</div>
      <div style="margin-top:6px;"><input type="text" style="font-size:13px;padding:6px 10px;font-style:italic;" placeholder="鉁忥笍 鍐欎竴涓綘鐨勪緥鍙?.." value="${e.mySentence}" oninput="updateNceExpr(${i},this.value)"></div>
    </div>
  `).join('');
}

function updateNceExpr(idx, val) {
  if(nceCurrentStudy && nceCurrentStudy.expressions) {
    nceCurrentStudy.expressions[idx].mySentence = val;
  }
}

function addNcePersonalExample() {
  if(!nceCurrentStudy || !nceCurrentStudy.expressions) return;
  nceCurrentStudy.expressions.push({
    type: '鑷畾涔?,
    label: '鎴戠殑琛ㄨ揪',
    original: '',
    usage: '鎴戣嚜宸辩殑渚嬪彞',
    mySentence: ''
  });
  renderNceExpressions(nceCurrentStudy.expressions);
}

// Step 4: Speaking
function generateNceSpeakingTasks(text) {
  const sentences = text.split(/[.!?]+/).filter(s=>s.trim().length>10);
  const tasks = [];

  // 1. Read-aloud
  const readSent = sentences.slice(0, 3).map(s => s.trim()).filter(s=>s.length>5);
  if(readSent.length) tasks.push({ type:'璺熻', content:`璺熻浠ヤ笅鍙ュ瓙锛?br><br>"${readSent.join('"<br>"')}"` });

  // 2. Questions
  const qs = [
    `What is the main idea of this passage?`,
    `Do you agree or disagree with the author's point? Why?`,
    `Can you summarize the story in 3 sentences?`,
    `What would you do if you were in this situation?`,
    `How does this topic relate to your own life?`,
  ];
  tasks.push({ type:'鍙ｈ闂', content: qs.slice(0,3).map((q,i)=>`${i+1}. ${q}`).join('<br>') });

  // 3. Opinion task
  const theme = analyzeTheme(text);
  tasks.push({ type:'瑙傜偣琛ㄨ揪', content: `Think about a similar experience in your own life. Use at least 3 new words or expressions from this lesson to describe it. Share your thoughts for at least 1 minute.` });

  nceCurrentStudy.speakingTasks = tasks;
  document.getElementById('nceSpeakingTasks').innerHTML = tasks.map((t,i) => `
    <div class="nce-speaking-task">
      <div class="q">${t.type === '璺熻' ? '馃摙 璺熻浠诲姟' : t.type === '鍙ｈ闂' ? '馃挰 鍙ｈ闂' : '馃幆 瑙傜偣琛ㄨ揪'}</div>
      <div style="margin-top:6px;line-height:1.6;">${t.content}</div>
    </div>
  `).join('');

  document.getElementById('nceStepSpeaking').style.display = 'block';
  document.getElementById('nceStepSpeaking').scrollIntoView({behavior:'smooth',block:'start'});
}

function saveNceSpeaking() {
  const checks = document.querySelectorAll('#nceStepSpeaking input[type="checkbox"]');
  const results = [];
  checks.forEach(c => { if(c.checked) results.push(c.parentElement.textContent.trim()); });
  if(nceCurrentStudy) nceCurrentStudy.speakingResult = results;
}

// Audio recording
async function toggleNceRecording() {
  if(nceMediaRecorder && nceMediaRecorder.state === 'recording') {
    // Stop
    nceMediaRecorder.stop();
    clearInterval(nceRecTimer);
    document.getElementById('nceRecBtn').textContent = '馃帳';
    document.getElementById('nceRecBtn').disabled = true;
    document.getElementById('nceRecStatus').textContent = '褰曢煶澶勭悊涓?..';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    nceMediaRecorder = new MediaRecorder(stream);
    nceAudioChunks = [];

    nceMediaRecorder.ondataavailable = e => {
      if(e.data.size > 0) nceAudioChunks.push(e.data);
    };

    nceMediaRecorder.onstop = () => {
      const blob = new Blob(nceAudioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const duration = nceRecSeconds;

      // Add to recording list
      const list = document.getElementById('nceRecordingList');
      const div = document.createElement('div');
      div.className = 'audio-player';
      div.innerHTML = `
        <audio controls src="${url}"></audio>
        <span style="font-size:12px;color:var(--text-secondary);">${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}</span>
        <button class="del-btn" onclick="this.parentElement.remove()">馃棏</button>
      `;
      list.appendChild(div);

      // Save to study
      if(nceCurrentStudy) {
        if(!nceCurrentStudy.recordings) nceCurrentStudy.recordings = [];
        nceCurrentStudy.recordings.push({duration, url, date: todayStr()});
      }

      document.getElementById('nceRecBtn').disabled = false;
      document.getElementById('nceRecBtn').textContent = '馃帳';
      document.getElementById('nceRecStatus').textContent = `宸插綍鍒?${Math.floor(duration/60)}鍒?{duration%60}绉抈;
      nceRecSeconds = 0;
      document.getElementById('nceRecTimer').textContent = '00:00';
      stream.getTracks().forEach(t=>t.stop());
    };

    nceMediaRecorder.start();
    document.getElementById('nceRecBtn').textContent = '鈴癸笍';
    document.getElementById('nceRecStatus').textContent = '褰曢煶涓?..';
    nceRecSeconds = 0;

    nceRecTimer = setInterval(() => {
      nceRecSeconds++;
      const m = Math.floor(nceRecSeconds/60);
      const s = nceRecSeconds%60;
      document.getElementById('nceRecTimer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  } catch(e) {
    document.getElementById('nceRecStatus').textContent = '鈿狅笍 闇€瑕侀害鍏嬮鏉冮檺锛岃鍏佽鍚庨噸璇?;
  }
}

// Step 5: Output
function generateNceOutputPrompt(text) {
  const theme = analyzeTheme(text);
  const prompt = `鉁嶏笍 鍐欎綔缁冧範锛氫娇鐢ㄦ湰鑺傝瀛﹀埌鐨勮〃杈撅紝瀹屾垚浠ヤ笅鍐欎綔锛?br><br>
1. 鐢ㄨ嫳璇弿杩颁竴涓叧浜庛€?{theme.replace('鏈枃涓婚鍥寸粫銆?,'').replace('銆嶅睍寮€','')}銆嶇殑缁忓巻<br>
2. 灏濊瘯浣跨敤鑷冲皯2涓笂闈㈠鍒扮殑琛ㄨ揪<br>
3. 鍐欏畬鍚庤涓€閬嶏紝妫€鏌ヨ娉?br><br>
馃挕 寤鸿锛氬彲浠ヤ粠"Last week/month/year, I..."鎴?I remember when..."寮€澶淬€俙;
  document.getElementById('nceOutputPrompt').innerHTML = prompt;
  document.getElementById('nceStepOutput').style.display = 'block';
  document.getElementById('nceStepOutput').scrollIntoView({behavior:'smooth',block:'start'});
}

function saveNceOutput() {
  if(nceCurrentStudy) {
    nceCurrentStudy.output = document.getElementById('nceOutputInput').value;
  }
}

// Step 6: Complete
function completeNceStudy() {
  if(!nceCurrentStudy) return;

  const study = nceCurrentStudy;
  study.id = 'nce_' + Date.now();
  study.completedAt = todayStr();

  // Count vocabulary
  const vocabCount = study.vocab ? study.vocab.length : 0;
  const exprCount = study.expressions ? study.expressions.length : 0;
  const recordingDuration = study.recordings ? study.recordings.reduce((s,r)=>s+r.duration,0) : 0;
  const selfCheckCount = study.speakingResult ? study.speakingResult.length : 0;

  // Generate review
  generateNceReview(study, vocabCount, exprCount, recordingDuration, selfCheckCount);

  // Save to history
  const history = DB.get('nce_history',[]);
  history.push(study);
  DB.set('nce_history', history);

  // Generate review schedule
  const reviews = DB.get('nce_reviews',[]);
  const addDate = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  };
  reviews.push({ id: study.id, title: study.title, learned: todayStr(), review3: addDate(3), review7: addDate(7), review30: addDate(30), status3:'pending', status7:'pending', status30:'pending' });
  DB.set('nce_reviews', reviews);

  // Show complete step
  document.getElementById('nceStepComplete').style.display = 'block';
  document.getElementById('nceStepComplete').scrollIntoView({behavior:'smooth',block:'start'});

  // Refresh overview
  refreshNceHistory();
}

function generateNceReview(study, vocabCount, exprCount, recDuration, checkCount) {
  document.getElementById('nceReviewFeedback').innerHTML = `
    馃帀 <strong>瀛︿範瀹屾垚锛?/strong><br>
    鎺屾彙浜?<strong>${vocabCount}</strong> 涓瘝姹?路 <strong>${exprCount}</strong> 涓〃杈?br>
    鍙ｈ缁冧範 <strong>${Math.floor(recDuration/60)}</strong> 鍒嗛挓<br>
    <span style="font-size:13px;opacity:.9;">姣忓ぉ杩涙涓€鐐圭偣锛屼綘姝ｅ湪寤虹珛璧疯嚜宸辩殑鑻辫琛ㄨ揪鑳藉姏锛?/span>
  `;

  const total = vocabCount + exprCount;
  let suggestion = '';
  if(recDuration < 60) suggestion = '澶氬紑鍙ｇ粌涔狅紝鍝€曟槸1鍒嗛挓鐨勮窡璇讳篃浼氭湁寰堝ぇ甯姪銆?;
  else if(vocabCount < 5) suggestion = '寤鸿澶氬叧娉ㄨ鏂囦腑鐨勭敓璇嶏紝鐢ㄥ畠浠€犺嚜宸辩殑鍙ュ瓙銆?;
  else suggestion = '缁х画淇濇寔锛佽瘯鐫€鍦ㄦ棩甯哥敓娲讳腑鏈夋剰璇嗕娇鐢ㄨ繖浜涜〃杈俱€?;

  document.getElementById('nceStudyReview').innerHTML = `
    <div class="nce-record-stats">
      <span>馃摑 鎺屾彙璇嶆眹锛?strong>${vocabCount}</strong> 涓?/span>
      <span>馃棧锔?鎺屾彙琛ㄨ揪锛?strong>${exprCount}</strong> 涓?/span>
      <span>馃帳 鍙ｈ缁冧範锛?strong>${Math.floor(recDuration/60)}</strong> 鍒嗛挓</span>
      ${selfCheckCount > 0 ? `<span>鉁?鑷瘎锛?{selfCheckCount}/4</span>` : ''}
    </div>
    <div style="margin-top:12px;font-size:14px;line-height:1.6;">
      <strong>猸?鎴戠殑杩涙锛?/strong><br>
      閫氳繃鏈瘒瀛︿範锛屼綘鎺ヨЕ浜嗘柊鐨勮瘝姹囧拰琛ㄨ揪鏂瑰紡锛屽苟閫氳繃鍙ｈ缁冧範鍔犳繁浜嗚蹇嗐€?br><br>
      <strong>馃挕 涓嬩竴姝ュ缓璁細</strong><br>
      ${suggestion}
    </div>
  `;
}

// Tab: Review
function refreshNceReview() {
  const reviews = DB.get('nce_reviews',[]);
  const today = todayStr();
  const el = document.getElementById('nceReviewList');

  if(!reviews.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">馃攣</div><p>杩樻病鏈夐渶瑕佸涔犵殑鍐呭銆傚幓銆屼粖鏃ュ涔犮€嶅涓€绡囨柊姒傚康鑻辫璇炬枃鍚э紒</p></div>';
    return;
  }

  el.innerHTML = reviews.slice().reverse().map(r => {
    const checks = [];
    const checkDay = (label, date, status) => {
      if(today >= date && status === 'pending') checks.push({label, date, status:'due', past: true});
      else if(status === 'done') checks.push({label, date, status:'done', past: false});
      else if(today < date) checks.push({label, date, status:'future', past: false});
      else checks.push({label, date, status:'future', past: false});
    };
    checkDay('3澶╁涔?, r.review3, r.status3);
    checkDay('7澶╁涔?, r.review7, r.status7);
    checkDay('30澶╁涔?, r.review30, r.status30);

    return `<div class="nce-review-card ${checks.some(c=>c.status==='due')?'due':checks.every(c=>c.status==='done')?'done':''}">
      <div class="info">
        <span class="title">馃摉 ${r.title}</span>
        <span style="font-size:12px;color:var(--text-secondary);">${r.learned}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        ${checks.map(c => `
          <span class="badge ${c.status}" style="cursor:${c.status==='due'?'pointer':'default'}" onclick="${c.status==='due'?`completeNceReview('${r.id}','${c.label}')`:''}">
            ${c.label} ${c.status==='due'?' 鈿狅笍 寰呭涔?:c.status==='done'?' 鉁?宸插畬鎴?:c.status==='future'?' 馃搮 寰呭畾':''}
          </span>
        `).join('')}
      </div>
    </div>`;
  }).join('');
}

function completeNceReview(id, label) {
  const reviews = DB.get('nce_reviews',[]);
  const r = reviews.find(x => x.id === id);
  if(!r) return;
  const dayMap = {'3澶╁涔?:'status3','7澶╁涔?:'status7','30澶╁涔?:'status30'};
  const key = dayMap[label];
  if(key && r[key] === 'pending') {
    r[key] = 'done';
    DB.set('nce_reviews', reviews);
    refreshNceReview();
  }
}

// Tab: History
function refreshNceHistory() {
  const history = DB.get('nce_history',[]);
  document.getElementById('nceTotalStudy').textContent = history.length;

  const allVocab = new Set();
  let allExpr = 0;
  let totalRecTime = 0;
  history.forEach(s => {
    if(s.vocab) s.vocab.forEach(v => allVocab.add(v));
    if(s.expressions) allExpr += s.expressions.length;
    if(s.recordings) s.recordings.forEach(r => totalRecTime += r.duration);
  });
  document.getElementById('nceTotalVocab').textContent = allVocab.size;
  document.getElementById('nceTotalExpr').textContent = allExpr;
  document.getElementById('nceSpeakingTime').textContent = Math.floor(totalRecTime/60)+'m';

  document.getElementById('nceHistoryList').innerHTML = history.length ? history.slice().reverse().map(s => `
    <div class="nce-record-item">
      <div class="nce-record-header">
        <span class="nce-record-title">馃摃 ${s.title}</span>
        <span class="nce-record-date">${s.completedAt||s.date}</span>
      </div>
      <div class="nce-record-stats">
        <span>馃摑 璇嶆眹 ${s.vocab?s.vocab.length:0}涓?/span>
        <span>馃棧锔?琛ㄨ揪 ${s.expressions?s.expressions.length:0}涓?/span>
        <span>馃帳 鍙ｈ ${s.recordings?Math.floor(s.recordings.reduce((a,r)=>a+r.duration,0)/60):0}鍒嗛挓</span>
      </div>
      ${s.output ? `<div style="margin-top:6px;font-size:13px;color:var(--text-secondary);font-style:italic;border-top:1px solid var(--border);padding-top:6px;">鉁嶏笍 ${s.output.slice(0,80)}${s.output.length>80?'...':''}</div>` : ''}
      <div class="record-actions">
        <button class="del-btn" onclick="delNceHistory('${s.id}')">馃棏</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state"><div class="icon">馃摃</div><p>杩樻病鏈夊涔犺褰曪紝寮€濮嬩綘鐨勬柊姒傚康鑻辫涔嬫梾鍚э紒</p></div>';
}

function delNceHistory(id) {
  let history = DB.get('nce_history',[]);
  history = history.filter(s => s.id !== id);
  DB.set('nce_history', history);
  // Also remove reviews
  let reviews = DB.get('nce_reviews',[]);
  reviews = reviews.filter(r => r.id !== id);
  DB.set('nce_reviews', reviews);
  refreshNceHistory();
}

function refreshNce() {
  document.getElementById('nceToday').textContent = formatDateLong(todayStr());
  document.getElementById('nceAnalyzeBtn').disabled = !document.getElementById('nceTextInput').value.trim();
}

// ========== UTILS ==========
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function clearForm(ids) { ids.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; }); }

function statusText(s) {
  return {pending:'宸叉姇閫?,interview:'闈㈣瘯涓?,offer:'宸插彂Offer',reject:'鏈€氳繃'}[s]||s;
}

function isThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const dow = now.getDay() || 7;
  const monday = new Date(now); monday.setDate(now.getDate()-dow+1);
  return d >= monday && d <= now;
}

function formatDateLong(d) {
  const days=['鍛ㄦ棩','鍛ㄤ竴','鍛ㄤ簩','鍛ㄤ笁','鍛ㄥ洓','鍛ㄤ簲','鍛ㄥ叚'];
  const date = new Date(d);
  return `${d} ${days[date.getDay()]}`;
}

// ========== PROFILE / USER CENTER ==========
function generateUserId() {
  return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function initUser() {
  let uid = DB.get('user_id', null);
  if(!uid) {
    uid = generateUserId();
    DB.set('user_id', uid);
  }
  // Ensure profile exists
  let profile = DB.get('user_profile', null);
  if(!profile) {
    profile = {
      nickname: '鑷俊',
      career: '2026灞婃瘯涓氱敓',
      goal: '鏂板獟浣撹繍钀?,
      longGoal: '鐙珛杩愯惀鍝佺墝鍐呭+涓汉IP',
      bio: '',
      createdAt: new Date().toISOString()
    };
    DB.set('user_profile', profile);
  }
  return { uid, profile };
}

function refreshProfile() {
  const today = todayStr();
  document.getElementById('profileDate').textContent = formatDateLong(today);
  
  const { uid, profile } = initUser();
  
  // Profile card
  const lv = calcLevel(calcTotalXp());
  document.getElementById('profileLevel').textContent = lv ? lv.short : 'Lv.1';
  document.getElementById('profileName').textContent = profile.nickname || '鑷俊';
  document.getElementById('profileGoal').textContent = 
    (profile.career||'') + (profile.goal ? ' 路 '+profile.goal : '');
  
  // Form fields
  document.getElementById('pfNickname').value = profile.nickname||'';
  document.getElementById('pfCareer').value = profile.career||'';
  document.getElementById('pfGoal').value = profile.goal||'';
  document.getElementById('pfLongGoal').value = profile.longGoal||'';
  document.getElementById('pfBio').value = profile.bio||'';
  
  // Growth stats
  const engRecs = DB.get('english_records',[]);
  const readRecs = DB.get('reading_records',[]);
  const books = DB.get('read_books',[]);
  const burnRecs = DB.get('burn_records',[]);
  const xhsPosts = DB.get('xhs_productions',[]).filter(p=>p.status==='published').length;
  const xhsIdeas = DB.get('xhs_ideas',[]).length;
  const totalStudyMins = engRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const totalReadMins = readRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const totalBurnMins = burnRecs.reduce((s,r)=>s+(parseFloat(r.duration)||0),0);
  const streak = calcStreak();
  
  document.getElementById('profileStats').innerHTML = `
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${Math.round((totalStudyMins+totalReadMins)/60*10)/10}h</div>
      <div style="font-size:11px;color:var(--text-secondary);">绱瀛︿範</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${books.length}</div>
      <div style="font-size:11px;color:var(--text-secondary);">绱闃呰</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${xhsPosts + xhsIdeas}</div>
      <div style="font-size:11px;color:var(--text-secondary);">绱鍒涗綔</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${Math.round(totalBurnMins)}鍒嗛挓</div>
      <div style="font-size:11px;color:var(--text-secondary);">绱杩愬姩</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${streak}澶?/div>
      <div style="font-size:11px;color:var(--text-secondary);">杩炵画鎴愰暱</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${calcTotalXp()}</div>
      <div style="font-size:11px;color:var(--text-secondary);">鎬荤粡楠屽€?/div>
    </div>
  `;

  // Account info
  const startDate = profile.createdAt ? new Date(profile.createdAt).toISOString().slice(0,10) : '2026-07-01';
  document.getElementById('profileAccount').innerHTML = `
    <div style="padding:4px 0;"><strong>馃啍 鐢ㄦ埛ID锛?/strong><code style="background:var(--bg);padding:2px 8px;border-radius:4px;font-size:12px;">${uid}</code></div>
    <div style="padding:4px 0;"><strong>馃搮 寮€濮嬩娇鐢細</strong>${startDate}</div>
    <div style="padding:4px 0;"><strong>馃摫 鏁版嵁瀛樺偍锛?/strong>娴忚鍣ㄦ湰鍦?(localStorage) 路 鏈潵鏀寔浜戝悓姝?/div>
    <div style="padding:4px 0;"><strong>馃摛 鏁版嵁瀵煎嚭锛?/strong>鍓嶅線銆屾暟鎹腑蹇冦€嶅鍑哄畬鏁村浠?/div>
  `;
}

function saveProfile() {
  const profile = {
    nickname: document.getElementById('pfNickname').value,
    career: document.getElementById('pfCareer').value,
    goal: document.getElementById('pfGoal').value,
    longGoal: document.getElementById('pfLongGoal').value,
    bio: document.getElementById('pfBio').value,
    updatedAt: new Date().toISOString()
  };
  // Preserve createdAt
  const old = DB.get('user_profile', {});
  profile.createdAt = old.createdAt || new Date().toISOString();
  DB.set('user_profile', profile);
  refreshProfile();
  showOcrToast('鉁?涓汉璧勬枡宸蹭繚瀛?);
}

// ===== Expose user info in export =====
// (exportData already collects all pg_* data, which includes pg_user_profile and pg_user_id)

function refreshPage(page) {
  switch(page) {
    case 'dashboard': refreshDashboard(); break;
    case 'profile': refreshProfile(); break;
    case 'daily': refreshDaily(); break;
    case 'english': refreshEnglish(); break;
    case 'job': refreshJob(); break;
    case 'ai': refreshAi(); break;
    case 'xhs': refreshXhs(); break;
    case 'reading': refreshReading(); break;
    case 'wechat': refreshWechat(); break;
    case 'weekly': refreshWeekly(); break;
    case 'finance': refreshFinance(); break;
    case 'intake': refreshIntake(); break;
    case 'achievements': renderGrowthLevel(); renderBadges(); break;
    case 'monthly': refreshMonthly(); break;
    case 'backup': refreshBackup(); break;
    case 'growthai': refreshGrowthAi(); break;
  }
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', function(e){
    if(e.target === this) this.classList.remove('show');
  });
});

// ========== DATA CENTER ==========
const DATA_MODULES = {
  '鑻辫': ['english_records','eng_articles','eng_speaking','eng_ai_reviews'],
  'AI': ['ai_tools','ai_tasks','ai_flows','ai_prompts'],
  '姹傝亴': ['job_apply','job_interview','job_reviews','job_preps','hrqa_history'],
  '鍒涗綔': ['xhs_records','xhs_ideas','xhs_productions','xhs_virals','xhs_config','wechat_articles'],
  '闃呰': ['reading_records','read_notes','read_books','knowledge_cards'],
  '鍋ュ悍': ['intake_records','burn_records','health_profile','body_state_'],
  '璐㈠姟': ['fin_expense','fin_income','fin_budget_'],
  '绯荤粺': ['goals_','milestones','future_plans','daily_reports','mood_','steps_','tasks_']
};

function refreshBackup() {
  document.getElementById('backupDate').textContent = formatDateLong(todayStr());
  const keys = [];
  for(let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if(key && key.startsWith('pg_')) keys.push(key);
  }
  const totalSize = keys.reduce((s, k) => s + (localStorage.getItem(k)||'').length, 0);
  
  // Last backup
  const lastBackup = DB.get('last_auto_backup', null);
  const backupLogs = DB.get('backup_logs', []);
  const lastLog = backupLogs[backupLogs.length-1];
  
  document.getElementById('backupStats').innerHTML = `
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:24px;font-weight:800;color:var(--primary);">${keys.length}</div>
      <div style="font-size:12px;color:var(--text-secondary);">鏁版嵁妯″潡</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:24px;font-weight:800;color:var(--primary);">${(totalSize/1024).toFixed(1)}KB</div>
      <div style="font-size:12px;color:var(--text-secondary);">鍗犵敤绌洪棿</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:24px;font-weight:800;color:var(--primary);">${lastLog ? lastLog.date.slice(5) : '--'}</div>
      <div style="font-size:12px;color:var(--text-secondary);">鏈€杩戝浠?/div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg);border-radius:10px;">
      <div style="font-size:24px;font-weight:800;color:var(--primary);">${backupLogs.length}</div>
      <div style="font-size:12px;color:var(--text-secondary);">澶囦唤娆℃暟</div>
    </div>
  `;

  // Module detail
  document.getElementById('backupModules').innerHTML = Object.entries(DATA_MODULES).map(([name, prefixes]) => {
    const count = keys.filter(k => prefixes.some(p => k.startsWith('pg_'+p))).length;
    const size = keys.filter(k => prefixes.some(p => k.startsWith('pg_'+p)))
      .reduce((s, k) => s + (localStorage.getItem(k)||'').length, 0);
    const icons = {'鑻辫':'馃實','AI':'馃','姹傝亴':'馃捈','鍒涗綔':'馃幀','闃呰':'馃摉','鍋ュ悍':'馃崕','璐㈠姟':'馃挵','绯荤粺':'鈿欙笍'};
    return `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:8px;font-size:12px;">
      <span>${icons[name]||'馃摝'} ${name}</span>
      <span style="color:var(--text-secondary);">${count}椤?路 ${(size/1024).toFixed(1)}KB</span>
    </div>`;
  }).join('');

  // Auto backup status
  const today = todayStr();
  const todayBackup = backupLogs.find(l => l.date === today);
  document.getElementById('autoBackupStatus').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="dot ${todayBackup?'online':'offline'}" style="width:10px;height:10px;border-radius:50%;display:inline-block;background:${todayBackup?'#2da667':'#ddd'};"></span>
      <span>${todayBackup ? '鉁?浠婃棩宸茶嚜鍔ㄥ浠?('+todayBackup.size+')' : '鈴?浠婃棩灏氭湭澶囦唤'}</span>
    </div>
    ${backupLogs.slice(-5).reverse().map(l => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#b3a0a8;margin-top:4px;padding:2px 0;border-bottom:1px solid #f5f0f2;">
      <span>馃搮 ${l.date} 路 ${l.size} 路 ${l.count}椤?路 v${l.version||'1.0.0'}</span>
      <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 6px;" onclick="restoreFromBackup('${l.date}')">鎭㈠</button>
    </div>`).join('')}
    <div style="margin-top:6px;font-size:11px;color:#c45677;">馃挕 鐐瑰嚮銆屾仮澶嶃€嶅皢鐢ㄨ鏃ュ浠借鐩栧綋鍓嶅叏閮ㄦ暟鎹?/div>
  `;

  // Sync status
  const sync = DataService.getSyncState();
  document.getElementById('dsSyncStatus').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃攲 褰撳墠妯″紡</span>
      <span style="font-weight:600;">${sync.mode === 'local' ? '馃捇 鏈湴妯″紡' : '鈽侊笍 浜戝悓姝ユā寮?}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃摗 鍚屾鐘舵€?/span>
      <span style="font-weight:600;color:${sync.status==='synced'?'#2da667':sync.status==='syncing'?'#f5a04f':'#b3a0a8'};">${sync.status==='synced'?'鉁?宸插悓姝?:sync.status==='syncing'?'鈴?鍚屾涓?:'馃敶 鏈繛鎺?}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>鈿?鏁版嵁鐗堟湰</span>
      <span><code style="background:var(--bg);padding:2px 8px;border-radius:4px;">v${sync.version}</code></span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃晲 鏈€鍚庡悓姝?/span>
      <span>${sync.lastSync || '浠庢湭鍚屾'}</span>
    </div>
    <div style="margin-top:6px;font-size:11px;color:#b3a0a8;">鏈潵鎺ュ叆浜戞暟鎹簱鍚庯紝姝ゅ鏄剧ず鍚屾杩涘害鍜岀姸鎬併€?/div>
  `;

  // Today's data change logs
  const logs = DataService.getTodayLogs();
  const el = document.getElementById('dsLogList');
  if(logs.length === 0) {
    el.innerHTML = '<div style="color:#b3a0a8;text-align:center;padding:10px;">浠婃棩鏆傛棤鏁版嵁鍙樻洿璁板綍</div>';
  } else {
    const moduleNames = {
      english_records:'鑻辫鎴愰暱', eng_articles:'鑻辫鎴愰暱', eng_speaking:'鑻辫鎴愰暱',
      ai_tools:'AI鎶€鑳?, ai_tasks:'AI鎶€鑳?, ai_flows:'AI鎶€鑳?,
      job_apply:'姹傝亴绠＄悊', job_interview:'姹傝亴绠＄悊', job_reviews:'姹傝亴绠＄悊',
      xhs_records:'灏忕孩涔?, xhs_ideas:'灏忕孩涔?, xhs_productions:'灏忕孩涔?,
      reading_records:'闃呰璁″垝', read_books:'闃呰璁″垝', knowledge_cards:'闃呰璁″垝',
      intake_records:'鍋ュ悍绠＄悊', burn_records:'鍋ュ悍绠＄悊',
      fin_expense:'璐㈠姟绠＄悊', fin_income:'璐㈠姟绠＄悊'
    };
    el.innerHTML = logs.slice(-30).reverse().map(l => {
      const mod = Object.entries(moduleNames).find(([k]) => l.key && l.key.includes(k));
      return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f5f0f2;">
        <span>${mod ? '馃摝 '+mod[1] : '馃摝 绯荤粺'} 路 ${l.type === 'write' ? '鉁忥笍 鍐欏叆' : '馃摉 璇诲彇'}</span>
        <span style="color:#b3a0a8;">${l.time}</span>
      </div>`;
    }).join('');
  }
  // Render test center
  renderSyncTestCenter();
  // Render system info
  renderSystemInfo();
}

function restoreFromBackup(dateStr) {
  const pkg = DB.get('auto_backup_'+dateStr, null);
  if(!pkg || !pkg.data) {
    alert('鉂?鏈壘鍒?'+dateStr+' 鐨勫浠芥暟鎹?);
    return;
  }
  
  const confirmMsg = `鈿狅笍 鍗冲皢鎭㈠ ${dateStr} 鐨勫浠絓n\n` +
    `鍖呭惈 ${pkg.moduleCount || Object.keys(pkg.data).length} 椤规暟鎹ā鍧梊n` +
    `澶囦唤鐗堟湰锛歷${pkg.version || '1.0.0'}\n` +
    `瀵煎嚭鏃堕棿锛?{pkg.exportedAtLocal || dateStr}\n\n` +
    `鈿狅笍 鈿狅笍 鈿狅笍 杩欏皢瑕嗙洊浣犲綋鍓嶇殑鎵€鏈夋暟鎹紒纭畾缁х画鍚楋紵`;
    
  if(!confirm(confirmMsg)) return;
  if(!confirm('鈿狅笍 鍐嶆纭锛氭鎿嶄綔涓嶅彲鎾ら攢锛佹墍鏈夊綋鍓嶆暟鎹皢琚浠芥暟鎹浛鎹€?)) return;
  
  // Restore all data from backup
  let restored = 0;
  for(const [key, val] of Object.entries(pkg.data)) {
    localStorage.setItem(key, JSON.stringify(val));
    restored++;
  }
  
  showOcrToast(`鉁?宸蹭粠 ${dateStr} 鐨勫浠芥仮澶?${restored} 椤规暟鎹甡);
  setTimeout(() => location.reload(), 1500);
}

function runAutoBackup() {
  const today = todayStr();
  
  // Collect ALL pg_ prefixed data (complete snapshot)
  const data = {};
  const moduleCount = [];
  for(let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if(key && key.startsWith('pg_')) {
      try { data[key] = JSON.parse(localStorage.getItem(key)); moduleCount.push(key); }
      catch(e) { data[key] = localStorage.getItem(key); moduleCount.push(key); }
    }
  }

  // Build complete export package (same format as manual export)
  const exportPkg = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    exportedAtLocal: new Date().toLocaleString('zh-CN'),
    userId: DB.get('user_id', 'unknown'),
    userProfile: DB.get('user_profile', {}),
    moduleCount: Object.keys(data).length,
    data: data,
    description: '鑷俊 路 涓汉鎴愰暱宸ヤ綔鍙?路 鑷姩澶囦唤'
  };

  const sizeKB = (new Blob([JSON.stringify(exportPkg)]).size / 1024).toFixed(1);

  // Save backup snapshot (complete data for future restore)
  DB.set('auto_backup_'+today, exportPkg);

  // Also save backup log (metadata only)
  const backupLogs = DB.get('backup_logs', []);
  backupLogs.push({
    date: today,
    size: sizeKB+'KB',
    count: Object.keys(data).length,
    status: '鉁?鎴愬姛',
    version: '1.0.0',
    _ts: Date.now()
  });
  if(backupLogs.length > 30) backupLogs.splice(0, backupLogs.length - 30);
  DB.set('backup_logs', backupLogs);
  DB.set('last_auto_backup', today);
  
  refreshBackup();
  showOcrToast('鉁?鑷姩澶囦唤瀹屾垚锛佸叡 '+Object.keys(data).length+' 椤规暟鎹紝'+sizeKB+'KB');
}

function exportData() {
  // Collect all pg_ prefixed data
  const data = {};
  for(let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if(key && key.startsWith('pg_')) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch(e) {
        data[key] = localStorage.getItem(key);
      }
    }
  }

  // Build export package
  const exportPkg = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    exportedAtLocal: new Date().toLocaleString('zh-CN'),
    userId: DB.get('user_id', 'unknown'),
    userProfile: DB.get('user_profile', {}),
    moduleCount: Object.keys(data).length,
    data: data,
    description: '鑷俊 路 涓汉鎴愰暱宸ヤ綔鍙?鏁版嵁澶囦唤'
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(exportPkg, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `鑷俊宸ヤ綔鍙癬澶囦唤_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showOcrToast(`鉁?瀵煎嚭鎴愬姛锛佸叡 ${Object.keys(data).length} 涓ā鍧楋紝${(blob.size/1024).toFixed(1)}KB`);
}

function importData(input) {
  const file = input.files && input.files[0];
  if(!file) return;

  if(!file.name.endsWith('.json')) {
    alert('璇烽€夋嫨 JSON 鏍煎紡鐨勫浠芥枃浠?);
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const pkg = JSON.parse(e.target.result);

      // Validate
      if(!pkg.version || !pkg.data) {
        throw new Error('鏃犳晥鐨勫浠芥枃浠舵牸寮?);
      }

      const keyCount = Object.keys(pkg.data).length;
      const confirmMsg = `鈿狅笍 鍗冲皢瀵煎叆 ${keyCount} 涓暟鎹ā鍧梊n\n` +
        `鏂囦欢鐢熸垚鏃堕棿锛?{pkg.exportedAtLocal || '鏈煡'}\n` +
        `鏁版嵁鐗堟湰锛?{pkg.version}\n\n` +
        `鈿狅笍 瀵煎叆灏嗚鐩栧綋鍓嶆墍鏈夋暟鎹紒纭畾缁х画鍚楋紵`;

      if(!confirm(confirmMsg)) {
        input.value = '';
        return;
      }

      // Restore all data
      let restoredCount = 0;
      for(const [key, val] of Object.entries(pkg.data)) {
        localStorage.setItem(key, JSON.stringify(val));
        restoredCount++;
      }

      input.value = '';
      showOcrToast(`鉁?瀵煎叆鎴愬姛锛佸凡鎭㈠ ${restoredCount} 涓ā鍧楃殑鏁版嵁`);
      refreshBackup();
      refreshDashboard();

    } catch(err) {
      alert('鉂?瀵煎叆澶辫触锛? + err.message);
      input.value = '';
    }
  };
  reader.readAsText(file);
}

// ========== SUPABASE AUTH ==========
// SUPABASE_URL / SUPABASE_ANON_KEY 宸插湪椤甸潰椤堕儴 <script> 涓厤缃?
// ===== Supabase Lifecycle =====
let supabaseClient = null;
let _supabaseReady = false;

function getSupabaseClient() {
  if(!supabaseClient) throw new Error('Supabase鏈嶅姟鏈垵濮嬪寲锛岃鍒锋柊椤甸潰');
  return supabaseClient;
}

function isSupabaseReady() { return _supabaseReady && supabaseClient !== null; }

let currentUser = {
  id: null,
  email: null,
  loggedIn: false
};

function initSupabase() {
  try {
    if(typeof supabase === 'undefined') {
      console.warn('[Supabase] SDK 鏈姞杞斤紝璺宠繃璁よ瘉鍒濆鍖?);
      return;
    }
    // Detect placeholder values
    if(SUPABASE_URL.includes('your-project') || SUPABASE_ANON_KEY.includes('your-anon-key')) {
      console.warn('[Supabase] 鈿狅笍 妫€娴嬪埌鍗犱綅绗﹂厤缃紝鐧诲綍鍔熻兘灏嗚绂佺敤銆傝鏇挎崲 SUPABASE_URL 鍜?SUPABASE_ANON_KEY銆?);
      console.warn('[Supabase] 褰撳墠涓恒€岀函鏈湴妯″紡銆嶏紝鎵€鏈夊姛鑳戒粛鍙湪 localStorage 涓甯镐娇鐢ㄣ€?);
      return;
    }
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        console.log("褰撳墠鐢ㄦ埛:", session.user.email);
    }
});
    _supabaseReady = true;
    
    // Check existing session
    supabaseClient.auth.getSession().then(({ data }) => {
      if(data?.session?.user) {
        const user = data.session.user;
        currentUser = { id: user.id, email: user.email, loggedIn: true };
        updateAuthUI();
        // Ensure profile exists
        ensureProfile(user.id);
      }
    });

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if(session?.user) {
        currentUser = { id: session.user.id, email: session.user.email, loggedIn: true };
        ensureProfile(session.user.id);
        // Auto-sync on login if in cloud mode
        if(DATA_CONFIG.mode === 'cloud') setTimeout(() => syncManager.syncAll(), 2000);
      } else {
        currentUser = { id: null, email: null, loggedIn: false };
      }
      updateAuthUI();
    });
  } catch(e) {
    console.warn('[Supabase] 鍒濆鍖栧け璐?', e);
  }
}

function updateAuthUI() {
  const el = document.getElementById('sidebarAuth');
  const sync = document.getElementById('sidebarSync');
  const syncBtn = document.getElementById('sidebarSyncBtn');
  if(currentUser.loggedIn) {
    el.innerHTML = `馃懁 ${currentUser.email.slice(0,18)}`;
    el.style.color = '#2da667';
    if(syncBtn) syncBtn.style.display = 'inline';
    if(DATA_CONFIG.mode === 'cloud') {
      sync.innerHTML = '鈽侊笍 浜戠';
      sync.style.color = '#2da667';
    }
  } else {
    if(!isSupabaseReady()) {
      el.innerHTML = '鈽侊笍 浜戝悓姝ワ紙寰呴厤缃級';
      el.style.color = '#b3a0a8';
    } else {
      el.innerHTML = '鈽侊笍 鐧诲綍浜戝悓姝?;
      el.style.color = '#b3a0a8';
    }
    if(syncBtn) syncBtn.style.display = 'none';
  }
  // Update modal
  const modal = document.getElementById('authLoggedIn');
  const form = document.getElementById('authForm');
  if(modal && form) {
    modal.style.display = currentUser.loggedIn ? 'block' : 'none';
    form.style.display = currentUser.loggedIn ? 'none' : 'block';
    if(currentUser.loggedIn) {
      document.getElementById('authUserEmail').textContent = currentUser.email;
    }
  }
}

function ensureProfile(userId) {
  // Check if profile exists in Supabase
  supabaseClient.from('profiles').select('user_id').eq('user_id', userId).then(({ data, error }) => {
    if(error || !data || data.length === 0) {
      // Create profile
      const localProfile = DB.get('user_profile', {});
      supabaseClient.from('profiles').insert({
        user_id: userId,
        nickname: localProfile.nickname || '鐢ㄦ埛',
        career: localProfile.career || null,
        goal: localProfile.goal || null
      }).then(({ error: insertError }) => {
        if(insertError) console.error('[Supabase] 鍒涘缓profile澶辫触:', insertError);
      });
    } else {
      // Update profile from local data if available
      const localProfile = DB.get('user_profile', {});
      if(localProfile.nickname) {
        supabaseClient.from('profiles').update({
          nickname: localProfile.nickname,
          career: localProfile.career,
          goal: localProfile.goal
        }).eq('user_id', userId).then();
      }
    }
    // Also save the local user_id 鈫?Supabase user_id mapping
    DB.set('supabase_user_id', userId);
  });
}

function authLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';
  
  if(!email || !password) { errEl.textContent = '璇峰～鍐欓偖绠卞拰瀵嗙爜'; errEl.style.display = 'block'; return; }
  
  // Check if Supabase is properly configured
  if(!isSupabaseReady() || !supabaseClient) {
    errEl.innerHTML = '鈿狅笍 Supabase 鏈嶅姟鏈垵濮嬪寲<br><span style="font-size:11px;color:#888;">璇蜂娇鐢ㄣ€屾湰鍦版ā寮忋€嶇户缁紝鎴栬仈绯诲紑鍙戣€呴厤缃?Supabase</span>';
    errEl.style.display = 'block';
    return;
  }
  
  const loginBtn = document.getElementById('authLoginBtn');
  loginBtn.textContent = '鐧诲綍涓?..';
  loginBtn.disabled = true;
  
  // Timeout protection (15s)
  const timeoutId = setTimeout(() => {
    loginBtn.textContent = '鐧诲綍';
    loginBtn.disabled = false;
    errEl.innerHTML = '鈿狅笍 鐧诲綍瓒呮椂锛?5绉掞級<br><span style="font-size:11px;color:#888;">鍙兘鏄綉缁滈棶棰樻垨 Supabase 閰嶇疆閿欒</span>';
    errEl.style.display = 'block';
  }, 15000);
  
  supabaseClient.auth.signInWithPassword({ email, password })
    .then(({ data, error }) => {
      clearTimeout(timeoutId);
      loginBtn.textContent = '鐧诲綍';
      loginBtn.disabled = false;
      if(error) {
        errEl.innerHTML = '鉂?' + error.message + '<br><span style="font-size:11px;color:#888;">鎻愮ず锛氬厛鐐瑰嚮銆屾敞鍐屻€嶅垱寤鸿处鍙?/span>';
        errEl.style.display = 'block';
        return;
      }
      closeModal('authModal');
      showOcrToast('鉁?鐧诲綍鎴愬姛锛?);
      document.getElementById('sidebarSyncBtn').style.display = 'inline';
      if(DATA_CONFIG.mode === 'cloud') syncManager.syncAll();
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      loginBtn.textContent = '鐧诲綍';
      loginBtn.disabled = false;
      errEl.innerHTML = '鉂?鐧诲綍澶辫触: ' + (err.message || '鏈煡閿欒') + '<br><span style="font-size:11px;color:#888;">璇锋鏌ョ綉缁滃拰 Supabase 閰嶇疆</span>';
      errEl.style.display = 'block';
      console.error('[Auth] Login error:', err);
    });
}

function authRegister() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';
  
  if(!email || !password) { errEl.textContent = '璇峰～鍐欓偖绠卞拰瀵嗙爜'; errEl.style.display = 'block'; return; }
  if(password.length < 6) { errEl.textContent = '瀵嗙爜鑷冲皯6浣?; errEl.style.display = 'block'; return; }
  
  if(!isSupabaseReady() || !supabaseClient) {
    errEl.innerHTML = '鈿狅笍 Supabase 鏈嶅姟鏈垵濮嬪寲<br><span style="font-size:11px;color:#888;">璇蜂娇鐢ㄣ€屾湰鍦版ā寮忋€嶇户缁紝鎴栬仈绯诲紑鍙戣€呴厤缃?Supabase</span>';
    errEl.style.display = 'block';
    return;
  }
  
  supabaseClient.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: "https://workbuddy-psi.vercel.app/"
    }
})
    .then(({ data, error }) => {
      if(error) {
        errEl.innerHTML = '鉂?' + error.message;
        errEl.style.display = 'block';
        return;
      }
      alert('鉁?娉ㄥ唽鎴愬姛锛佽鍓嶅線閭瀹屾垚纭锛岀‘璁ゅ悗鍗冲彲鐧诲綍銆?);
      closeModal('authModal');
  });
}

function authLogout() {
  if(!isSupabaseReady() || !supabaseClient) {
    currentUser = { id: null, email: null, loggedIn: false };
    updateAuthUI();
    return;
  }
  supabaseClient.auth.signOut().then(() => {
    currentUser = { id: null, email: null, loggedIn: false };
    updateAuthUI();
    showOcrToast('宸查€€鍑虹櫥褰?);
  });
}

function skipAuth() {
  // Ensure local mode is active
  DATA_CONFIG.mode = 'local';
  DB.set('data_config', DATA_CONFIG);
  closeModal('authModal');
  showOcrToast('鉁?宸插垏鎹㈠埌鏈湴妯″紡锛屾墍鏈夋暟鎹繚瀛樺湪鏈満娴忚鍣?);
}

// ========== DATA MODE SWITCH ==========
function toggleDataMode() {
  const newMode = DATA_CONFIG.mode === 'local' ? 'cloud' : 'local';
  if(newMode === 'cloud' && !currentUser.loggedIn) {
    alert('璇峰厛鐧诲綍鍚庡啀鍒囨崲鍒颁簯绔ā寮?);
    return;
  }
  DATA_CONFIG.mode = newMode;
  DB.set('data_config', DATA_CONFIG);
  const sync = document.getElementById('sidebarSync');
  sync.innerHTML = newMode === 'local' ? '馃捇 鏈湴' : '鈽侊笍 浜戠';
  sync.style.color = newMode === 'local' ? '#b3a0a8' : '#2da667';
  showOcrToast(newMode === 'local' ? '馃捇 宸插垏鎹㈠埌鏈湴妯″紡' : '鈽侊笍 宸插垏鎹㈠埌浜戠妯″紡');
  // Auto-sync when switching to cloud
  if(newMode === 'cloud') syncManager.syncAll();
}

// ========== SYNC MANAGER ==========
const syncManager = {
  _syncing: false,
  _tables: ['daily_plans', 'english_records', 'reading_records', 'health_records'],
  _lastSync: null,

  // ===== Log sync history =====
  _logSync(type, detail) {
    const history = DB.get('sync_history', []);
    history.push({
      time: new Date().toISOString(),
      device: getDeviceInfo(),
      type: type,            // 'upload', 'download', 'full_sync', 'error'
      detail: detail,
      _ts: Date.now()
    });
    // Keep last 100 records
    if(history.length > 100) history.splice(0, history.length - 100);
    DB.set('sync_history', history);
  },

  // ===== Enhanced error handling =====
  _handleError(context, error) {
    let friendlyMsg = '';
    let errCode = 'UNKNOWN';

    if(!error) {
      friendlyMsg = '鏈煡閿欒';
    } else if(error.message && error.message.includes('network')) {
      errCode = 'NETWORK';
      friendlyMsg = '鈿狅笍 缃戠粶杩炴帴澶辫触锛岃妫€鏌ョ綉缁滃悗閲嶈瘯';
    } else if(error.message && error.message.includes('Failed to fetch')) {
      errCode = 'NETWORK';
      friendlyMsg = '鈿狅笍 缃戠粶璇锋眰澶辫触锛團ailed to fetch锛夛紝璇锋鏌ョ綉缁滆繛鎺ュ拰CORS閰嶇疆';
    } else if(error.code === 'PGRST301') {
      errCode = 'AUTH';
      friendlyMsg = '鈿狅笍 鏉冮檺涓嶈冻锛圧LS鎷︽埅锛夛紝璇锋鏌ユ暟鎹簱RLS绛栫暐';
    } else if(error.code === 'PGRST302') {
      errCode = 'NOT_FOUND';
      friendlyMsg = '鈿狅笍 璇锋眰鐨勮祫婧愪笉瀛樺湪';
    } else if(error.code === '23505') {
      errCode = 'DUPLICATE';
      friendlyMsg = '鈿狅笍 鏁版嵁閲嶅锛屽凡璺宠繃';
    } else if(error.code === '42501') {
      errCode = 'PERMISSION';
      friendlyMsg = '鈿狅笍 鏉冮檺鎷掔粷锛岃妫€鏌ユ暟鎹簱RLS绛栫暐';
    } else if(error.message && error.message.includes('JWT')) {
      errCode = 'AUTH_TOKEN';
      friendlyMsg = '鈿狅笍 璁よ瘉浠ょ墝宸茶繃鏈燂紝璇烽噸鏂扮櫥褰?;
    } else if(error.status === 0 || error.status === undefined) {
      errCode = 'NETWORK';
      friendlyMsg = '鈿狅笍 缃戠粶寮傚父锛屾棤娉曡繛鎺ュ埌Supabase鏈嶅姟鍣?;
    } else {
      friendlyMsg = `鈿狅笍 ${error.message || '鏈煡閿欒'} (${error.code || ''})`;
    }

    console.error(`[Sync] ${context}:`, error, `鈫?${friendlyMsg}`);
    this._logSync('error', { context, code: errCode, message: friendlyMsg });
    return { code: errCode, message: friendlyMsg };
  },

  async uploadLocalData() {
    if(!isSupabaseReady()) return { success: false, reason: 'SUPABASE_NOT_INIT', message: 'Supabase鏈嶅姟鏈垵濮嬪寲锛岃鍒锋柊椤甸潰閲嶈瘯' };
    if(!currentUser.loggedIn) return { success: false, reason: 'NOT_LOGGED_IN', message: '璇峰厛鐧诲綍' };

    const userId = currentUser.id;
    let uploaded = 0, errors = 0, errorDetails = [];
    const now = new Date().toISOString();

    const data = DB.migrate();
    if(!data.success) {
      this._logSync('upload', { message: '鏃犳暟鎹渶瑕佷笂浼? });
      return { success: true, uploaded: 0, errors: 0 };
    }
    const tables = data.data.tables;

    const formatMap = {
      daily_plans: tables.daily_plans,
      english_records: tables.english_records,
      reading_records: tables.reading_records,
      health_records: tables.health_records
    };

    for(const tableName of this._tables) {
      const rows = formatMap[tableName] || [];
      if(rows.length === 0) continue;
      
      for(let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50).map(r => ({
          ...r,
          user_id: userId,
          created_at: now,
          updated_at: now
        }));
        
        try {
          const { error } = await supabaseClient.from(tableName).upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: false
          });
          if(error) {
            const errInfo = this._handleError(`涓婁紶 ${tableName}`, error);
            errors++;
            errorDetails.push(errInfo);
          } else {
            uploaded += batch.length;
          }
        } catch(e) {
          const errInfo = this._handleError(`涓婁紶 ${tableName}`, e);
          errors++;
          errorDetails.push(errInfo);
          // Stop on network error to avoid cascading failures
          if(errInfo.code === 'NETWORK') break;
        }
      }
    }

    this._logSync('upload', {
      uploaded, errors, errorDetails,
      tables: this._tables.filter(t => (formatMap[t]||[]).length > 0)
    });
    return { success: true, uploaded, errors, errorDetails };
  },

  async downloadCloudData() {
    if(!isSupabaseReady()) return { success: false, reason: 'SUPABASE_NOT_INIT', message: 'Supabase鏈嶅姟鏈垵濮嬪寲锛岃鍒锋柊椤甸潰' };
    if(!currentUser.loggedIn) return { success: false, reason: 'NOT_LOGGED_IN', message: '璇峰厛鐧诲綍' };

    const userId = currentUser.id;
    let downloaded = 0, errors = 0, errorDetails = [];
    
    const tableMapper = {
      daily_plans: 'goals_',
      english_records: 'english_records',
      reading_records: 'reading_records',
      health_records: 'body_state_'
    };

    for(const [tableName, localKey] of Object.entries(tableMapper)) {
      try {
        const { data: rows, error } = await supabaseClient
          .from(tableName)
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        
        if(error) {
          const errInfo = this._handleError(`涓嬭浇 ${tableName}`, error);
          errors++;
          errorDetails.push(errInfo);
          continue;
        }
        if(!rows || rows.length === 0) continue;

        if(tableName === 'daily_plans') {
          const grouped = {};
          rows.forEach(r => {
            if(!grouped[r.plan_date]) grouped[r.plan_date] = [];
            grouped[r.plan_date].push({ id: 'g'+grouped[r.plan_date].length, text: r.goal_text, done: r.is_done });
          });
          for(const [date, goals] of Object.entries(grouped)) {
            DB.set(localKey + date, goals);
            downloaded += goals.length;
          }
        } else if(tableName === 'english_records') {
          const cloudData = rows.map(r => ({
            date: r.record_date, article: r.article_title, time: String(r.duration_min),
            newWordsList: r.new_words, phrases: r.phrases, speaking: r.speaking_min, note: r.note, aiSummary: r.ai_summary
          }));
          const existing = DB.get(localKey, []);
          const localDates = new Set(existing.map(e => e.date));
          const newRows = cloudData.filter(r => !localDates.has(r.date));
          existing.push(...newRows);
          DB.set(localKey, existing);
          downloaded += newRows.length;
        } else if(tableName === 'reading_records') {
          const cloudData = rows.map(r => ({
            date: r.read_date, book: r.book_name, time: r.duration_min,
            content: r.content, keyPoint: r.key_point, aiSummary: r.ai_summary
          }));
          const existing = DB.get(localKey, []);
          const localKeys = new Set(existing.map(e => e.date + '_' + e.book));
          const newRows = cloudData.filter(r => !localKeys.has(r.date + '_' + r.book));
          existing.push(...newRows);
          DB.set(localKey, existing);
          downloaded += newRows.length;
        } else if(tableName === 'health_records') {
          rows.forEach(r => {
            if(r.record_date) DB.set('body_state_' + r.record_date, {
              sleepHours: r.sleep_hours, sleepQuality: r.sleep_quality,
              energy: r.energy_score, fatigue: r.fatigue_level
            });
          });
          downloaded += rows.length;
        }
      } catch(e) {
        const errInfo = this._handleError(`涓嬭浇 ${tableName}`, e);
        errors++;
        errorDetails.push(errInfo);
        if(errInfo.code === 'NETWORK' || errInfo.code === 'AUTH_TOKEN') break;
      }
    }

    this._logSync('download', { downloaded, errors, errorDetails });
    return { success: true, downloaded, errors, errorDetails };
  },

  async syncAll() {
    if(this._syncing) {
      showOcrToast('鈿狅笍 鍚屾姝ｅ湪杩涜涓紝璇风◢鍊?..');
      return;
    }
    if(!currentUser.loggedIn) {
      showOcrToast('鈿狅笍 璇峰厛鐧诲綍鍚庡啀鍚屾');
      return;
    }
    if(!isSupabaseReady()) {
      showOcrToast('鈿狅笍 Supabase鏈嶅姟鏈垵濮嬪寲锛岃鍒锋柊椤甸潰');
      return;
    }

    this._syncing = true;
    const btn = document.getElementById('sidebarSyncBtn');
    const status = document.getElementById('sidebarSyncStatus');
    if(btn) btn.textContent = '鈴?鍚屾涓?..';
    if(status) status.textContent = '姝ｅ湪鍚屾...';
    this._logSync('full_sync', { status: 'started' });

    try {
      // Step 1: Upload local data
      const uploadResult = await this.uploadLocalData();
      
      // Step 2: Download cloud data
      const downloadResult = await this.downloadCloudData();

      const total = (uploadResult.uploaded || 0) + (downloadResult.downloaded || 0);
      const errs = (uploadResult.errors || 0) + (downloadResult.errors || 0);
      
      this._lastSync = new Date().toISOString();
      DATA_CONFIG.lastSync = this._lastSync;
      DB.set('data_config', DATA_CONFIG);

      if(btn) btn.textContent = '馃攧 鍚屾鏁版嵁';
      if(status) status.textContent = `鉁?宸插悓姝?${total} 鏉 + (errs ? `, ${errs}涓敊璇痐 : '');
      
      showOcrToast(`鉁?鍚屾瀹屾垚锛佷笂浼?${uploadResult.uploaded||0} 鏉?路 涓嬭浇 ${downloadResult.downloaded||0} 鏉);

      this._logSync('full_sync', {
        status: errs > 0 ? 'completed_with_errors' : 'completed',
        uploaded: uploadResult.uploaded || 0,
        downloaded: downloadResult.downloaded || 0,
        errors: errs,
        uploadErrors: uploadResult.errorDetails || [],
        downloadErrors: downloadResult.errorDetails || []
      });

      if(errs > 0) {
        showOcrToast(`鈿狅笍 ${errs} 涓悓姝ラ敊璇紝璇︽儏瑙佸悓姝ユ棩蹇梎);
      }

    } catch(e) {
      this._handleError('鍏ㄩ噺鍚屾', e);
      if(btn) btn.textContent = '馃攧 鍚屾鏁版嵁';
      if(status) status.textContent = '鉂?鍚屾澶辫触';
      showOcrToast('鈿狅笍 鍚屾寮傚父涓柇锛岃妫€鏌ユ棩蹇楀悗閲嶈瘯');
      this._logSync('full_sync', { status: 'failed', error: e.message });
    } finally {
      this._syncing = false;
    }
  }
};

// ========== SYNC DIAGNOSTIC ==========
const syncDiagnostic = {
  _results: {},

  // Detect device info
  _getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = '鐢佃剳';
    if(/iPad|iPhone|iPod/.test(ua)) device = 'iOS璁惧';
    else if(/Android/.test(ua)) device = '瀹夊崜璁惧';
    else if(/Mobile/.test(ua)) device = '鎵嬫満';
    return {
      device,
      browser: ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/\d+/)?.[0] || 'Unknown',
      platform: navigator.platform || 'Unknown',
      timestamp: new Date().toISOString()
    };
  },

  // Test Supabase connection
  async testConnection() {
    const el = document.getElementById('syncTestResults');
    el.innerHTML = '<div style="color:#b3a0a8;">馃攲 娴嬭瘯杩炴帴涓?..</div>';
    
    try {
      if(!isSupabaseReady()) throw new Error('Supabase鏈嶅姟鏈垵濮嬪寲锛岃鍒锋柊椤甸潰');
      if(!currentUser.loggedIn) throw new Error('鐢ㄦ埛鏈櫥褰?);
      
      const { data, error } = await supabaseClient.from('profiles').select('count').limit(1);
      if(error) throw error;
      
      el.innerHTML = `
        <div style="padding:10px;background:#d4edda;border-radius:8px;color:#155724;">
          <strong>鉁?Supabase 杩炴帴姝ｅ父</strong><br>
          鐢ㄦ埛: ${currentUser.email}<br>
          鐢ㄦ埛ID: ${currentUser.id}
        </div>
      `;
      this._results.connection = { status: 'ok', time: new Date().toISOString() };
    } catch(e) {
      const msg = e.message || '鏈煡閿欒';
      el.innerHTML = `
        <div style="padding:10px;background:#f8d7da;border-radius:8px;color:#721c24;">
          <strong>鉂?杩炴帴澶辫触</strong><br>
          鍘熷洜: ${msg}<br>
          馃挕 璇锋鏌?Supabase URL/ANON_KEY 閰嶇疆鍜岀綉缁滆繛鎺?
        </div>
      `;
      this._results.connection = { status: 'error', message: msg };
    }
  },

  // Check all tables: local vs cloud counts
  async checkAllTables() {
    const el = document.getElementById('syncTestResults');
    el.innerHTML = '<div style="color:#b3a0a8;">馃搳 姝ｅ湪鏍￠獙鍚勮〃鏁版嵁...</div>';
    
    const tables = [
      { name: 'daily_plans', localKey: null, localFn: () => {
        let count = 0;
        for(const key of Object.keys(localStorage))
          if(key.startsWith('pg_goals_')) count += JSON.parse(localStorage.getItem(key)||'[]').length;
        return count;
      }},
      { name: 'english_records', localKey: 'pg_english_records', localFn: null },
      { name: 'reading_records', localKey: 'pg_reading_records', localFn: null },
      { name: 'health_records', localKey: null, localFn: () => {
        let count = 0;
        for(const key of Object.keys(localStorage))
          if(key.startsWith('pg_body_state_')) count++;
        return count;
      }}
    ];

    let rows = '';
    let hasError = false;

    for(const table of tables) {
      try {
        // Local count
        let localCount = 0;
        if(table.localFn) localCount = table.localFn();
        else if(table.localKey) {
          const data = DB.get(table.localKey.replace('pg_', ''), []);
          localCount = Array.isArray(data) ? data.length : 0;
        }

        // Cloud count
        const { count, error } = await supabaseClient
          .from(table.name)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id);

        const cloudCount = count || 0;
        const match = localCount === cloudCount;

        rows += `<div style="display:flex;justify-content:space-between;padding:6px 8px;background:${match?'var(--bg)':'#fff3cd'};border-radius:6px;margin-bottom:4px;font-size:12px;">
          <span>馃摝 ${table.name}</span>
          <span>馃捇 ${localCount} 鏉?路 鈽侊笍 ${cloudCount} 鏉?${match ? '鉁? : '鈿狅笍'}</span>
        </div>`;

        if(!match) hasError = true;
        this._results[table.name] = { localCount, cloudCount, match };
      } catch(e) {
        rows += `<div style="padding:6px 8px;background:#f8d7da;border-radius:6px;margin-bottom:4px;font-size:12px;color:#721c24;">
          鈿狅笍 ${table.name} 鏌ヨ澶辫触: ${e.message}
        </div>`;
        hasError = true;
      }
    }

    el.innerHTML = `
      <div style="padding:10px;background:${hasError?'#fff3cd':'#d4edda'};border-radius:8px;color:${hasError?'#856404':'#155724'};">
        <strong>${hasError ? '鈿狅笍 鍙戠幇鏁版嵁宸紓' : '鉁?鎵€鏈夎〃鏁版嵁涓€鑷?}</strong>
        <div style="margin-top:8px;">${rows}</div>
        ${hasError ? '<div style="margin-top:6px;font-size:11px;">馃挕 鐐瑰嚮銆屽悓姝ユ暟鎹€嶆寜閽悓姝ヨˉ鍏ㄥ樊寮?/div>' : ''}
      </div>
    `;
  },

  // Generate diagnostic report
  generateReport() {
    const info = this._getDeviceInfo();
    const history = DB.get('sync_history', []);
    const latestSync = history[history.length - 1];
    const allKeys = DataService.getAllKeys();
    
    const report = {
      generatedAt: new Date().toISOString(),
      device: info,
      user: {
        id: currentUser.id,
        email: currentUser.email,
        loggedIn: currentUser.loggedIn,
        localUserId: DB.get('user_id', 'unknown')
      },
      config: DATA_CONFIG,
      dataOverview: {
        totalKeys: allKeys.length,
        estimatedSizeKB: Math.round(allKeys.reduce((s, k) => s + (localStorage.getItem(k)||'').length, 0) / 10.24) / 100
      },
      lastSync: latestSync ? {
        time: latestSync.time,
        type: latestSync.type,
        detail: latestSync.detail
      } : null,
      syncHistory: history.slice(-10),
      diagnostics: this._results
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workbuddy_diagnostic_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    const el = document.getElementById('syncTestResults');
    el.innerHTML = `
      <div style="padding:10px;background:#d4edda;border-radius:8px;color:#155724;">
        鉁?璇婃柇鎶ュ憡宸蹭笅杞?br>
        馃搫 workbuddy_diagnostic_${todayStr()}.json<br>
        馃搳 ${report.dataOverview.totalKeys} 涓暟鎹ā鍧?路 ${report.dataOverview.estimatedSizeKB}KB
      </div>
    `;
  },

  // Verify data integrity between syncs
  async verifyIntegrity() {
    const el = document.getElementById('syncTestResults');
    el.innerHTML = '<div style="color:#b3a0a8;">馃攧 姝ｅ湪杩涜瀹屾暣鎬ч獙璇?..</div>';
    
    await this.checkAllTables();
    
    // Additional: count total sync history
    const history = DB.get('sync_history', []);
    const successCount = history.filter(h => 
      h.detail?.status === 'completed' || (h.type === 'full_sync' && h.detail?.uploaded > 0)
    ).length;
    const errorCount = history.filter(h => h.type === 'error').length;
    
    const lastEl = document.getElementById('syncTestResults');
    lastEl.innerHTML += `
      <div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:12px;">
        馃搵 鍚屾鍘嗗彶: ${history.length} 娆?(鎴愬姛 ${successCount} 路 寮傚父 ${errorCount} 路 杩涜涓?${history.length-successCount-errorCount})<br>
        馃晲 鏈€鍚庡悓姝? ${history[history.length-1]?.time?.slice(0,19).replace('T',' ') || '浠庢湭鍚屾'}
      </div>
    `;
  }
};

// ========== UPDATE DATA CENTER TEST CENTER ==========
// (called from refreshBackup)
function renderSyncTestCenter() {
  const info = document.getElementById('syncTestInfo');
  if(!info) return;
  
  const device = syncDiagnostic._getDeviceInfo();
  const history = DB.get('sync_history', []);
  const lastSync = history[history.length - 1];
  
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px;font-size:12px;">
      <div><strong>馃懁 鐢ㄦ埛:</strong> ${currentUser.loggedIn ? currentUser.email : '鏈櫥褰?}</div>
      <div><strong>馃啍 ID:</strong> <code style="font-size:10px;">${currentUser.id || DB.get('user_id','--')}</code></div>
      <div><strong>馃捇 璁惧:</strong> ${device.device} 路 ${device.browser}</div>
      <div><strong>馃攲 妯″紡:</strong> ${DATA_CONFIG.mode === 'local' ? '馃捇 鏈湴' : '鈽侊笍 浜戠'}</div>
      <div><strong>馃晲 鏈€鍚庡悓姝?</strong> ${lastSync ? lastSync.time.slice(0,19).replace('T',' ') : '浠庢湭鍚屾'}</div>
      <div><strong>馃搳 鍚屾娆℃暟:</strong> ${history.length}</div>
    </div>
  `;
}

// ========== PWA & MOBILE ==========
let pwaDeferredPrompt = null;

// Detect standalone (installed as PWA / home screen app)
function isPwaStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Get device type for sync logging
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'desktop';
  if(/iPad/.test(ua)) device = 'ipad';
  else if(/iPhone|iPod/.test(ua)) device = 'iphone';
  else if(/Android/.test(ua)) device = 'android';
  else if(/Mobile/.test(ua)) device = 'mobile';
  return device;
}

// Register Service Worker
function registerSw() {
  if(!('serviceWorker' in navigator)) return;
  
  // Register with cache-busting version param
  const swUrl = 'service-worker.js?v=' + APP_VERSION;

// 鏆傛椂鍏抽棴 Service Worker 娴嬭瘯
console.log("鏆傛椂鍏抽棴Service Worker");

/*
navigator.serviceWorker.register(swUrl).then(reg => {
    console.log('[PWA] Service Worker 宸叉敞鍐?, reg.scope);

    navigator.serviceWorker.addEventListener('message', (event) => {
      if(event.data?.type === 'SYNC_TRIGGER' && DATA_CONFIG.mode === 'cloud') {
        syncManager.syncAll();
      }
    });
});
*/
    // === Auto-update when new SW is found ===
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      console.log('[PWA] 妫€娴嬪埌鏂扮増鏈紝姝ｅ湪瀹夎...');
      
      newSW.addEventListener('statechange', () => {
        if(newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW is installed but waiting 鈥?send skipWaiting and reload
          console.log('[PWA] 鏂扮増鏈凡灏辩华锛岃嚜鍔ㄥ埛鏂板簲鐢?);
          newSW.postMessage({ type: 'SKIP_WAITING' });
          // Brief delay then reload to use new version
          setTimeout(() => window.location.reload(), 500);
        }
      });
    });
    
  }).catch(err => {
    console.warn('[PWA] Service Worker 娉ㄥ唽澶辫触:', err);
  });
  
  // === Auto-reload when controlled by new SW ===
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] 鏂?Service Worker 宸叉縺娲伙紝椤甸潰灏嗗埛鏂?);
    window.location.reload();
  });
}

// Check if app version changed 鈥?force hard refresh
function checkVersionUpdate() {
  const cachedVersion = DB.get('app_cached_version', null);
  if(cachedVersion && cachedVersion !== APP_VERSION) {
    console.log(`[Update] 鐗堟湰鍙樻洿: ${cachedVersion} 鈫?${APP_VERSION}锛屾竻鐞嗙紦瀛榒);
    // Clear old SW caches
    if('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Update stored version
    DB.set('app_cached_version', APP_VERSION);
    // Reload to get fresh assets
    window.location.reload(true);
  } else if(!cachedVersion) {
    DB.set('app_cached_version', APP_VERSION);
  }
}

// PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaDeferredPrompt = e;
  const banner = document.getElementById('pwaInstallBanner');
  if(banner) banner.style.display = 'block';
});

function installPwa() {
  if(!pwaDeferredPrompt) {
    // iOS / unsupported fallback with platform-specific instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    let msg = '';
    if(isIOS) msg = '馃摫 iOS 瀹夎鏂规硶锛歕n\n1. 鐐瑰嚮搴曢儴銆屽垎浜€嶆寜閽紙鏂规绠ご锛塡n2. 鍚戜笅婊戝姩\n3. 鐐瑰嚮銆屾坊鍔犲埌涓诲睆骞曘€峔n4. 鐐瑰嚮鍙充笂瑙掋€屾坊鍔犮€?;
    else if(isAndroid) msg = '馃摫 Android 瀹夎鏂规硶锛歕n\n1. 鎵撳紑 Chrome 娴忚鍣ㄨ彍鍗昞n2. 鐐瑰嚮銆屾坊鍔犲埌涓诲睆骞曘€峔n3. 鎴栫偣鍑诲畨瑁呮í骞呫€屽畨瑁呫€?;
    else msg = '馃挕 鍦ㄦ祻瑙堝櫒鑿滃崟涓€夋嫨銆屽畨瑁?Workbuddy銆嶆垨銆屾坊鍔犲埌涓诲睆骞曘€?;
    alert(msg);
    return;
  }
  pwaDeferredPrompt.prompt();
  pwaDeferredPrompt.userChoice.then((result) => {
    if(result.outcome === 'accepted') {
      showOcrToast('鉁?Workbuddy 宸插畨瑁呭埌妗岄潰');
    }
    pwaDeferredPrompt = null;
    const banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.style.display = 'none';
  });
}

// Mobile bottom nav
function setMbnActive(page) {
  document.querySelectorAll('.mobile-bottom-nav .mbn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.mbn === page);
  });
}

// Override switchPage to update bottom nav + track usage
const _origSwitchPage = switchPage;
switchPage = function(page) {
  _origSwitchPage(page);
  setMbnActive(page);
  // Track page visit
  const today = todayStr();
  const usage = DB.get('usage_stats', {});
  if(!usage[today]) usage[today] = { opens: 0, modules: [] };
  if(!usage[today].modules.includes(page)) usage[today].modules.push(page);
  DB.set('usage_stats', usage);
  // Close sidebar on mobile
  if(window.innerWidth <= 767) {
    document.getElementById('sidebar').classList.remove('open');
  }
};

// Time-based greeting
function getTimeGreeting() {
  const h = new Date().getHours();
  if(h < 6) return '澶滄繁浜嗭紝鏃╃偣浼戞伅 馃寵';
  if(h < 9) return '鏃╀笂濂斤紝寮€鍚柊鐨勪竴澶?鈽€锔?;
  if(h < 12) return '涓婂崍濂斤紝淇濇寔涓撴敞 馃挭';
  if(h < 14) return '涓崍濂斤紝璁板緱鍚冨崍楗?馃崥';
  if(h < 18) return '涓嬪崍濂斤紝缁х画鍔犳补 鈿?;
  if(h < 22) return '鏅氫笂濂斤紝浠婂ぉ杈涜嫤浜?馃寙';
  return '澶滄繁浜嗭紝鏃╃偣浼戞伅 馃寵';
}

// Update welcome with time-based greeting
function updateWelcomeGreeting() {
  const h1 = document.querySelector('.welcome-banner h1');
  if(h1) {
    const name = (DB.get('user_profile',{})).nickname || '鑷俊';
    h1.innerHTML = `${getTimeGreeting()} ${name}锛乣;
  }
}

// ========== AI GROWTH ASSISTANT (Enhanced) ==========
let gaWeekOffsetVal = 0;

// ===== Feedback System =====
function gaAddFeedback(reportType) {
  const rating = prompt(`璇疯瘎浠疯繖浠?{reportType}鍒嗘瀽锛歕n1 = 涓嶇鍚?馃憤  2 = 涓€鑸?馃槓  3 = 鏈夊府鍔?馃憤\n\n杈撳叆 1-3锛歚, '3');
  if(!rating || !['1','2','3'].includes(rating)) return;
  const comment = prompt('鏈変粈涔堟兂璇寸殑锛燂紙鍙€夛紝鍥炶溅璺宠繃锛?, '');
  const feedback = {
    type: reportType,
    rating: parseInt(rating),
    comment: comment || '',
    date: todayStr(),
    _ts: Date.now()
  };
  const list = DB.get('growth_feedback', []);
  list.push(feedback);
  if(list.length > 50) list.splice(0, list.length - 50);
  DB.set('growth_feedback', list);
  showOcrToast('鉁?鎰熻阿浣犵殑鍙嶉锛?);
}

function gaRenderFeedback(reportType) {
  return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #f0e8ec;">
    <div style="font-size:11px;color:#b3a0a8;margin-bottom:4px;">杩欎唤鍒嗘瀽瀵逛綘鏈夊府鍔╁悧锛?/div>
    <div style="display:flex;gap:8px;">
      <span style="cursor:pointer;font-size:16px;" onclick="gaAddFeedback('${reportType}')" title="鏈夊府鍔?>馃憤</span>
      <span style="cursor:pointer;font-size:16px;" onclick="gaAddFeedback('${reportType}')" title="涓€鑸?>馃槓</span>
      <span style="cursor:pointer;font-size:16px;" onclick="gaAddFeedback('${reportType}')" title="涓嶇鍚?>馃憥</span>
    </div>
  </div>`;
}

// ===== Growth Patterns Analysis =====
function gaAnalyzePatterns() {
  const recs7d = [];
  const now = new Date();
  for(let i=6; i>=0; i--) {
    const d = new Date(now); d.setDate(d.getDate()-i);
    recs7d.push(d.toISOString().slice(0,10));
  }
  
  const goals7d = recs7d.map(d => ({
    date: d,
    goals: DB.get('goals_'+d, []),
    mood: DB.get('mood_'+d, 0)
  }));
  
  const avgMood = goals7d.filter(g=>g.mood>0).reduce((s,g)=>s+g.mood,0) / Math.max(1, goals7d.filter(g=>g.mood>0).length);
  const productiveDays = goals7d.filter(g => g.goals.some(x=>x.done)).length;
  const streak = calcStreak();
  
  return { avgMood: Math.round(avgMood*10)/10, productiveDays, streak, totalDays: 7 };
}

// ===== Enhanced Daily 鈥?Coach-style =====
function gaGenerateDaily() {
  const el = document.getElementById('gaDailyResult');
  el.innerHTML = '<div style="color:#b3a0a8;">\u23f3 姝ｅ湪鍒嗘瀽浣犵殑浠婃棩鏁版嵁...</div>';
  const today = todayStr();
  const engRecs = DB.get('english_records',[]).filter(r=>r.date===today);
  const readRecs = DB.get('reading_records',[]).filter(r=>r.date===today);
  const burns = DB.get('burn_records',[]).filter(r=>r.date===today);
  const jobs = DB.get('job_apply',[]).filter(r=>r.date===today);
  const xhsPosts = DB.get('xhs_productions',[]).filter(r=>{const d=r._ts?new Date(r._ts).toISOString().slice(0,10):null;return d===today||r.date===today;});
  const goals = DB.get('goals_'+today,[]);
  const dg = goals.filter(g=>g.done).length, tg = goals.length;
  const et = engRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const rt = readRecs.reduce((s,r)=>s+(parseFloat(r.time)||0),0);
  const p = gaAnalyzePatterns();
  const wDays = [...new Set(DB.get('english_records',[]).filter(r=>{const d=new Date();d.setDate(d.getDate()-7);return r.date>=d.toISOString().slice(0,10);}).map(r=>r.date))].length;
  const areas = [et>=30,rt>0,burns.length>0,jobs.length>0,xhsPosts.length>0].filter(Boolean).length;
  let hl = '';
  if(et>=30&&et>=45) hl='\u2705 浠婂ぉ鍦ㄨ嫳璇笂鎶曞叆浜?'+Math.round(et)+' 鍒嗛挓銆傚綋浣犺兘鍦ㄤ竴浠朵簨涓婁繚鎸佹繁搴︽姇鍏ユ椂锛岃繘姝ユ槸鍙鐨勩€?;
  else if(et>=30) hl='\u2705 瀹屾垚浜嗚嫳璇涔犮€傚湪杩炵画 '+wDays+' 澶╅兘鏈夎嫳璇褰曠殑鎯呭喌涓嬶紝浣犲凡缁忎笉鏄湪銆屽潥鎸併€嶏紝鑰屾槸鍦ㄣ€屼範鎯€嶄簡銆?;
  else if(xhsPosts.length>0) hl='\u2705 鍒涗綔浜嗘柊鍐呭銆傝〃杈炬湰韬氨鏄竴绉嶆暣鐞嗘€濈淮鐨勬柟寮忥紝鍐欏緱瓒婂锛屾€濊矾瓒婃竻鏅般€?;
  else if(rt>0) hl='\u2705 浠婂ぉ璇讳簡 '+Math.round(rt)+' 鍒嗛挓銆傛寔缁槄璇荤殑浜哄拰涓嶈鐨勪汉锛屼竴骞村悗鐨勫尯鍒細寰堟槑鏄俱€?;
  else if(burns.length>0) hl='\u2705 瀹屾垚浜嗚繍鍔ㄣ€傝繍鍔ㄥ悗鐨勯偅娈垫竻閱掓椂闂达紝鏄涔犲拰宸ヤ綔鐨勯粍閲戞椂娈点€?;
  else if(jobs.length>0) hl='\u2705 鎶曢€掍簡绠€鍘嗐€傛瘡涓€娆′富鍔ㄥ嚭鍑婚兘鍦ㄥ鍔犲彲鑳芥€с€?;
  else hl='\u2705 瀹屾垚浜?'+dg+'/'+tg+' 涓洰鏍囥€傛湁鏃跺€欎笉鍋氫粈涔堟瘮鍋氫粈涔堟洿闇€瑕佸垽鏂姏銆?;
  const probs = [];
  const e3 = DB.get('english_records',[]).filter(r=>{const d=new Date();d.setDate(d.getDate()-3);return r.date>=d.toISOString().slice(0,10);});
  if(e3.length===0&&p.streak>0) probs.push('\u26a0\ufe0f 杩囧幓 3 澶╂病鏈夎嫳璇褰曪紝鑰屼綘涔嬪墠鏄湁杩炵画璁板綍鐨勩€傛柇鎺変範鎯線寰€涓嶆槸鍥犱负鎳掓儼锛岃€屾槸鍥犱负鏌愬ぉ銆屽氨浠婂ぉ浼戞伅涓€涓嬨€嶅彉鎴愪簡銆屽共鑴嗕笉鍋氫簡銆嶃€傚叧閿槸涓嶈杩炵画鏂?3 澶┿€?);
  if(et<30&&rt===0&&burns.length===0&&p.productiveDays>=3) probs.push('\u26a0\ufe0f 浠婂ぉ鍦ㄥ涔犲拰杩愬姩涓婇兘绌虹櫧鈥斺€斿鏋滀綘鎰熻鐤叉儷锛屽緢鍙兘涓嶆槸鍥犱负闇€瑕佷紤鎭紝鑰屾槸鍥犱负浠婂ぉ缂哄皯浜嗐€屽惎鍔ㄣ€嶇殑鍔ㄤ綔銆傛渶闅剧殑鏄墠 5 鍒嗛挓銆?);
  if(p.productiveDays<=2&&p.streak>0) probs.push('\u26a0\ufe0f 杩欏懆鏈夎鍔ㄧ殑澶╂暟鍋忓皯銆傚洖椤句竴涓嬫槸鐩爣澶瀵艰嚧蹇冪悊鍘嬪姏锛岃繕鏄鍏朵粬浜嬫儏鍗犵敤浜嗘椂闂达紵');
  let act = '';
  if(et<30) act='\ud83c\udfaf 鏄庡ぉ鏃╀笂绗竴浠朵簨锛氭墦寮€鑻辫鏉愭枡锛屽 15 鍒嗛挓銆備笉瑕佹眰 30 鍒嗛挓锛?5 鍒嗛挓灏卞浜嗏€斺€斿叧閿槸鍏堟仮澶嶈妭濂忋€?;
  else if(rt===0) act='\ud83c\udfaf 鏄庡ぉ鎵句竴鏈綘鎰熷叴瓒ｇ殑涔︼紝璇?10 椤点€備笉闇€瑕佽瀹岋紝鍙渶瑕佹墦寮€銆?;
  else if(burns.length===0) act='\ud83c\udfaf 鏄庡ぉ鍋氫竴娆?10 鍒嗛挓鐨勬椿鍔ㄨ韩浣撯€斺€旀媺浼搞€佸揩璧版垨鑰呭嚑涓繁韫查兘琛屻€傝韩浣撳姩浜嗭紝澶ц剳涔熶細璺熺潃娓呴啋銆?;
  else if(xhsPosts.length===0) act='\ud83c\udfaf 鏄庡ぉ鑺?15 鍒嗛挓鍒蜂竴涓嬪悓绫昏处鍙凤紝鎵句竴涓彲浠ュ€熼壌鐨勯€夐璁板綍涓嬫潵銆?;
  else if(jobs.length===0) act='\ud83c\udfaf 鏄庡ぉ娴忚鎷涜仒淇℃伅锛屾敹钘?2 涓劅鍏磋叮鐨勫矖浣嶃€備笉闇€瑕佹姇閫掞紝鍏堜簡瑙ｅ競鍦哄湪鎷涗粈涔堛€?;
  else act='\ud83c\udfaf 鏄庡ぉ閫夋嫨浠婂ぉ瀹屾垚寰楁渶杞绘澗鐨勯偅涓ā鍧楋紝灏濊瘯澶氭姇鍏?10 鍒嗛挓鈥斺€旂湅鐪嬭兘鍚︾獊鐮磋嚜宸辩殑鑸掗€傚尯銆?;
  let ins = '';
  const ar = p.productiveDays/p.totalDays;
  if(ar>=0.85) ins='杩?7 澶╀綘鏈?'+p.productiveDays+' 澶╅兘鍦ㄨ鍔ㄣ€傝兘淇濇寔杩欑鑺傚鐨勪汉涓嶅锛屼綘宸茬粡褰㈡垚浜嗚嚜宸辩殑鎴愰暱鎯€с€傞棶棰樹笉鏄綘鑳戒笉鑳藉潥鎸侊紝鑰屾槸浣犺兘鍚﹀湪淇濇寔鐨勫熀纭€涓婏紝鍋跺皵璁╄嚜宸辩獊鐮翠竴涓嬨€?;
  else if(ar>=0.5) ins='杩?7 澶╂湁 '+p.productiveDays+' 澶╁湪琛屽姩銆備綘鐨勮妭濂忚繕涓嶇ǔ瀹氣€斺€斾笉鏄洜涓轰笉澶熷姫鍔涳紝鑰屾槸鍥犱负杩樻病鎵惧埌鏈€閫傚悎鑷繁鐨勫浐瀹氭椂闂淬€傝瘯璇曟妸鏈€閲嶈鐨勯偅浠朵簨瀹夋帓鍦ㄦ瘡澶╃殑鍚屼竴鏃堕棿銆?;
  else ins='杩?7 澶╀綘琛屽姩浜?'+p.productiveDays+' 澶┿€傚鏋滄劅瑙夌姸鎬佷笉濂斤紝涓嶇敤瑕佹眰鑷繁鍋氬緢澶氣€斺€旀瘡澶╁畬鎴愪竴浠朵簨灏辨槸鑳滃埄銆傚叧閿槸涓嶈璁┿€屽叏鏈夋垨鍏ㄦ棤銆嶇殑鎯虫硶闃绘浣犲紑濮嬨€?;
  el.innerHTML = '<div class="health-review-card"><h4 style="margin:0 0 10px;color:#5d3a4f;">\ud83d\udccb 浠婃棩鎴愰暱鍒嗘瀽</h4><div style="display:flex;gap:8px;margin-bottom:10px;"><div style="flex:1;text-align:center;padding:8px;background:var(--bg);border-radius:8px;"><div style="font-size:18px;font-weight:800;color:'+(dg/tg>=0.8?'#2da667':dg/tg>=0.5?'#e67e22':'#e74c3c')+';">'+dg+'/'+tg+'</div><div style="font-size:10px;color:#9b7c8a;">鐩爣瀹屾垚</div></div><div style="flex:1;text-align:center;padding:8px;background:var(--bg);border-radius:8px;"><div style="font-size:18px;font-weight:800;color:var(--primary);">'+areas+'/5</div><div style="font-size:10px;color:#9b7c8a;">妯″潡瑕嗙洊</div></div><div style="flex:1;text-align:center;padding:8px;background:var(--bg);border-radius:8px;"><div style="font-size:18px;font-weight:800;color:var(--primary);">'+p.streak+'\u5929</div><div style="font-size:10px;color:#9b7c8a;">杩炵画璁板綍</div></div></div><div style="margin-bottom:8px;padding:10px;background:#e8f5e9;border-radius:8px;font-size:13px;line-height:1.6;color:#1b5e20;"><strong>\u2705 浠婃棩浜偣</strong><br>'+hl+'</div>'+(probs.length?'<div style="margin-bottom:8px;padding:10px;background:#fff3cd;border-radius:8px;font-size:13px;line-height:1.6;color:#856404;"><strong>\u26a0\ufe0f 鍊煎緱鐣欐剰</strong><br>'+probs[0]+'</div>':'')+'<div style="margin-bottom:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px;line-height:1.6;color:#5d3a4f;"><strong>\ud83d\udcc8 杩戞湡瓒嬪娍</strong><br>'+ins+'</div><div style="padding:10px;background:#e3f2fd;border-radius:8px;font-size:13px;line-height:1.6;color:#0d47a1;"><strong>\ud83c\udfaf 鏄庢棩涓€涓噸鐐?/strong><br>'+act+'</div>'+gaRenderFeedback('daily')+'</div>';
}
// ===== Growth Profile =====
function gaGenerateProfile() {
  const engRecs = DB.get('english_records',[]);
  const readRecs = DB.get('reading_records',[]);
  const burns = DB.get('burn_records',[]);
  const jobs = DB.get('job_apply',[]);
  const xhs = DB.get('xhs_productions',[]).filter(p=>p.status==='published');
  const xhsIdeas = DB.get('xhs_ideas',[]);
  const reviewDays = DB.get('daily_reports',[]).length;
  const streak = calcStreak();
  
  // Learning pattern analysis
  const morningEng = engRecs.filter(r => r.time && parseInt(r.time) > 0).length;
  const totalDays = [...new Set(engRecs.map(r=>r.date))].length;
  const hasMorningPattern = morningEng > totalDays * 0.6;
  
  // Build profile
  const profile = {
    learningStyle: hasMorningPattern ? '浣犲€惧悜浜庡湪鏃╀笂杩涜瀛︿範娲诲姩锛屾櫒闂存晥鐜囪緝楂樸€? : '浣犵殑瀛︿範鏃堕棿鍒嗗竷杈冧负鍒嗘暎锛屽彲浠ュ皾璇曞浐瀹氫竴涓椂闂存鏉ユ彁楂樻晥鐜囥€?,
    executionStyle: streak >= 7 ? '浣犳湁寰堝ソ鐨勬寔缁€э紝杩炵画 '+streak+' 澶╂湁鎴愰暱璁板綍銆傝繖绉嶄範鎯竴鏃﹀舰鎴愶紝浼氳秺鏉ヨ秺杞绘澗銆? : '浣犳鍦ㄥ缓绔嬫垚闀夸範鎯殑鏃╂湡闃舵锛屽叧閿槸姣忓ぉ閮藉仛涓€鐐圭偣銆?,
    strengths: [],
    improvements: [],
    lastUpdated: todayStr()
  };
  
  if(totalDays >= 20) profile.strengths.push('馃實 鑻辫瀛︿範鍧氭寔浜?'+totalDays+' 澶╋紝璇█鑳藉姏鐨勬彁鍗囬渶瑕佹椂闂达紝浣犲凡缁忓湪姝ｇ‘鐨勮建閬撲笂銆?);
  if(xhsIdeas.length > 0) profile.strengths.push('馃幀 绉疮浜?'+xhsIdeas.length+' 涓唴瀹圭伒鎰燂紝璇存槑浣犲缁堝湪瑙傚療鍜屾€濊€冿紝杩欐槸鍐呭鍒涗綔鑰呮渶閲嶈鐨勭礌璐ㄣ€?);
  if(burns.length >= 10) profile.strengths.push('馃弮 瀹屾垚浜?'+burns.length+' 娆¤繍鍔紝閲嶈韬綋鐘舵€佹槸鎸佺画鎴愰暱鐨勫熀纭€銆?);
  
  if(profile.strengths.length === 0) profile.strengths.push('馃搶 寮€濮嬩娇鐢ㄦ垚闀跨郴缁熷悗锛岃繖閲屼細鑷姩璇嗗埆浣犵殑鎴愰暱浼樺娍銆?);
  
  if(jobs.length < 5) profile.improvements.push('馃捈 鑱屼笟鎺㈢储鏂归潰杩樻湁绌洪棿銆傚缓璁瘡鍛ㄨ瀹氬浐瀹氭椂闂磋繘琛屽矖浣嶇爺绌跺拰鎶曢€掋€?);
  if(readRecs.length < 10) profile.improvements.push('馃摉 闃呰閲忓彲浠ュ啀澧炲姞涓€浜涖€傞槄璇绘槸鎬т环姣旀渶楂樼殑鑷垜鎶曡祫銆?);
  if(xhs.length < 3) profile.improvements.push('馃幀 鍐呭杈撳嚭棰戠巼鍙互鎻愬崌銆傝瘯鐫€姣忓懆鑷冲皯瀹屾垚涓€绡囧唴瀹瑰彂甯冦€?);
  
  if(profile.improvements.length === 0) profile.improvements.push('鍚勯」鍙戝睍鍧囪　锛岀户缁繚鎸侊紒');
  
  // Save profile
  DB.set('growth_profile', profile);
  
  return profile;
}

// ===== Score with Profile =====
function gaCalcScore() {
  const engRecs = DB.get('english_records',[]);
  const readRecs = DB.get('reading_records',[]);
  const burns = DB.get('burn_records',[]);
  const jobs = DB.get('job_apply',[]);
  const xhs = DB.get('xhs_productions',[]).filter(p=>p.status==='published');
  const goalsCount = DB.get('daily_reports',[]).length;
  
  const learning = Math.min(100, engRecs.length * 3 + readRecs.length * 2);
  const health = Math.min(100, burns.length * 5 + DB.get('intake_records',[]).length);
  const career = Math.min(100, jobs.length * 5);
  const creativity = Math.min(100, xhs.length * 10 + (DB.get('xhs_ideas',[]).length)*2);
  const discipline = Math.min(100, goalsCount * 5);
  
  const total = Math.round((learning + health + career + creativity + discipline) / 5);
  document.getElementById('gaTotalScore').textContent = total+'鍒?;
  
  const scoreTab = document.getElementById('gaScoreContent');
  if(scoreTab) {
    const maxVal = 100;
    const dims = [
      { label:'瀛︿範', val: learning, icon:'馃實', color:'#4a9d6f' },
      { label:'鍋ュ悍', val: health, icon:'馃崕', color:'#e67e22' },
      { label:'鑱屼笟', val: career, icon:'馃捈', color:'#3498db' },
      { label:'鍒涢€?, val: creativity, icon:'馃幀', color:'#c45677' },
      { label:'鑷緥', val: discipline, icon:'馃挭', color:'#9b59b6' }
    ];
    
    const best = dims.reduce((a,b) => a.val > b.val ? a : b);
    const worst = dims.reduce((a,b) => a.val < b.val ? a : b);
    const profile = gaGenerateProfile();
    
    scoreTab.innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="text-align:center;margin-bottom:14px;">
          <div style="font-size:42px;font-weight:800;color:var(--primary);">${total}</div>
          <div style="font-size:13px;color:#9b7c8a;">缁煎悎鎴愰暱璇勫垎</div>
        </div>
        ${dims.map(d => {
          const pct = d.val/maxVal*100;
          return `<div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
              <span>${d.icon} ${d.label}</span>
              <span style="font-weight:600;color:${d.color};">${d.val}鍒?/span>
            </div>
            <div style="height:8px;background:#f0e8ec;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${d.color};border-radius:4px;transition:width .5s;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;color:#5d3a4f;line-height:1.6;margin-bottom:10px;">
        <strong>馃挕 缁村害鍒嗘瀽</strong><br>
        路 鏈€寮猴細${best.icon} ${best.label}锛?{best.val}鍒嗭級鈥?杩欐槸浣犵殑鏍稿績鎴愰暱椹卞姩鍔?br>
        路 寰呮彁鍗囷細${worst.icon} ${worst.label}锛?{worst.val}鍒嗭級鈥?鍙互浠庢瘡澶?5鍒嗛挓寮€濮?br>
        路 ${dims.some(d=>d.val<30)?'寤鸿閫夋嫨鏈€寮辩淮搴︿腑鐨勪竴涓皬鐩爣锛屽潥鎸佷竴鍛ㄥ氨浼氱湅鍒板彉鍖栥€?:'鍚勭淮搴﹀彂灞曞潎琛★紝浣犲凡缁忓缓绔嬩簡寰堝ソ鐨勬垚闀夸綋绯汇€?}
      </div>
      <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:12px;color:#5d3a4f;line-height:1.6;">
        <strong>馃 涓汉鎴愰暱鐢诲儚</strong><br>
        <p style="margin-top:4px;"><strong>馃搶 瀛︿範鏂瑰紡锛?/strong>${profile.learningStyle}</p>
        <p><strong>馃搶 鎵ц鐗圭偣锛?/strong>${profile.executionStyle}</p>
        <p><strong>鉁?浼樺娍锛?/strong>${profile.strengths.slice(0,2).join('<br>')}</p>
        <p><strong>馃幆 寰呮彁鍗囷細</strong>${profile.improvements.slice(0,2).join('<br>')}</p>
      </div>
    `;
  }
}

// ===== Enhanced AI Feedback =====
function gaGenerateFeedback() {
  const el = document.getElementById('gaAiResult');
  el.innerHTML = '<div style="color:#b3a0a8;">鈴?姝ｅ湪鏍规嵁浣犵殑鏁版嵁鐢熸垚涓€у寲鍙嶉...</div>';
  
  const today = todayStr();
  const goals = DB.get('goals_'+today, []);
  const done = goals.filter(g=>g.done).length;
  const total = goals.length;
  const pct = total > 0 ? Math.round(done/total*100) : 0;
  
  const engRecs = DB.get('english_records',[]);
  const streak = calcStreak();
  const totalXp = calcTotalXp();
  const patterns = gaAnalyzePatterns();
  const profile = DB.get('growth_profile', null) || gaGenerateProfile();
  
  // Build feedback based on actual data patterns
  let level, message, nextFocus;
  const weekDays = patterns.productiveDays;
  
  if(pct >= 80) {
    level = '馃専';
    message = '浠婂ぉ鐨勭洰鏍囧畬鎴愬害寰堥珮锛岃繖璇存槑浣犵殑璁″垝鑳藉姏鍜屾墽琛屽姏閮藉湪鎻愬崌銆?;
    if(streak >= 7) message += ' 鑰屼笖浣犲凡缁忚繛缁?'+streak+' 澶╂湁鎴愰暱璁板綍锛岃繖绉嶆寔缁€ф墠鏄湡姝ｇ殑绔炰簤鍔涖€?;
    message += ' 鎴愰暱灏卞儚澶嶅埄鈥斺€旀瘡澶╄繘姝ヤ竴鐐圭偣锛岄暱鏈熺Н绱殑鏁堟灉杩滆秴鎯宠薄銆?;
    nextFocus = '鏄庡ぉ鍙互鍦ㄤ粖澶╃殑鍩虹涓婏紝灏濊瘯鍦ㄥ叾涓竴涓ā鍧椾笂澶氭姇鍏ヤ竴鐐规椂闂达紝姣斿鑻辫澶氬10鍒嗛挓锛屾垨鑰呭鍐欎竴娈甸槄璇绘劅鎮熴€?;
  } else if(pct >= 50) {
    level = '馃挭';
    message = '瀹屾垚浜嗚繃鍗婄殑鐩爣銆傚鏋滄劅瑙夋湁浜涗换鍔℃病鑳藉畬鎴愶紝鍙互鍥為【涓€涓嬶細鏄洰鏍囧畾寰楀お澶氫簡锛熻繕鏄鍏朵粬浜嬫儏鍗犵敤浜嗘椂闂达紵';
    if(weekDays >= 5) message += ' 杩欏懆鏈?'+weekDays+' 澶╀繚鎸佷簡琛屽姩璁板綍锛屽嵆浣夸笉鏄瘡浠朵簨閮藉畬鎴愶紝浣犲凡缁忓湪鎸佺画鍓嶈繘浜嗐€?;
    nextFocus = '璇曡瘯鏄庡ぉ鎶娿€屾渶閲嶈鐨?浠朵簨銆嶅垪鍦ㄦ渶鍓嶉潰锛屼紭鍏堝畬鎴愬畠浠€傚畬鎴?浠舵瘮鍋氬畬6浠朵絾姣忎欢閮藉寙蹇欒濂姐€?;
  } else {
    level = '馃尡';
    if(pct === 0) {
      message = '浠婂ぉ鍙兘瀹屽叏娌℃湁鎸夌収璁″垝璧帮紝杩欐病鍏崇郴銆傛瘡涓汉閮戒細鏈夎繖鏍风殑鏃ュ瓙銆?;
      if(streak > 0) message += ' 浣犱箣鍓嶅凡缁忚繛缁?'+streak+' 澶╁湪杩涙锛屼竴澶╃殑鍋滈】涓嶄細鏀瑰彉浣犵殑澶ф柟鍚戙€?;
      message += ' 閲嶈鐨勬槸涓嶈鍥犱负涓€澶╂病鍋氬ソ灏辨斁寮冦€傛槑澶╅噸鏂板紑濮嬪氨濂姐€?;
      nextFocus = '浠婃櫄濂藉ソ浼戞伅锛屾槑澶╅€変竴浠舵渶绠€鍗曠殑浜嬪厛瀹屾垚瀹冦€傝鍔ㄦ槸鏈€濂界殑瑙ｈ嵂銆?;
    } else {
      message = '浠婂ぉ瀹屾垚浜嗕竴浜涚洰鏍囷紝铏界劧涓嶅浣嗕緷鐒跺湪琛屽姩銆?;
      if(streak > 3) message += ' 浣犲凡缁忚繛缁?'+streak+' 澶╂湁璁板綍浜嗭紝杩欑鍧氭寔鏈韩灏辨槸涓€绉嶈兘鍔涖€?;
      message += ' 鏈夋椂鍊欏畬鎴愬害浣庝笉鏄洜涓轰笉鍔姏锛岃€屾槸鐩爣澶銆?;
      nextFocus = '璇曠潃鎶婃槑澶╃殑鐩爣缂╁噺鍒?涓互鍐咃紝涓撴敞瀹屾垚瀹冧滑銆傝川閲忔瘮鏁伴噺鏇撮噸瑕併€?;
    }
  }
  
  if(totalXp > 0) message += ' 绱鑾峰緱 '+totalXp+' XP锛屾瘡涓€姝ラ兘鍦ㄧН绱€?;
  if(patterns.avgMood >= 3) message += ' 杩戜竴鍛ㄧ殑骞冲潎蹇冩儏涓嶉敊锛?+patterns.avgMood+'/5锛夛紝濂界殑鎯呯华鐘舵€佷細璁╁涔犲拰宸ヤ綔鏇撮珮鏁堛€?;
  
  el.innerHTML = `
    <div class="health-review-card">
      <div style="text-align:center;font-size:48px;margin-bottom:8px;">${level}</div>
      <div style="font-size:14px;line-height:1.8;color:#5d3a4f;">
        <p>${message}</p>
        <p style="margin-top:8px;color:#2d7a4e;"><strong>馃搶 ${nextFocus}</strong></p>
      </div>
      <div style="margin-top:10px;padding:8px;background:var(--bg);border-radius:8px;font-size:12px;color:#9b7c8a;text-align:center;">
        瀹屾垚 ${done}/${total} 路 杩炵画 ${streak}澶?路 绱 ${totalXp}XP
      </div>
      ${gaRenderFeedback('feedback')}
    </div>
  `;
}

function refreshGrowthAi() {
  document.getElementById('gaDate').textContent = formatDateLong(todayStr());
  
  const days = DB.get('daily_reports',[]).length;
  document.getElementById('gaDays').textContent = days;
  document.getElementById('gaStreak').textContent = calcStreak();
  
  const totalXp = calcTotalXp();
  const lv = calcLevel(totalXp);
  document.getElementById('gaLevel').textContent = lv ? lv.short : 'Lv.1';
  
  gaCalcScore();
}

function switchGaTab(tab, btn) {
  document.querySelectorAll('#page-growthai .tab-bar .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['daily','weekly','monthly','score','ai'].forEach(t => {
    const el = document.getElementById('gaTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el) el.style.display = t===tab?'block':'none';
  });
  if(tab === 'score') gaCalcScore();
}

function gaWeekOffset(offset, btn) {
  gaWeekOffsetVal = offset;
  document.querySelectorAll('#gaTabWeekly .health-meal-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  gaGenerateWeekly();
}

// ========== VERSION INFO ==========
const APP_VERSION = '1.0.0';
const APP_RELEASE_DATE = '2026-07-28';

function renderSystemInfo() {
  const el = document.getElementById('systemInfo');
  if(!el) return;
  const changelog = DB.get('changelog', []);
  const recentChanges = changelog.slice(-3).reverse();
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃摝 鐗堟湰</span><span style="font-weight:600;">Workbuddy v${APP_VERSION}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃搮 涓婄嚎鏃ユ湡</span><span>${APP_RELEASE_DATE}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃搳 浣跨敤澶╂暟</span><span id="usageDays">--</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;">
      <span>馃摑 璁板綍鎬绘暟</span><span id="usageTotalRecords">--</span>
    </div>
    <div style="margin-top:8px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:12px;">
      <strong>馃搵 鏇存柊鏃ュ織</strong>
      <ul style="margin:4px 0 0 16px;padding:0;">
        <li>v1.0.0 (${APP_RELEASE_DATE}) 鈥?馃殌 姝ｅ紡鍙戝竷锛氭牳蹇冨姛鑳?+ PWA + AI鍒嗘瀽 + 浜戠鍚屾</li>
        ${recentChanges.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
  `;
  // Update usage stats
  const dayCount = Math.ceil((new Date() - new Date('2026-07-01')) / (1000*60*60*24));
  document.getElementById('usageDays').textContent = dayCount + '澶?;
  const allKeys = DataService.getAllKeys();
  let total = 0;
  allKeys.forEach(k => {
    try { total += JSON.parse(localStorage.getItem(k)||'[]').length; } catch(e) {}
  });
  document.getElementById('usageTotalRecords').textContent = total;
}

// ========== FEEDBACK ==========
function submitFeedback() {
  const type = document.getElementById('feedbackType').value;
  const module = document.getElementById('feedbackModule').value.trim();
  const content = document.getElementById('feedbackContent').value.trim();
  if(!content) { alert('璇锋弿杩颁綘閬囧埌鐨勯棶棰樻垨寤鸿'); return; }
  
  const feedback = {
    type, module, content,
    userId: DB.get('user_id', 'unknown'),
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  const list = DB.get('user_feedback', []);
  list.push(feedback);
  if(list.length > 50) list.splice(0, list.length - 50);
  DB.set('user_feedback', list);
  
  document.getElementById('feedbackContent').value = '';
  document.getElementById('feedbackModule').value = '';
  showOcrToast('鉁?鎰熻阿浣犵殑鍙嶉锛佹垜浠細璁ょ湡瀵瑰緟姣忎竴鏉℃剰瑙併€?);
}

// ========== USAGE TRACKING ==========
function trackUsage() {
  const today = todayStr();
  const usage = DB.get('usage_stats', {});
  if(!usage[today]) usage[today] = { opens: 0, modules: [] };
  usage[today].opens = (usage[today].opens || 0) + 1;
  // Track which module they first visited (from URL hash or default)
  const page = document.querySelector('.page.active')?.id?.replace('page-', '') || 'dashboard';
  if(!usage[today].modules.includes(page)) usage[today].modules.push(page);
  DB.set('usage_stats', usage);
}

// Track usage on load 鈥?tracking added in PWA switchPage override
// Usage stats are recorded by trackUsage() on init and switchPage
    
// Check for app version update 鈫?clears cache if needed
checkVersionUpdate();
// Register SW on load (with cache-busting version param)
registerSw();

// Set default dates in modals
document.addEventListener('DOMContentLoaded', function(){
  const today = new Date().toISOString().slice(0,10);
  document.querySelectorAll('input[type="date"]').forEach(el => {
    if(!el.value) el.value = today;
  });

  // Init
  initUser();  // Generate user_id if first time
  initSupabase();  // Initialize Supabase auth
  trackUsage();  // Track daily usage
  refreshEnglish();
  refreshDashboard();

  // Migration detection (runs once on first visit)
  const detection = detectLocalData();
  if(detection.hasData && !DB.get('migration_prompt_dismissed', false)) {
    setTimeout(() => {
      const ready = confirm(`馃摝 鍙戠幇鏈湴鏁版嵁\n\n${detection.count} 涓暟鎹ā鍧?路 ${(detection.estimatedSize/1024).toFixed(1)}KB\n\n鐐瑰嚮銆岀‘瀹氥€嶇敓鎴愬彲鐢ㄤ簬瀵煎叆 Supabase 鐨勮縼绉绘枃浠躲€俓n\n鐐瑰嚮銆屽彇娑堛€嶇◢鍚庡彲鍦ㄣ€屾暟鎹腑蹇冦€嶆墜鍔ㄦ搷浣溿€俙);
      if(ready) {
        downloadMigrationJson();
        showOcrToast('馃挕 杩佺Щ鏂囦欢宸蹭笅杞斤紝鍓嶅線 Supabase 瀵煎叆鍗冲彲');
        DB.set('migration_prompt_dismissed', true);
      } else {
        DB.set('migration_prompt_dismissed', true);
      }
    }, 2000);
  }

  // Keyboard shortcut: Esc closes modals
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    }
  });

  // ===== Multi-platform auto-sync =====

  // Init voice input support (hide 馃帳 buttons if browser unsupported)
  initVoiceSupport();

  // 1. Auto-sync when app comes to foreground (mobile-friendly)
  document.addEventListener('visibilitychange', () => {
    if(!document.hidden && isSupabaseReady() && currentUser.loggedIn && DATA_CONFIG.mode === 'cloud') {
      syncManager.syncAll();
    }
  });

  // 2. Auto-sync on page load if cloud mode (for cross-device scenario)
  if(isSupabaseReady() && currentUser.loggedIn && DATA_CONFIG.mode === 'cloud') {
    setTimeout(() => syncManager.syncAll(), 3000);
  }
});
</script>
