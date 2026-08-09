-- ============================================================
-- Workbuddy 数据库初始化脚本（完整版 18 张表）
-- 使用方法：Supabase 控制台 → SQL Editor → New query → 粘贴全部 → Run
-- ============================================================

-- 1. profiles 用户资料
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT, career TEXT, goal TEXT, long_goal TEXT, bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. daily_plans 每日计划
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

-- 3. english_records 英语学习
CREATE TABLE IF NOT EXISTS english_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  article_title VARCHAR(300), duration_min SMALLINT NOT NULL DEFAULT 0,
  new_words TEXT, phrases TEXT, speaking_min SMALLINT DEFAULT 0, note TEXT, ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_english_records_user_date ON english_records(user_id, record_date);

-- 4. nce_records 新概念英语
CREATE TABLE IF NOT EXISTS nce_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL, book_name VARCHAR(100) NOT NULL,
  original_text TEXT, study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'learning',
  words_json JSONB, phrases_json JSONB, grammar_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ai_tools AI工具
CREATE TABLE IF NOT EXISTS ai_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL, category VARCHAR(50) NOT NULL DEFAULT '其他',
  core_function TEXT, use_scene TEXT,
  mastery_level SMALLINT NOT NULL DEFAULT 1,
  next_step TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ai_tasks AI任务
CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_name VARCHAR(300) NOT NULL, tool_used VARCHAR(200),
  prompt_text TEXT, ai_output TEXT, final_result TEXT,
  efficiency TEXT, review TEXT, task_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. job_records 求职投递
CREATE TABLE IF NOT EXISTS job_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company VARCHAR(200) NOT NULL, position VARCHAR(200),
  apply_date DATE, status VARCHAR(20) NOT NULL DEFAULT 'pending',
  jd_description TEXT, resume_version TEXT, prep_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. interview_records 面试记录
CREATE TABLE IF NOT EXISTS interview_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company VARCHAR(200) NOT NULL, position VARCHAR(200),
  interview_date DATE, round VARCHAR(50), result VARCHAR(20) DEFAULT 'pending',
  feeling TEXT, questions TEXT, answers TEXT, weakness TEXT,
  self_rate SMALLINT, ai_analysis TEXT, next_step TEXT,
  audio_file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. reading_records 阅读记录
CREATE TABLE IF NOT EXISTS reading_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_name VARCHAR(200), book_author VARCHAR(100), book_tag VARCHAR(50),
  read_date DATE, duration_min SMALLINT DEFAULT 0,
  chapter VARCHAR(200), note_type VARCHAR(20),
  content TEXT, key_point TEXT, ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. knowledge_cards 知识卡片
CREATE TABLE IF NOT EXISTS knowledge_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic VARCHAR(300) NOT NULL, card_type VARCHAR(50) NOT NULL DEFAULT '观点',
  content TEXT NOT NULL, source_book VARCHAR(200),
  my_understanding TEXT, apply_scene TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. wechat_articles 公众号文章
CREATE TABLE IF NOT EXISTS wechat_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL, status VARCHAR(20) DEFAULT 'draft',
  publish_date DATE, read_data TEXT, review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. xhs_records 小红书记录
CREATE TABLE IF NOT EXISTS xhs_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL, content_type VARCHAR(50) DEFAULT '笔记',
  copy_text TEXT, status VARCHAR(20) DEFAULT 'idea',
  file_name TEXT, data_performance TEXT, source TEXT, ai_suggestion TEXT,
  is_viral_case BOOLEAN DEFAULT FALSE, viral_reason TEXT, takeaway TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. health_records 健康记录
CREATE TABLE IF NOT EXISTS health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours NUMERIC(3,1), sleep_quality SMALLINT, energy_score SMALLINT, fatigue_level SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. nutrition_records 饮食记录
CREATE TABLE IF NOT EXISTS nutrition_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type VARCHAR(20) DEFAULT '加餐', food_name VARCHAR(200) NOT NULL,
  calories_kcal INT DEFAULT 0, protein_g NUMERIC(6,1) DEFAULT 0,
  carbs_g NUMERIC(6,1) DEFAULT 0, fat_g NUMERIC(6,1) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. exercise_records 运动记录
CREATE TABLE IF NOT EXISTS exercise_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  exercise_type VARCHAR(100) NOT NULL, duration_min INT DEFAULT 0,
  calories_burned INT DEFAULT 0, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. finance_records 财务记录
CREATE TABLE IF NOT EXISTS finance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0, category VARCHAR(50) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. weekly_reviews 周复盘
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, accomplishments TEXT,
  biggest_gain TEXT, problems TEXT, next_week_plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- 18. achievements 成就里程碑
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('milestone','future_plan')),
  content TEXT NOT NULL, is_done BOOLEAN DEFAULT FALSE, target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. emotion_feedbacks 每日情绪反馈（精力/心情/满意度/收获/问题/调整/一句话/备注）
CREATE TABLE IF NOT EXISTS emotion_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_date DATE NOT NULL,
  energy SMALLINT, mood_rating SMALLINT, satisfaction SMALLINT,
  harvest TEXT, problem TEXT, adjust TEXT, one_sentence TEXT, note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, feedback_date)
);
CREATE INDEX IF NOT EXISTS idx_emotion_feedbacks_user_date ON emotion_feedbacks(user_id, feedback_date);

-- ============================================================
-- RLS 安全策略（用户只能读写自己的数据）
-- ============================================================
-- 18 张数据表：使用 user_id 列（profiles 单独处理，见下方）
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['daily_plans','english_records','nce_records','ai_tools','ai_tasks','job_records','interview_records','reading_records','knowledge_cards','wechat_articles','xhs_records','health_records','nutrition_records','exercise_records','finance_records','weekly_reviews','achievements','emotion_feedbacks']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_own" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "%I_own" ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t, t);
  END LOOP;
END $$;

-- profiles 表用 id 列（不是 user_id），单独创建策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- 完成！18 张表 + 18 条 RLS 策略已创建
-- 返回 Workbuddy → 登录 → 点击「同步数据」即可全量同步
-- ============================================================

-- ============================================================
-- v1.0.15 增强字段：AI 工具库 → 个人 AI 能力档案
-- 适用：在已有库上扩展（如首次建库，CREATE TABLE 已含这些列，本段重复执行安全）
-- ============================================================
ALTER TABLE ai_tools
  ADD COLUMN IF NOT EXISTS problem text,
  ADD COLUMN IF NOT EXISTS count   int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS result  text;
