import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ["postgres", "sharp"],
};
export default config;
