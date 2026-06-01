import Dexie, { type Table } from 'dexie';
import type { ModelRecord } from '../../types/model';
import { createArticleSeeds, createCampaignSeeds } from './seeds';

export class AlienCmsDatabase extends Dexie {
  articles!: Table<ModelRecord, string>;
  campaigns!: Table<ModelRecord, string>;

  constructor() {
    super('alien-cms');
    this.version(1).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
    });
    this.version(2).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
      campaigns: 'id, status, channel, owner, launchDate, createdAt, updatedAt',
    });
  }
}

export const db = new AlienCmsDatabase();

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseReady() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const articleCount = await db.articles.count();
      if (articleCount === 0) {
        await db.articles.bulkAdd(createArticleSeeds());
      }

      const campaignCount = await db.campaigns.count();
      if (campaignCount === 0) {
        await db.campaigns.bulkAdd(createCampaignSeeds());
      }
    })();
  }

  await seedPromise;
}
