import axios from "axios";

const BASE_URL = "http://192.168.1.103:3000"; // replace with your computer's LAN IP

export const fetchGraph = () =>
  axios.get(`${BASE_URL}/graph`).then((res) => res.data);
export const fetchProviders = () =>
  axios.get(`${BASE_URL}/providers`).then((res) => res.data);

// Optional: fetch both in parallel
export const fetchAllData = async () => {
  const [graph, providers] = await Promise.all([
    fetchGraph(),
    fetchProviders(),
  ]);
  return { graph, providers };
};
