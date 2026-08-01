-- ============================================================
-- Workbuddy 数据库初始化脚本
-- 使用方法：Supabase 控制台 → SQL Editor → New query → 粘贴全部 → Run
-- ============================================================

-- 1. profiles 表（用户资料）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  career TEXT,
  goal TEXT,
  long_goal TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. daily_plans 表（每日计划，同步模块1）
CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  goal_text TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plan_date, goal_text)
);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date);

-- 3. english_records 表（英语学习，同步模块2）
CREATE TABLE IF NOT EXISTS english_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  article_title VARCHAR(300),
  duration_min SMALLINT NOT NULL DEFAULT 0,
  new_words TEXT,
  phrases TEXT,
  speaking_min SMALLINT DEFAULT 0,
  note TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_english_records_user_date ON english_records(user_id, record_date);

-- 4. reading_records 表（阅读记录，同步模块3）
CREATE TABLE IF NOT EXISTS reading_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_date DATE,
  book_name VARCHAR(200),
  duration_min SMALLINT DEFAULT 0,
  content TEXT,
  key_point TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_records_user_date ON reading_records(user_id, read_date);

-- 5. health_records 表（健康记录，同步模块4）
CREATE TABLE IF NOT EXISTS health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy SMALLINT,
  steps INT,
  weight NUMERIC(5,1),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_health_records_user_date ON health_records(user_id, record_date);

-- ============================================================
-- RLS 安全策略（用户只能读写自己的数据）
-- ============================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE english_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "daily_plans_own" ON daily_plans;
CREATE POLICY "daily_plans_own" ON daily_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "english_records_own" ON english_records;
CREATE POLICY "english_records_own" ON english_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reading_records_own" ON reading_records;
CREATE POLICY "reading_records_own" ON reading_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "health_records_own" ON health_records;
CREATE POLICY "health_records_own" ON health_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 完成！执行成功后会看到 5 张表 + 5 条 RLS 策略
-- 返回 Workbuddy → 登录 → 点击「同步数据」即可
-- ============================================================
