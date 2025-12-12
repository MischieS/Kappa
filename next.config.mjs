/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Compiler disabled for now; re-enable once babel-plugin-react-compiler is installed and configured.
  reactCompiler: false,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
