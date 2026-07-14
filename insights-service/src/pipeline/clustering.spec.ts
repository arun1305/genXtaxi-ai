import { cosine, greedyCluster } from './clustering';

describe('clustering', () => {
  it('cosine is 1 for identical vectors and ~0 for orthogonal', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('groups similar vectors and separates dissimilar ones', () => {
    const items = [
      { text: 'dirty car', vector: [1, 0, 0] },
      { text: 'car was dirty', vector: [0.98, 0.02, 0] },
      { text: 'driver was late', vector: [0, 0, 1] },
    ];
    const clusters = greedyCluster(items, 0.6);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].members.length).toBe(2); // the two "dirty car" reviews
  });
});
