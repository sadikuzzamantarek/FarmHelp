import axios from "axios";

const BASE_URL = "http://192.168.1.112:3000";

// Timeout so the UI never hangs forever on an unreachable backend.
const api = axios.create({ baseURL: BASE_URL, timeout: 5000 });

export const fetchGraph = () => api.get("/graph").then((res) => res.data);
export const fetchProviders = () => api.get("/providers").then((res) => res.data);
export const fetchMeta = () => api.get("/meta").then((res) => res.data);

// Real-coordinate dataset (db.geo.json served by json-server)
export const fetchAllGeo = async () => {
  const [providers, meta] = await Promise.all([fetchProviders(), fetchMeta()]);
  return { providers, meta };
};

export default api;