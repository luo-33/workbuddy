# Workbuddy 数据结构文档

> 生成日期：2026-07-28  
> 数据版本：v1.0.0  
> 存储方式：localStorage（键名前缀 `pg_`）  
> 用途：为未来迁移云数据库提供完整数据架构参考

---

## 一、数据总览

### 1.1 存储入口

所有数据统一通过 `DB` 对象读写，未来迁移只需替换 `DB.get/set` 实现：

```javascript
const DB = {
  get(key, def=null) { localStorage.getItem('pg_'+key) },
  set(key, val) { localStorage.setItem('pg_'+key, JSON.stringify(val)) }
};
```

### 1.2 当前数据量统计

| 指标 | 值 |
|------|-----|
| 数据模块总数 | 40+ 键 |
| 用户模块 | 14 个 |
| 数据类型 | 用户数据 / 系统数据 / 配置数据 |

---

## 二、模块数据表设计

### 2.1 用户系统

#### `user_id`
| 字段 | 类型 | 说明 | 必填 | 示例 |
|------|------|------|------|------|
| -- | string | 用户唯一ID，首次使用自动生成 | ✅ | `usr_m1x2c3_abc12345` |

#### `user_profile`
| 字段 | 类型 | 说明 | 必填 | 示例 |
|------|------|------|------|------|
| nickname | string | 用户昵称 | ✅ | `自信` |
| career | string | 当前职业 | ❌ | `2026届毕业生` |
| goal | string | 目标方向 | ❌ | `新媒体运营` |
| longGoal | string | 长期目标 | ❌ | `独立运营品牌内容+个人IP` |
| bio | string | 个人简介 | ❌ | `...` |
| createdAt | string(ISO) | 创建时间 | ✅ | `2026-07-01T...` |
| updatedAt | string(ISO) | 最后更新 | ✅ | `2026-07-28T...` |

---

### 2.2 Dashboard / 每日计划

#### `goals_{date}`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| id | string | 目标ID | ✅ |
| text | string | 目标描述 | ✅ |
| done | boolean | 是否完成 | ✅ |

**示例：**
```json
[
  { "id": "g1", "text": "✍️ 英语学习 30min+", "done": true },
  { "id": "g2", "text": "💼 求职相关", "done": false }
]
```

#### `mood_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | number | 心情评分 1-5 |

#### `dailyNote_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | text | 每日自由记录 |

#### `emotion_feedback_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | object | 情绪反馈数据 |

#### `daily_reports`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| date | string(date) | 报告日期 | ✅ |
| score | number | 成长分 0-100 | ✅ |
| items | array | 各模块完成情况 | ✅ |
| feedback | string | AI反馈文本 | ✅ |
| tips | array | 改进建议列表 | ✅ |
| _ts | number(timestamp) | 时间戳 | ✅ |

---

### 2.3 英语成长

#### `english_records`
| 字段 | 类型 | 说明 | 必填 | 示例 |
|------|------|------|------|------|
| date | string(date) | 学习日期 | ✅ | `2026-07-28` |
| article | string | 学习文章 | ❌ | `Lesson 15` |
| time | number | 学习时长(分钟) | ✅ | `30` |
| newWordsList | string | 新词(逗号分隔) | ❌ | `progress,pronunciation` |
| phrases | string | 重点表达 | ❌ | `make progress` |
| speaking | number | 口语时长 | ❌ | `10` |
| note | string | 学习感悟 | ❌ | `...` |
| aiSummary | string | AI总结 | ❌ | `学习了10个新单词...` |
| _ts | number | 时间戳 | ❌ | `...` |

#### `eng_articles`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| title | string | 文章标题 | ✅ |
| book | string | 所属册数 | ✅ |
| date | string(date) | 学习日期 | ✅ |
| content | string | 原文内容 | ❌ |
| status | string | 学习状态(learning/mastered) | ✅ |
| words | array | 生词列表(含word/phonetic/cn/example/mastery) | ❌ |
| phrases | array | 表达列表(含en/cn/scene) | ❌ |
| grammar | array | 语法分析(含title/desc) | ❌ |
| reviews | array | 复习计划(含date/type/done) | ❌ |
| _showDetail | boolean | UI展示状态 | ❌ |

#### `eng_speaking`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 口语练习日期 |
| task | string | 口语任务内容 |
| time | number | 练习时长(分钟) |
| _ts | number | 时间戳 |

#### `eng_ai_reviews`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 分析日期 |
| score | number | AI评分 |
| _ts | number | 时间戳 |

---

### 2.4 AI技能库

#### `ai_tools`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| name | string | 工具名称 | ✅ |
| type | string | 分类(内容创作/数据分析/自动化/新媒体运营) | ✅ |
| core | string | 核心功能 | ❌ |
| scene | string | 使用场景 | ❌ |
| mastery | number | 掌握程度 1-5 | ✅ |
| next | string | 下一步方向 | ❌ |

#### `ai_tasks`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| name | string | 任务名称 | ✅ |
| tool | string | 使用工具 | ✅ |
| prompt | string | 提示词 | ❌ |
| output | string | AI生成结果 | ❌ |
| result | string | 最终成果 | ❌ |
| efficiency | string | 效率提升 | ❌ |
| review | string | 任务复盘 | ❌ |
| date | string(date) | 日期 | ✅ |

#### `ai_flows`
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 流程名称 |
| steps | string | 步骤(→分隔) |
| tools | string | 使用工具 |
| timeSaved | string | 节省时间 |
| scene | string | 适用场景 |
| optimize | string | 优化方向 |

#### `ai_prompts`
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 提示词标题 |
| cat | string | 分类 |
| content | string | 提示词内容 |
| scene | string | 使用场景 |

---

### 2.5 求职管理

#### `job_apply`
| 字段 | 类型 | 说明 | 必填 |
|------|------|------|------|
| company | string | 公司名称 | ✅ |
| position | string | 岗位名称 | ✅ |
| date | string(date) | 投递日期 | ✅ |
| status | string | 状态(pending/interview/offer/reject) | ✅ |
| jd | string | 岗位描述 | ❌ |
| resumeVer | string | 简历版本 | ❌ |

#### `job_interview`
| 字段 | 类型 | 说明 |
|------|------|------|
| company | string | 公司名称 |
| position | string | 岗位名称 |
| time | string | 面试时间 |
| round | string | 面试轮次 |
| feel | string | 面试感受 |
| result | string | 结果(pass/fail/pending) |
| questions | string | 面试问题 |
| answers | string | 我的回答 |
| weakness | string | 弱项 |
| file | string | 录音文件名 |
| _ts | number | 时间戳 |

#### `job_reviews`
| 字段 | 类型 | 说明 |
|------|------|------|
| company | string | 公司名称 |
| date | string(date) | 复盘日期 |
| rate | number | 自评 1-5 |
| weakQuestions | string | 弱项问题 |
| file | string | 录音文件 |
| aiAnalysis | string | AI分析 |
| nextStep | string | 改进方向 |
| _ts | number | 时间戳 |

#### `job_preps`
| 字段 | 类型 | 说明 |
|------|------|------|
| company | string | 公司 |
| position | string | 岗位 |
| jd | string | 岗位描述 |
| companyInfo | string | 公司信息 |
| resume | string | 简历 |

#### `hrqa_history`
| 字段 | 类型 | 说明 |
|------|------|------|
| question | string | HR问题 |
| answer | string | AI生成回答 |
| date | string(date) | 日期 |
| _ts | number | 时间戳 |

---

### 2.6 小红书运营

#### `xhs_config`
| 字段 | 类型 | 说明 |
|------|------|------|
| accName | string | 账号名称 |
| career | string | 职业方向 |
| interest | string | 兴趣 |
| skill | string | 技能 |
| target | string | 目标用户 |
| bio | string | 账号简介 |

#### `xhs_productions`
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 标题 |
| type | string | 类型(图文/视频/笔记) |
| copy | string | 文案 |
| fileName | string | 素材文件名 |
| status | string | 状态(script/shooting/editing/published) |
| data | string | 数据表现 |
| _ts | number | 时间戳 |

#### `xhs_ideas`
| 字段 | 类型 | 说明 |
|------|------|------|
| source | string | 来源(想法/热点/案例/生活) |
| text | string | 灵感描述 |
| status | string | 状态(idea/progress/done) |
| title | string | 标题方向 |
| frame | string | 内容框架 |
| aiSuggestion | string | AI建议 |
| _ts | number | 时间戳 |

#### `xhs_virals`
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 案例名称 |
| fileName | string | 截图文件名 |
| content | string | 笔记内容 |
| titleAnalysis | string | 标题分析 |
| reason | string | 爆款原因 |
| takeaway | string | 我的收获 |
| _ts | number | 时间戳 |

#### `xhs_records`（旧版兼容）
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 日期 |
| topic | string | 选题 |
| title | string | 标题 |
| type | string | 类型 |
| status | string | 状态 |
| data | string | 数据 |
| review | string | 复盘 |
| _ts | number | 时间戳 |

---

### 2.7 阅读计划

#### `read_books`
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 书名 |
| author | string | 作者 |
| tag | string | 分类标签 |
| status | string | 状态(计划阅读/阅读中/已完成) |
| startDate | string(date) | 开始日期 |
| endDate | string(date) | 完成日期 |
| _ts | number | 时间戳 |

#### `reading_records`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 阅读日期 |
| book | string | 书名 |
| chapter | string | 章节 |
| type | string | 笔记类型 |
| time | number | 阅读时长 |
| content | string | 笔记内容 |
| keyPoint | string | 核心观点 |
| quote | string | 喜欢的句子 |
| understanding | string | 今日感悟 |
| pages | number | 阅读页数 |
| aiSummary | string | AI总结 |
| _ts | number | 时间戳 |

#### `read_notes`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 笔记日期 |
| book | string | 书名 |
| chapter | string | 章节 |
| type | string | 类型(summary/opinion/quote/value/action) |
| time | number | 阅读时长 |
| content | string | 笔记内容 |
| keyPoint | string | 核心观点 |
| _ts | number | 时间戳 |

#### `knowledge_cards`
| 字段 | 类型 | 说明 |
|------|------|------|
| topic | string | 主题 |
| type | string | 类型(观点/金句/方法) |
| content | string | 核心内容 |
| source | string | 来源书籍 |
| understanding | string | 我的理解 |
| scene | string | 应用场景 |
| _ts | number | 时间戳 |

---

### 2.8 公众号创作

#### `wechat_articles`
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题 |
| status | string | 状态(draft/published) |
| publishDate | string(date) | 发布日期 |
| readData | string | 阅读数据 |
| review | string | 复盘 |

#### `wechat_insp_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| event | string | 今日事件 |
| observation | string | 观察 |
| thought | string | 思考 |
| theme | string | 主题 |

---

### 2.9 健康管理

#### `intake_records`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 日期 |
| meal | string | 餐次(早餐/午餐/晚餐/加餐/饮品) |
| food | string | 食物名称 |
| cal | number | 热量(kcal) |
| protein | number | 蛋白质(g) |
| carbs | number | 碳水化合物(g) |
| fat | number | 脂肪(g) |
| note | string | 备注 |
| _ts | number | 时间戳 |

#### `burn_records`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 日期 |
| type | string | 运动类型 |
| duration | number | 时长(分钟) |
| cal | number | 消耗热量 |
| note | string | 备注 |
| _ts | number | 时间戳 |

#### `health_profile`
| 字段 | 类型 | 说明 |
|------|------|------|
| weight | number | 体重(kg) |
| height | number | 身高(cm) |
| age | number | 年龄 |
| gender | string | 性别 |
| goalState | string | 目标状态 |
| goalFreq | number | 运动频率(次/周) |
| targetWeight | number | 目标体重 |

#### `body_state_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| sleepHours | number | 睡眠时长 |
| sleepQuality | number | 睡眠质量 1-3 |
| energy | number | 精力评分 1-10 |
| fatigue | number | 疲劳程度 1-5 |

#### `steps_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | number | 当日步数 |

---

### 2.10 财务管理

#### `fin_income`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 日期 |
| amount | number | 金额 |
| category | string | 分类 |
| note | string | 备注 |
| _ts | number | 时间戳 |

#### `fin_expense`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 日期 |
| amount | number | 金额 |
| category | string | 分类 |
| note | string | 备注 |
| _ts | number | 时间戳 |

#### `fin_budget_{年月}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | object | 月度预算配置 |

---

### 2.11 复盘系统

#### `weekly_{weekKey}`
| 字段 | 类型 | 说明 |
|------|------|------|
| done | text | 本周完成 |
| harvest | text | 最大进步 |
| problem | text | 遇到的问题 |
| nextWeek | text | 下周优化方向 |

#### `monthly_archive_{年月}`
| 字段 | 类型 | 说明 |
|------|------|------|
| -- | object | 月度归档数据 |

---

### 2.12 成就系统

#### `milestones`
| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 里程碑内容 |
| date | string(date) | 日期 |
| done | boolean | 是否完成 |

#### `future_plans`
| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 计划内容 |
| done | boolean | 是否完成 |

---

### 2.13 备份与日志

#### `backup_logs`
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string(date) | 备份日期 |
| size | string | 文件大小 |
| count | number | 数据项数 |
| status | string | 状态 |
| version | string | 数据版本 |
| _ts | number | 时间戳 |

#### `auto_backup_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| version | string | 数据版本 |
| exportedAt | string(ISO) | 导出时间 |
| exportedAtLocal | string | 本地时间 |
| userId | string | 用户ID |
| userProfile | object | 用户资料 |
| moduleCount | number | 模块数量 |
| data | object | 所有pg_*数据 |
| description | string | 描述 |

#### `ds_log_{date}`
| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 操作类型(read/write) |
| key | string | 数据键 |
| time | string | 操作时间 |
| _ts | number | 时间戳 |

---

## 三、数据关系图

```
user_id / user_profile
        │
        ├── english_records ───── eng_articles ───── eng_speaking ───── eng_ai_reviews
        │
        ├── ai_tools ───── ai_tasks ───── ai_flows ───── ai_prompts
        │
        ├── job_apply ───── job_interview ───── job_reviews ───── job_preps ───── hrqa_history
        │
        ├── xhs_config ───── xhs_productions ───── xhs_ideas ───── xhs_virals
        │
        ├── read_books ───── reading_records ───── read_notes ───── knowledge_cards
        │
        ├── wechat_articles ───── wechat_insp_{date}
        │
        ├── intake_records ───── burn_records ───── health_profile ───── body_state_{date}
        │
        ├── fin_income ───── fin_expense ───── fin_budget_{ym}
        │
        ├── goals_{date} ───── mood_{date} ───── daily_reports
        │
        ├── milestones ───── future_plans
        │
        ├── weekly_{weekKey} ───── monthly_archive_{ym}
        │
        └── backup_logs ───── auto_backup_{date}
```

---

## 四、数据类型分类

### 4.1 用户产生数据（User Generated Data）
| 模块 | 表名 | 增长方式 |
|------|------|---------|
| 英语 | english_records, eng_articles, eng_speaking | 每日新增 |
| AI | ai_tools, ai_tasks, ai_flows, ai_prompts | 按需新增 |
| 求职 | job_apply, job_interview, job_reviews | 按事件新增 |
| 小红书 | xhs_productions, xhs_ideas, xhs_virals | 按内容新增 |
| 阅读 | reading_records, read_notes, knowledge_cards | 每日新增 |
| 公众号 | wechat_articles | 按文章新增 |
| 健康 | intake_records, burn_records, body_state_ | 每日新增 |
| 财务 | fin_income, fin_expense | 按交易新增 |

### 4.2 系统生成数据（System Generated Data）
| 表名 | 生成方式 |
|------|---------|
| daily_reports | 用户点击生成 |
| backup_logs | 备份时生成 |
| auto_backup_{date} | 备份时生成 |
| ds_log_{date} | 每次数据操作生成 |

### 4.3 配置数据（Configuration Data）
| 表名 | 说明 |
|------|------|
| user_profile | 用户资料 |
| health_profile | 健康档案 |
| xhs_config | 小红书配置 |
| goals_{date} | 每日目标 |
| fin_budget_{ym} | 月度预算 |
| weekly_{key} | 周复盘配置 |
| mood_{date} | 心情 |
| steps_{date} | 步数 |

---

## 五、数据库迁移建议

### 5.1 推荐表结构

| 序号 | 表名 | 说明 | 来源模块 |
|------|------|------|---------|
| 1 | `users` | 用户表 | user_id + user_profile |
| 2 | `english_records` | 英语学习记录 | english_records |
| 3 | `english_articles` | 新概念文章 | eng_articles |
| 4 | `english_speaking` | 口语练习 | eng_speaking |
| 5 | `ai_tools` | AI工具库 | ai_tools |
| 6 | `ai_tasks` | AI任务实践 | ai_tasks |
| 7 | `ai_flows` | AI工作流 | ai_flows |
| 8 | `ai_prompts` | 提示词库 | ai_prompts |
| 9 | `job_applications` | 投递管理 | job_apply |
| 10 | `job_interviews` | 面试记录 | job_interview |
| 11 | `job_reviews` | 面试复盘 | job_reviews |
| 12 | `hrqa_records` | HR问答历史 | hrqa_history |
| 13 | `content_productions` | 内容生产 | xhs_productions |
| 14 | `content_ideas` | 创作灵感 | xhs_ideas |
| 15 | `content_virals` | 爆款分析 | xhs_virals |
| 16 | `read_books` | 书籍库 | read_books |
| 17 | `reading_records` | 阅读记录 | reading_records + read_notes |
| 18 | `knowledge_cards` | 知识卡片 | knowledge_cards |
| 19 | `wechat_articles` | 公众号文章 | wechat_articles |
| 20 | `health_intake` | 饮食记录 | intake_records |
| 21 | `health_exercise` | 运动记录 | burn_records |
| 22 | `health_body_states` | 身体状态 | body_state_ |
| 23 | `health_profiles` | 健康档案 | health_profile |
| 24 | `fin_transactions` | 财务流水 | fin_income + fin_expense |
| 25 | `daily_goals` | 每日目标 | goals_ |
| 26 | `daily_moods` | 心情记录 | mood_ |
| 27 | `milestones` | 里程碑 | milestones |
| 28 | `future_plans` | 未来计划 | future_plans |
| 29 | `weekly_reviews` | 周复盘 | weekly_ |

### 5.2 合并建议

| 原表 | 合并后 | 理由 |
|------|--------|------|
| fin_income + fin_expense | fin_transactions | 增加 type(income/expense) 字段即可区分 |
| reading_records + read_notes | reading_records | 结构高度重合，可合并 |
| body_state_{date} (每日) | health_body_states | 改为行记录，每天一条 |
| steps_{date} (每日) | health_body_states | 合并到身体状态表 |
| mood_{date} (每日) | daily_goals | 合并到每日记录表 |

### 5.3 拆分建议

| 原表 | 拆分后 | 理由 |
|------|--------|------|
| job_preps 内嵌AI分析 | job_preps + job_analyses | 分析结果可复用 |
| eng_articles 内嵌复习计划 | eng_articles + eng_review_schedule | 复习计划独立维护 |
| daily_reports 内嵌AI反馈 | daily_reports + ai_feedback | 反馈可独立分析 |

### 5.4 新增关联字段

迁移时每个数据表应增加：

```sql
user_id VARCHAR(64)   -- 关联用户
id INT AUTO_INCREMENT -- 自增主键
created_at DATETIME   -- 创建时间
updated_at DATETIME   -- 更新时间
```

### 5.5 索引建议

```sql
-- 高频查询索引
CREATE INDEX idx_user_id ON english_records(user_id);
CREATE INDEX idx_date ON english_records(date);
CREATE INDEX idx_user_date ON reading_records(user_id, date);
CREATE INDEX idx_user_status ON job_applications(user_id, status);
CREATE INDEX idx_intake_date ON health_intake(user_id, date);
```

### 5.6 迁移步骤

```
1. 导出备份：数据中心 → 导出全部数据
2. 创建数据库表（按上表结构）
3. 部署后端 API 服务（Node.js/Python 均可）
4. 修改 DB.get/set 实现为 fetch 请求
5. 导入 JSON 数据到数据库
6. 验证数据完整性
7. 切换用户到云同步模式
```
