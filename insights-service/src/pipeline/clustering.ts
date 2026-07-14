/** Lightweight greedy cosine clustering (avoids a heavy ML dep) for complaint grouping. */
export interface Clusterable {
  text: string;
  vector: number[];
}

export interface Cluster {
  members: Clusterable[];
  centroid: number[];
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Greedy single-pass clustering by a similarity threshold. */
export function greedyCluster(items: Clusterable[], threshold = 0.6): Cluster[] {
  const clusters: Cluster[] = [];
  for (const item of items) {
    let best: Cluster | null = null;
    let bestSim = threshold;
    for (const c of clusters) {
      const sim = cosine(item.vector, c.centroid);
      if (sim >= bestSim) {
        best = c;
        bestSim = sim;
      }
    }
    if (best) {
      best.members.push(item);
      best.centroid = mean([...best.members.map((m) => m.vector)]);
    } else {
      clusters.push({ members: [item], centroid: item.vector });
    }
  }
  return clusters.sort((a, b) => b.members.length - a.members.length);
}

function mean(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  return out.map((x) => x / vectors.length);
}
