import Dexie, { type Table } from 'dexie';
import type { ModelRecord, RuntimeModelRecord, RuntimeModelSchemaRecord } from '../../types/model';
import { createArticleSeeds, createCampaignSeeds, createNailBookingSeeds } from './seeds';

export class AlienCmsDatabase extends Dexie {
  articles!: Table<ModelRecord, string>;
  campaigns!: Table<ModelRecord, string>;
  nailBookings!: Table<ModelRecord, string>;
  modelSchemas!: Table<RuntimeModelSchemaRecord, string>;
  modelRecords!: Table<RuntimeModelRecord, string>;

  constructor() {
    super('alien-cms');
    this.version(1).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
    });
    this.version(2).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
      campaigns: 'id, status, channel, owner, launchDate, createdAt, updatedAt',
    });
    this.version(3).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
      campaigns: 'id, status, channel, owner, launchDate, createdAt, updatedAt',
      nailBookings: 'id, status, serviceType, nailArtist, branch, bookingDate, createdAt, updatedAt',
    });
    this.version(4).stores({
      articles: 'id, status, category, author, publishTime, createdAt, updatedAt',
      campaigns: 'id, status, channel, owner, launchDate, createdAt, updatedAt',
      nailBookings: 'id, status, serviceType, nailArtist, branch, bookingDate, createdAt, updatedAt',
      modelSchemas: 'id, modelName, updatedAt, createdAt',
      modelRecords: 'id, modelName, updatedAt, createdAt',
    });
  }
}

export const db = new AlienCmsDatabase();

let seedPromise: Promise<void> | null = null;

async function ensureCampaignSeedShape() {
  const campaignSeeds = createCampaignSeeds();
  const existingRows = await db.campaigns.bulkGet(campaignSeeds.map((item) => item.id));
  const rowsToUpdate = campaignSeeds
    .map((seed, index) => {
      const current = existingRows[index];
      if (!current) {
        return null;
      }

      if (
        current.targeting !== undefined &&
        current.materials !== undefined &&
        current.landingPage !== undefined &&
        current.trackingCode !== undefined &&
        current.syncCrm !== undefined &&
        current.deliveryNotes !== undefined
      ) {
        return null;
      }

      return {
        ...current,
        targeting: current.targeting ?? seed.targeting,
        materials: current.materials ?? seed.materials,
        landingPage: current.landingPage ?? seed.landingPage,
        trackingCode: current.trackingCode ?? seed.trackingCode,
        syncCrm: current.syncCrm ?? seed.syncCrm,
        deliveryNotes: current.deliveryNotes ?? seed.deliveryNotes,
      };
    })
    .filter(Boolean);

  if (rowsToUpdate.length > 0) {
    await db.campaigns.bulkPut(rowsToUpdate as typeof campaignSeeds);
  }
}

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
      } else {
        await ensureCampaignSeedShape();
      }

      const nailBookingCount = await db.nailBookings.count();
      if (nailBookingCount === 0) {
        await db.nailBookings.bulkAdd(createNailBookingSeeds());
      }
    })();
  }

  await seedPromise;
}
