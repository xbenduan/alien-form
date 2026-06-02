import Dexie, { type Table } from 'dexie';
import type { ModelRecord, RuntimeModelRecord, RuntimeModelSchemaRecord } from '../../domains/record/types/record';
import { createNailBookingSeeds, createNailEmployeeSeeds, createNailServiceSeeds } from './seeds';

export class AlienCmsDatabase extends Dexie {
  employees!: Table<ModelRecord, string>;
  services!: Table<ModelRecord, string>;
  bookings!: Table<ModelRecord, string>;
  modelSchemas!: Table<RuntimeModelSchemaRecord, string>;
  modelRecords!: Table<RuntimeModelRecord, string>;

  constructor() {
    super('alien-cms');
    this.version(6).stores({
      employees: 'id, level, hiredAt, updatedAt, createdAt',
      services: 'id, category, difficulty, updatedAt, createdAt',
      bookings: 'id, status, serviceId, employeeId, bookingDate, updatedAt, createdAt',
      modelSchemas: 'id, modelName, updatedAt, createdAt',
      modelRecords: 'id, modelName, updatedAt, createdAt',
    });
  }
}

export const db = new AlienCmsDatabase();

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseReady() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await db.transaction('rw', db.employees, db.services, db.bookings, async () => {
        await db.employees.clear();
        await db.services.clear();
        await db.bookings.clear();
        await db.employees.bulkPut(createNailEmployeeSeeds());
        await db.services.bulkPut(createNailServiceSeeds());
        await db.bookings.bulkPut(createNailBookingSeeds());
      });
    })();
  }

  await seedPromise;
}
