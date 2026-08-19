// Polyfill performance for React Native (or any non-Node environment)
const performance = { now: () => Date.now() };

/**
 * Min-heap implementation for priority queue
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._siftDown(0);
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }

  _siftUp(idx) {
    const heap = this.heap;
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (heap[idx][0] >= heap[parentIdx][0]) break;
      [heap[idx], heap[parentIdx]] = [heap[parentIdx], heap[idx]];
      idx = parentIdx;
    }
  }

  _siftDown(idx) {
    const heap = this.heap;
    const n = heap.length;
    while (true) {
      let left = 2 * idx + 1;
      let right = 2 * idx + 2;
      let smallest = idx;
      if (left < n && heap[left][0] < heap[smallest][0]) smallest = left;
      if (right < n && heap[right][0] < heap[smallest][0]) smallest = right;
      if (smallest === idx) break;
      [heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
      idx = smallest;
    }
  }
}

/**
 * Bounded Dijkstra: finds all provider nodes within maxDistanceKm.
 * Returns an object { providerNode: distance_km, ... }.
 */
function boundedDijkstra(graph, start, maxDistanceKm) {
  const distances = { [start]: 0 };
  const pq = new MinHeap();
  const visited = new Set();

  pq.push([0, start]);

  while (pq.size > 0) {
    const [dist, node] = pq.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    if (dist > maxDistanceKm) continue;

    for (const [neighbor, edgeKm] of Object.entries(graph[node])) {
      const newDist = dist + edgeKm;
      if (!(neighbor in distances) || newDist < distances[neighbor]) {
        distances[neighbor] = newDist;
        pq.push([newDist, neighbor]);
      }
    }
  }

  // Return only provider nodes (those starting with 'Provider_')
  const result = {};
  for (const [n, d] of Object.entries(distances)) {
    if (d <= maxDistanceKm && n.startsWith("Provider_")) {
      result[n] = d;
    }
  }
  return result;
}

/**
 * Rank providers within distance, applying cost and availability filters.
 * Returns a sorted array of [score, providerNode, distance, totalCost].
 */
function rankProviders(providersWithinDist, providersData, farmerRequest) {
  const candidates = [];
  const reqType = farmerRequest.service_type;
  const maxCost = farmerRequest.max_total_cost_tk;
  const maxDist = farmerRequest.max_distance_km;
  const travelRate = farmerRequest.travel_cost_per_km_tk;

  for (const [providerNode, distKm] of Object.entries(providersWithinDist)) {
    const pdata = providersData[providerNode];
    if (!pdata) continue;

    const services = pdata.services || {};
    if (!(reqType in services)) continue;

    const serviceInfo = services[reqType];
    // per‑service availability check
    if (!serviceInfo.available) continue;

    // Calculate service cost
    let serviceCost;
    if (reqType === "tractor" || reqType === "sprayer") {
      const acres = farmerRequest.acres || 0;
      serviceCost = serviceInfo.price_per_acre * acres;
    } else {
      // seed
      const kg = farmerRequest.kg_needed || 0;
      serviceCost = serviceInfo.price_per_kg * kg;
    }

    const travelCost = distKm * travelRate;
    const totalCost = travelCost + serviceCost;

    if (totalCost > maxCost) continue;

    // Normalize and compute score (lower is better)
    const costNorm = totalCost / maxCost;
    const distNorm = distKm / maxDist;
    const score = 0.7 * costNorm + 0.3 * distNorm;

    candidates.push([score, providerNode, distKm, totalCost]);
  }

  candidates.sort((a, b) => a[0] - b[0]);
  return candidates;
}

/**
 * Main FarmMatch entry point.
 * @param {Object} graph - adjacency list { node: { neighbor: distance_km, ... }, ... }
 * @param {Object} providersData - { providerNode: { location, services: { serviceType: { price_per_acre/kg, available } } } }
 * @param {Object} farmerRequest - { location, service_type, acres, kg_needed, max_distance_km, max_total_cost_tk, travel_cost_per_km_tk }
 * @returns {Object} - { best_provider, best_distance_km, best_total_cost_tk, ranked_candidates, dijkstra_time_ms, ranking_time_ms, success }
 */
export function farmMatch(graph, providersData, farmerRequest) {
  const start = farmerRequest.location;
  const maxDist = farmerRequest.max_distance_km;

  const t0 = performance.now();
  const providersInRange = boundedDijkstra(graph, start, maxDist);
  const dijkstraTime = performance.now() - t0;

  const t1 = performance.now();
  const ranked = rankProviders(providersInRange, providersData, farmerRequest);
  const rankingTime = performance.now() - t1;

  const best = ranked.length > 0 ? ranked[0] : null;

  return {
    best_provider: best ? best[1] : null,
    best_distance_km: best ? best[2] : null,
    best_total_cost_tk: best ? best[3] : null,
    ranked_candidates: ranked,
    dijkstra_time_ms: dijkstraTime,
    ranking_time_ms: rankingTime,
    success: best !== null,
  };
}
