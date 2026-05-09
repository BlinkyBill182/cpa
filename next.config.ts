import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

const nextConfig: NextConfig = {
  turbopack: {
    root: dirName,
  },
};

export default nextConfig;
