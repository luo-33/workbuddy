# Workbuddy 数据库 Schema 设计文档

> 目标数据库：Supabase / PostgreSQL  
> 设计版本：v1.0.0  
> 设计日期：2026-07-28  
> 当前数据源：localStorage → 迁移至云数据库

---

## 一、数据库表总览

| # | 表名 | 中文名 | 所属模块 | 数据来源 |
|---|------|--------|---------|---------|
| 1 | `users` | 用户表 | 用户系统 | user_id + user_profile |
| 2 | `profiles` | 用户资料表 | 用户系统 | user_profile |
| 3 | `daily_plans` | 每日计划表 | Dashboard | goals_{date} |
| 4 | `english_records` | 英语学习记录 | 英语成长 | english_records |
| 5 | `nce_records` | 新概念文章学习 | 英语成长 | eng_articles |
| 6 | `ai_tools` | AI工具库 | AI技能 | ai_tools |
| 7 | `ai_tasks` | AI任务实践 | AI技能 | ai_tasks + ai_flows |
| 8 | `job_records` | 求职投递记录 | 求职管理 | job_apply + job_preps |
| 9 | `interview_records` | 面试记录 | 求职管理 | job_interview + job_reviews |
| 10 | `reading_records` | 阅读记录 | 阅读计划 | reading_records + read_notes |
| 11 | `knowledge_cards` | 知识卡片 | 阅读计划 | knowledge_cards |
| 12 | `wechat_articles` | 公众号文章 | 公众号创作 | wechat_articles |
| 13 | `xhs_records` | 小红书运营记录 | 小红书运营 | xhs_productions + xhs_ideas + xhs_virals |
| 14 | `health_records` | 健康总览 | 健康管理 | body_state_ + steps_ |
| 15 | `nutrition_records` | 饮食记录 | 健康管理 | intake_records |
| 16 | `exercise_records` | 运动记录 | 健康管理 | burn_records |
| 17 | `finance_records` | 财务流水 | 财务管理 | fin_income + fin_expense |
| 18 | `weekly_reviews` | 周复盘 | 周复盘 | weekly_ |
| 19 | `monthly_reviews` | 月复盘 | 月复盘 | monthly_archive_ |
| 20 | `achievements` | 成就里程碑 | 成就系统 | milestones + future_plans |

---

## 二、建表 SQL（PostgreSQL）

### 2.1 用户系统

#### `users`
```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname        VARCHAR(100) NOT NULL DEFAULT '用户',
  email           VARCHAR(255) UNIQUE,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 字段说明
COMMENT ON COLUMN users.id IS '用户唯一ID（UUID）';
COMMENT ON COLUMN users.nickname IS '用户昵称';
COMMENT ON COLUMN users.email IS '邮箱（用于登录）';
COMMENT ON COLUMN users.avatar_url IS '头像URL';
```

#### `profiles`
```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  career          VARCHAR(200),
  goal            VARCHAR(200),
  long_goal       TEXT,
  bio             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

COMMENT ON TABLE profiles IS '用户个人资料';
COMMENT ON COLUMN profiles.career IS '当前职业，如：2026届毕业生';
COMMENT ON COLUMN profiles.goal IS '目标方向，如：新媒体运营';
COMMENT ON COLUMN profiles.long_goal IS '长期目标，如：独立运营品牌内容+个人IP';
```

---

### 2.2 每日计划

#### `daily_plans`
```sql
CREATE TABLE daily_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  goal_text       TEXT NOT NULL,
  is_done         BOOLEAN NOT NULL DEFAULT FALSE,
  mood_score      SMALLINT CHECK (mood_score >= 1 AND mood_score <= 5),
  daily_note      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, plan_date, goal_text)
);

CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, plan_date);

COMMENT ON TABLE daily_plans IS '每日计划与目标';
COMMENT ON COLUMN daily_plans.mood_score IS '心情评分 1-5';
```

---

### 2.3 英语成长

#### `english_records`
```sql
CREATE TABLE english_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  article_title   VARCHAR(300),
  duration_min    SMALLINT NOT NULL DEFAULT 0,
  new_words       TEXT,
  phrases         TEXT,
  speaking_min    SMALLINT DEFAULT 0,
  note            TEXT,
  ai_summary      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_english_records_user_date ON english_records(user_id, record_date);

COMMENT ON TABLE english_records IS '英语日常学习记录';
COMMENT ON COLUMN english_records.new_words IS '新词，逗号分隔';
COMMENT ON COLUMN english_records.phrases IS '重点表达，逗号分隔';
```

#### `nce_records`
```sql
CREATE TABLE nce_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  book_name       VARCHAR(100) NOT NULL,
  original_text   TEXT,
  study_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'learning'
                    CHECK (status IN ('learning', 'mastered')),
  words_json      JSONB,
  phrases_json    JSONB,
  grammar_json    JSONB,
  review_3d       DATE,
  review_7d       DATE,
  review_30d      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nce_records_user_id ON nce_records(user_id);

COMMENT ON TABLE nce_records IS '新概念英语文章学习';
COMMENT ON COLUMN nce_records.words_json IS '生词列表：[{word, phonetic, cn, example, mastery}]';
COMMENT ON COLUMN nce_records.phrases_json IS '表达列表：[{en, cn, scene}]';
COMMENT ON COLUMN nce_records.grammar_json IS '语法分析：[{title, desc}]';
```

---

### 2.4 AI技能

#### `ai_tools`
```sql
CREATE TABLE ai_tools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  category        VARCHAR(50) NOT NULL
                    CHECK (category IN ('内容创作类', '数据分析类', '自动化类', '新媒体运营类')),
  core_function   TEXT,
  use_scene       TEXT,
  mastery_level   SMALLINT NOT NULL DEFAULT 1 CHECK (mastery_level >= 1 AND mastery_level <= 5),
  next_step       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_tools_user_id ON ai_tools(user_id);

COMMENT ON TABLE ai_tools IS 'AI工具库';
COMMENT ON COLUMN ai_tools.mastery_level IS '1=初学 2=入门 3=熟练 4=精通 5=专家';
```

#### `ai_tasks`
```sql
CREATE TABLE ai_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_name       VARCHAR(300) NOT NULL,
  tool_used       VARCHAR(200),
  prompt_text     TEXT,
  ai_output       TEXT,
  final_result    TEXT,
  efficiency      VARCHAR(100),
  review          TEXT,
  task_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_tasks_user_date ON ai_tasks(user_id, task_date);

COMMENT ON TABLE ai_tasks IS 'AI任务实践（含工作流）';
```

---

### 2.5 求职管理

#### `job_records`
```sql
CREATE TABLE job_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company         VARCHAR(200) NOT NULL,
  position        VARCHAR(200) NOT NULL,
  apply_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'interview', 'offer', 'reject')),
  jd_description  TEXT,
  resume_version  VARCHAR(100),
  prep_notes      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_records_user_status ON job_records(user_id, status);

COMMENT ON TABLE job_records IS '求职投递记录';
```

#### `interview_records`
```sql
CREATE TABLE interview_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_record_id   UUID REFERENCES job_records(id) ON DELETE SET NULL,
  company         VARCHAR(200) NOT NULL,
  position        VARCHAR(200),
  interview_date  DATE NOT NULL,
  round           VARCHAR(50),
  result          VARCHAR(20) CHECK (result IN ('pass', 'fail', 'pending')),
  feeling         TEXT,
  questions       TEXT,
  answers         TEXT,
  weakness        TEXT,
  self_rate       SMALLINT CHECK (self_rate >= 1 AND self_rate <= 5),
  ai_analysis     TEXT,
  next_step       TEXT,
  audio_file_url  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_user_date ON interview_records(user_id, interview_date);

COMMENT ON TABLE interview_records IS '面试记录与复盘';
```

---

### 2.6 阅读计划

#### `reading_records`
```sql
CREATE TABLE reading_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_name       VARCHAR(300) NOT NULL,
  book_author     VARCHAR(200),
  book_tag        VARCHAR(50),
  read_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  chapter         VARCHAR(200),
  duration_min    SMALLINT DEFAULT 0,
  pages           SMALLINT,
  note_type       VARCHAR(20) CHECK (note_type IN ('summary', 'opinion', 'quote', 'value', 'action')),
  content         TEXT,
  key_point       TEXT,
  favorite_quote  TEXT,
  understanding   TEXT,
  ai_summary      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reading_user_date ON reading_records(user_id, read_date);

COMMENT ON TABLE reading_records IS '阅读记录（含书籍库+笔记）';
COMMENT ON COLUMN reading_records.book_tag IS '分类标签：个人成长/商业/新媒体/心理学/文学/工具书';
```

#### `knowledge_cards`
```sql
CREATE TABLE knowledge_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic           VARCHAR(200) NOT NULL,
  card_type       VARCHAR(20) NOT NULL
                    CHECK (card_type IN ('观点', '金句', '方法')),
  content         TEXT NOT NULL,
  source_book     VARCHAR(300),
  my_understanding TEXT,
  apply_scene     VARCHAR(300),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_cards_user ON knowledge_cards(user_id);

COMMENT ON TABLE knowledge_cards IS '知识卡片（第二大脑）';
```

---

### 2.7 公众号创作

#### `wechat_articles`
```sql
CREATE TABLE wechat_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  publish_date    DATE,
  read_data       VARCHAR(200),
  review          TEXT,
  inspiration     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wechat_user_id ON wechat_articles(user_id);

COMMENT ON TABLE wechat_articles IS '公众号文章管理';
```

---

### 2.8 小红书运营

#### `xhs_records`
```sql
CREATE TABLE xhs_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  content_type    VARCHAR(20) NOT NULL DEFAULT '图文'
                    CHECK (content_type IN ('图文', '视频', '笔记')),
  copy_text       TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'idea'
                    CHECK (status IN ('idea', 'script', 'shooting', 'editing', 'published')),
  source          VARCHAR(20),
  file_name       VARCHAR(300),
  data_performance TEXT,
  ai_suggestion   TEXT,
  is_viral_case   BOOLEAN DEFAULT FALSE,
  viral_reason    TEXT,
  takeaway        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xhs_user_status ON xhs_records(user_id, status);

COMMENT ON TABLE xhs_records IS '小红书运营（内容生产+灵感+爆款分析）';
COMMENT ON COLUMN xhs_records.source IS '灵感来源：想法/热点/案例/生活';
COMMENT ON COLUMN xhs_records.is_viral_case IS '是否为爆款拆解案例';
```

---

### 2.9 健康管理

#### `health_records`
```sql
CREATE TABLE health_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours     NUMERIC(3,1),
  sleep_quality   SMALLINT CHECK (sleep_quality >= 1 AND sleep_quality <= 3),
  energy_score    SMALLINT CHECK (energy_score >= 1 AND energy_score <= 10),
  fatigue_level   SMALLINT CHECK (fatigue_level >= 1 AND fatigue_level <= 5),
  steps           INTEGER DEFAULT 0,
  weight_kg       NUMERIC(5,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, record_date)
);

CREATE INDEX idx_health_user_date ON health_records(user_id, record_date);

COMMENT ON TABLE health_records IS '身体状态总览（含睡眠/精力/步数/体重）';
```

#### `nutrition_records`
```sql
CREATE TABLE nutrition_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type       VARCHAR(20) NOT NULL
                    CHECK (meal_type IN ('早餐', '午餐', '晚餐', '加餐', '饮品')),
  food_name       VARCHAR(200) NOT NULL,
  calories_kcal   INTEGER DEFAULT 0,
  protein_g       NUMERIC(6,1) DEFAULT 0,
  carbs_g         NUMERIC(6,1) DEFAULT 0,
  fat_g           NUMERIC(6,1) DEFAULT 0,
  note            TEXT,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nutrition_user_date ON nutrition_records(user_id, record_date);

COMMENT ON TABLE nutrition_records IS '饮食摄入记录';
```

#### `exercise_records`
```sql
CREATE TABLE exercise_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  exercise_type   VARCHAR(100) NOT NULL,
  duration_min    SMALLINT NOT NULL DEFAULT 0,
  calories_burned INTEGER DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercise_user_date ON exercise_records(user_id, record_date);

COMMENT ON TABLE exercise_records IS '运动消耗记录';
```

---

### 2.10 财务管理

#### `finance_records`
```sql
CREATE TABLE finance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  type            VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  amount          NUMERIC(12,2) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_finance_user_date ON finance_records(user_id, record_date);
CREATE INDEX idx_finance_user_type ON finance_records(user_id, type);

COMMENT ON TABLE finance_records IS '财务流水（收入/支出合并）';
```

---

### 2.11 复盘系统

#### `weekly_reviews`
```sql
CREATE TABLE weekly_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  accomplishments TEXT,
  biggest_gain    TEXT,
  problems        TEXT,
  next_week_plan  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_user_id ON weekly_reviews(user_id);

COMMENT ON TABLE weekly_reviews IS '每周复盘记录';
```

#### `monthly_reviews`
```sql
CREATE TABLE monthly_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month           DATE NOT NULL,  -- 存储为该月第一天
  archive_data    JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, month)
);

CREATE INDEX idx_monthly_user_id ON monthly_reviews(user_id);

COMMENT ON TABLE monthly_reviews IS '月度成长档案';
```

---

### 2.12 成就系统

#### `achievements`
```sql
CREATE TABLE achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('milestone', 'future_plan')),
  content         TEXT NOT NULL,
  is_done         BOOLEAN NOT NULL DEFAULT FALSE,
  target_date     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_achievements_user_type ON achievements(user_id, type);

COMMENT ON TABLE achievements IS '里程碑与未来计划';
```

---

## 三、数据关系说明

```
users (1)
  │
  ├── 1:N ── profiles          ── 每个用户只有一个个人资料
  ├── 1:N ── daily_plans       ── 每天多条目标
  ├── 1:N ── english_records   ── 每天多次学习记录
  ├── 1:N ── nce_records       ── 每篇文章一条记录
  ├── 1:N ── ai_tools          ── 每个工具一条记录
  ├── 1:N ── ai_tasks          ── 每个任务一条记录
  ├── 1:N ── job_records       ── 每个投递一条记录
  ├── 1:N ── interview_records ── 每次面试一条记录
  ├── 1:N ── reading_records   ── 每天多条阅读记录
  ├── 1:N ── knowledge_cards   ── 每张卡片一条记录
  ├── 1:N ── wechat_articles   ── 每篇文章一条记录
  ├── 1:N ── xhs_records       ── 每条内容一条记录
  ├── 1:N ── health_records    ── 每天一条身体状态
  ├── 1:N ── nutrition_records ── 每天多条饮食记录
  ├── 1:N ── exercise_records  ── 每天多条运动记录
  ├── 1:N ── finance_records   ── 每天多条财务记录
  ├── 1:N ── weekly_reviews    ── 每周一条复盘
  ├── 1:N ── monthly_reviews   ── 每月一条档案
  └── 1:N ── achievements      ── 多条里程碑/计划

job_records (1)
  └── 1:N ── interview_records ── 一个投递对应多次面试
```

---

## 四、权限规则（Row Level Security）

### 4.1 Supabase RLS 策略

所有表统一使用 `user_id` 进行行级隔离，确保用户只能访问自己的数据。

#### 通用 RLS 模板（以 english_records 为例）

```sql
-- 1. 启用行级安全
ALTER TABLE english_records ENABLE ROW LEVEL SECURITY;

-- 2. 用户只能 SELECT 自己的数据
CREATE POLICY "用户只能查看自己的英语记录"
  ON english_records FOR SELECT
  USING (auth.uid() = user_id);

-- 3. 用户只能 INSERT 自己的数据
CREATE POLICY "用户只能新增自己的记录"
  ON english_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. 用户只能 UPDATE 自己的数据
CREATE POLICY "用户只能更新自己的记录"
  ON english_records FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. 用户只能 DELETE 自己的数据
CREATE POLICY "用户只能删除自己的记录"
  ON english_records FOR DELETE
  USING (auth.uid() = user_id);
```

#### 一键应用 RLS（函数方式）

```sql
-- 为所有表启用 RLS（需要以 superuser 执行）
CREATE OR REPLACE FUNCTION apply_rls_all_tables()
RETURNS void AS $$
DECLARE
  tables TEXT[] := ARRAY[
    'profiles', 'daily_plans', 'english_records', 'nce_records',
    'ai_tools', 'ai_tasks', 'job_records', 'interview_records',
    'reading_records', 'knowledge_cards', 'wechat_articles', 'xhs_records',
    'health_records', 'nutrition_records', 'exercise_records',
    'finance_records', 'weekly_reviews', 'monthly_reviews', 'achievements'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('
      CREATE POLICY "用户数据隔离_%I" ON %I
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    ', t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 五、迁移方案

### 5.1 迁移流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Step 1     │    │  Step 2     │    │  Step 3     │
│  导出数据   │───→│  创建数据库 │───→│  导入数据   │
│  (当前系统) │    │  (Supabase) │    │  (API脚本)  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                       ┌─────────────┐
│  备份文件   │                       │  验证完整性 │
│  backup.json│                       │  (校验计数) │
└─────────────┘                       └─────────────┘
```

### 5.2 字段映射

| localStorage 键 | 数据库表 | 字段映射说明 |
|-----------------|---------|-------------|
| `pg_user_id` | users | → id（自动生成UUID） |
| `pg_user_profile` | profiles | nickname→nickname, career→career, goal→goal, longGoal→long_goal |
| `pg_goals_{date}` | daily_plans | 每条 goal→一行记录，date→plan_date |
| `pg_mood_{date}` | daily_plans | mood→合并到当天的目标行 |
| `pg_english_records` | english_records | 直接映射，date→record_date |
| `pg_eng_articles` | nce_records | title→title, book→book_name, words→words_json |
| `pg_ai_tools` | ai_tools | type→category, core→core_function |
| `pg_ai_tasks` | ai_tasks | name→task_name, prompt→prompt_text |
| `pg_job_apply` | job_records | 直接映射 |
| `pg_job_interview` | interview_records | company→company, result→result |
| `pg_job_reviews` | interview_records | weakQuestions→weakness, aiAnalysis→ai_analysis |
| `pg_reading_records` | reading_records | book→book_name, time→duration_min |
| `pg_read_notes` | reading_records | 合并到 reading_records（book+content） |
| `pg_knowledge_cards` | knowledge_cards | type→card_type, scene→apply_scene |
| `pg_xhs_productions` | xhs_records | type→content_type, status→status |
| `pg_xhs_ideas` | xhs_records | 合并到 xhs_records（status=idea） |
| `pg_xhs_virals` | xhs_records | 合并到 xhs_records（is_viral_case=true） |
| `pg_intake_records` | nutrition_records | meal→meal_type, food→food_name |
| `pg_burn_records` | exercise_records | type→exercise_type, duration→duration_min |
| `pg_body_state_{date}` | health_records | 每天一条（energy→energy_score） |
| `pg_steps_{date}` | health_records | steps→steps（合并到health_records） |
| `pg_fin_income` | finance_records | 合并（type='income'） |
| `pg_fin_expense` | finance_records | 合并（type='expense'） |
| `pg_weekly_{weekKey}` | weekly_reviews | done→accomplishments, harvest→biggest_gain |
| `pg_milestones` | achievements | 合并（type='milestone'） |
| `pg_future_plans` | achievements | 合并（type='future_plan'） |

### 5.3 Supabase 迁移脚本

```javascript
// migration.js — 数据迁移脚本（在 Node.js 或 Supabase Edge Functions 中运行）
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateProfile(userId, data) {
  const { error } = await supabase.from('profiles').insert({
    user_id: userId,
    career: data.career || null,
    goal: data.goal || null,
    long_goal: data.longGoal || null,
    bio: data.bio || null
  });
  if (error) console.error('Profile migration error:', error);
}

async function migrateEnglishRecords(userId, records) {
  const rows = records.map(r => ({
    user_id: userId,
    record_date: r.date,
    article_title: r.article,
    duration_min: parseInt(r.time) || 0,
    new_words: r.newWordsList,
    phrases: r.phrases,
    speaking_min: parseInt(r.speaking) || 0,
    note: r.note,
    ai_summary: r.aiSummary
  }));
  const { error } = await supabase.from('english_records').insert(rows);
  if (error) console.error('English migration error:', error);
}

// ... 类似函数覆盖所有 20 张表
```

### 5.4 验证脚本

```sql
-- 迁移后验证数据完整性
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'english_records', COUNT(*) FROM english_records
UNION ALL SELECT 'reading_records', COUNT(*) FROM reading_records
UNION ALL SELECT 'finance_records', COUNT(*) FROM finance_records
-- ... 覆盖所有表
ORDER BY table_name;
```

### 5.5 回滚方案

```sql
-- 如果迁移出现问题，清空所有表重新导入
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE daily_plans CASCADE;
TRUNCATE TABLE english_records CASCADE;
-- ... 其他表
```

---

## 六、Supabase 云数据库配置

### 6.1 创建 Supabase 项目

在 [supabase.com](https://supabase.com) 创建新项目后，在 SQL Editor 中执行以上建表 SQL。

### 6.2 环境变量配置

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 6.3 DB 接口迁移示例

```javascript
// 当前 localStorage 版本
const DB = {
  get(key, def=null) { ... localStorage ... },
  set(key, val) { ... localStorage ... }
};

// 迁移后 API 版本
const DB = {
  async get(table, def=null) {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', currentUserId);
    return data || def;
  },
  async set(table, record) {
    const { error } = await supabase
      .from(table)
      .upsert({ ...record, user_id: currentUserId });
    return !error;
  }
};
```

---

> **文档版本**：v1.0.0  
> **更新日期**：2026-07-28  
> **目标平台**：Supabase / PostgreSQL 15+  
> **表数量**：20 张  
> **索引数量**：25 个  
> **RLS 策略**：所有表启用行级安全
