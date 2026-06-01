import type { DataProvider } from '../../types/model';
import { DexieRepository } from '../repository/dexie-repository';

const repository = new DexieRepository();

export const localDataProvider: DataProvider = {
  list: ({ model, filters, pagination, sorter }) =>
    repository.list({ model, filters, pagination, sorter }),
  detail: ({ model, id }) => repository.detail(model, id),
  create: ({ model, values }) => repository.create(model, values),
  update: ({ model, id, values }) => repository.update(model, id, values),
  remove: ({ model, id }) => repository.remove(model, id),
};
