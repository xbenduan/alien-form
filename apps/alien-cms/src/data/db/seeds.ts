import dayjs from 'dayjs';
import type { ModelRecord } from '../../types/model';

const statuses = ['draft', 'review', 'published', 'archived'] as const;
const categories = ['product', 'engineering', 'growth', 'team'] as const;
const authors = ['Luna', 'Mika', 'Noah', 'Ariel', 'Sven', 'Yuki'];
const articleTitles = [
  'Schema 驱动内容平台的投影策略',
  '用 Dexie 模拟本地 API 的最佳实践',
  '单页工作台里的筛选与分页协同',
  '把表单 runtime 提升为业务模型 runtime',
  '从模型到列表列配置的最小映射',
  '统一抽屉承载 Add/Edit/Detail 的体验设计',
  '用一份 schema 驱动多视图的落地细节',
  '本地数据层与远端 API 切换边界',
  '企业后台中的状态标签设计',
  '内容模型里的可读性与可维护性权衡',
  'Schema-first CMS 的工程化切入点',
  '投影层如何保持稳定的扩展接口',
];

const campaignNames = [
  '暑期拉新计划',
  '创作者增长实验',
  '品牌联动专题',
  'B 端线索培育',
  '年度回访活动',
  '新功能冷启动',
  '内容分发提效项目',
  '老客激活计划',
];
const owners = ['Mika', 'Ariel', 'Luna', 'Sven'];
const channels = ['search', 'social', 'email', 'community'] as const;

function buildArticleSummary(index: number) {
  return `第 ${index + 1} 篇示例文章，用于验证同一份 schema 在列表、筛选、表单和详情之间的联动行为。`;
}

function buildArticleContent(index: number) {
  return [
    '这是一段用于 CMS 工作台验证的正文内容。',
    '它会覆盖新增、编辑、详情回填以及本地 Dexie 持久化的完整闭环。',
    `当前示例序号为 ${index + 1}，便于验证排序、分页与筛选是否稳定。`,
  ].join('\n\n');
}

export function createArticleSeeds(): ModelRecord[] {
  return Array.from({ length: 12 }).map((_, index) => {
    const createdAt = dayjs().subtract(14 - index, 'day').hour(9 + (index % 5)).minute(15).second(0);
    const updatedAt = createdAt.add((index % 4) + 1, 'day').add(index * 7, 'minute');
    const publishTime = createdAt.add(index % 3, 'day').format('YYYY-MM-DD');
    return {
      id: `article-${index + 1}`,
      title: articleTitles[index],
      status: statuses[index % statuses.length],
      category: categories[index % categories.length],
      author: authors[index % authors.length],
      publishTime,
      readingTime: 5 + (index % 7) * 2,
      featured: index % 3 === 0,
      tags: ['schema', 'cms', categories[index % categories.length], index % 2 === 0 ? 'projection' : 'runtime'],
      summary: buildArticleSummary(index),
      content: buildArticleContent(index),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    } satisfies ModelRecord;
  });
}

export function createCampaignSeeds(): ModelRecord[] {
  return Array.from({ length: 8 }).map((_, index) => {
    const createdAt = dayjs().subtract(8 - index, 'day').hour(10 + (index % 3)).minute(30).second(0);
    const updatedAt = createdAt.add((index % 3) + 1, 'day').add(index * 5, 'minute');
    const launchDate = createdAt.add(index % 4, 'day').format('YYYY-MM-DD');
    return {
      id: `campaign-${index + 1}`,
      name: campaignNames[index],
      status: statuses[index % statuses.length],
      owner: owners[index % owners.length],
      channel: channels[index % channels.length],
      launchDate,
      budget: 10 + index * 8,
      active: index % 2 === 0,
      tags: ['growth', channels[index % channels.length], index % 2 === 0 ? 'paid' : 'organic'],
      summary: `这是 ${campaignNames[index]} 的摘要，用于验证第二模型在同一工作台中的复用能力。`,
      goal: ['验证模型切换体验', '检查不同字段投影', '确认数据层可复用'].join('\n\n'),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    } satisfies ModelRecord;
  });
}
