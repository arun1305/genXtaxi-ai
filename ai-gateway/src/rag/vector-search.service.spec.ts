import { VectorSearchService } from './vector-search.service';

const hit = { content: 'c', lang: 'fr', docId: 'd', metadata: {}, score: 0.9 };

function make(aggregate: jest.Mock, chunks: unknown[] = []) {
  const model = {
    aggregate,
    find: () => ({ limit: () => ({ lean: async () => chunks }) }),
  };
  return new VectorSearchService(model as never);
}

describe('VectorSearchService', () => {
  it('returns $vectorSearch hits when present', async () => {
    const svc = make(jest.fn().mockResolvedValue([hit]));
    await expect(svc.search([1, 0], 'fr')).resolves.toEqual([hit]);
  });

  it('falls back to cosine when $vectorSearch returns no hits', async () => {
    const svc = make(jest.fn().mockResolvedValue([]), [
      { content: 'near', lang: 'fr', docId: 'a', embedding: [1, 0] },
      { content: 'far', lang: 'fr', docId: 'b', embedding: [0, 1] },
    ]);
    const out = await svc.search([1, 0], 'fr', 1);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe('near');
  });

  it('falls back to cosine when $vectorSearch throws', async () => {
    const svc = make(jest.fn().mockRejectedValue(new Error('no index')), [
      { content: 'x', lang: 'fr', docId: 'a', embedding: [1, 0] },
    ]);
    await expect(svc.search([1, 0], 'fr')).resolves.toHaveLength(1);
  });
});
