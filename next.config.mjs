/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Compiler disabled for now; re-enable once babel-plugin-react-compiler is installed and configured.
  reactCompiler: false,
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
  },
};

export default nextConfig;
