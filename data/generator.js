const fs = require("fs");

// ---------- Helpers ----------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPosition(rows, cols) {
  return `R${randomInt(0, rows - 1)}C${randomInt(0, cols - 1)}`;
}

// ---------- Graph (10x10 grid, step=2 km) ----------
function generateGridGraph(rows = 10, cols = 10, stepKm = 2) {
  const graph = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const node = `R${r}C${c}`;
      graph[node] = {};
      if (r > 0) graph[node][`R${r - 1}C${c}`] = stepKm;
      if (r < rows - 1) graph[node][`R${r + 1}C${c}`] = stepKm;
      if (c > 0) graph[node][`R${r}C${c - 1}`] = stepKm;
      if (c < cols - 1) graph[node][`R${r}C${c + 1}`] = stepKm;
    }
  }
  return graph;
}

// ---------- Providers (100) ----------
function generateProviders(num = 100, rows = 10, cols = 10) {
  const providers = {};
  const serviceTypes = ["tractor", "sprayer", "seed"];

  for (let i = 0; i < num; i++) {
    const node = `Provider_${i}`;
    const numServices = randomInt(1, 3);
    const chosen = serviceTypes
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, numServices);

    const services = {};
    for (const st of chosen) {
      if (st === "tractor" || st === "sprayer") {
        services[st] = {
          price_per_acre: randomInt(150, 350),
          available: Math.random() < 0.8,
        };
      } else {
        // seed
        services[st] = {
          price_per_kg: randomInt(100, 250),
          available: Math.random() < 0.8,
        };
      }
    }
    providers[node] = {
      location: randomPosition(rows, cols),
      services,
    };
  }
  return providers;
}

// ---------- Farmers (100) ----------
function generateFarmers(num = 100, rows = 10, cols = 10) {
  const farmers = [];
  const serviceTypes = ["tractor", "sprayer", "seed"];

  for (let i = 0; i < num; i++) {
    const reqType = pickRandom(serviceTypes);
    const farmer = {
      id: `Farmer_${i}`,
      location: randomPosition(rows, cols),
      service_type: reqType,
      max_distance_km: randomInt(8, 20),
      max_total_cost_tk: randomInt(800, 2500),
      travel_cost_per_km_tk: 10,
      acres: 0,
      kg_needed: 0,
    };

    if (reqType === "tractor" || reqType === "sprayer") {
      farmer.acres = randomInt(2, 10);
    } else {
      farmer.kg_needed = randomInt(5, 30);
    }
    farmers.push(farmer);
  }
  return farmers;
}

// ---------- Embed provider nodes into graph ----------
function embedProviders(graph, providers) {
  const fullGraph = JSON.parse(JSON.stringify(graph));
  for (const [prov, pdata] of Object.entries(providers)) {
    const loc = pdata.location;
    fullGraph[prov] = { [loc]: 0 };
    if (!fullGraph[loc]) fullGraph[loc] = {};
    fullGraph[loc][prov] = 0;
  }
  return fullGraph;
}

// ---------- Main ----------
function main() {
  const ROWS = 10,
    COLS = 10;
  const grid = generateGridGraph(ROWS, COLS, 2);
  const providers = generateProviders(100, ROWS, COLS);
  const fullGraph = embedProviders(grid, providers);
  const farmers = generateFarmers(100, ROWS, COLS);

  const db = { graph: fullGraph, providers, farmers };
  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
  console.log("✅ db.json generated with 100 providers and 100 farmers.");
}

main();
