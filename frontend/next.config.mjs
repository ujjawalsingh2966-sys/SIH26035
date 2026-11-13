// Keep browser API requests on the W8LAB origin. Next.js forwards them to
// the configured Express backend, avoiding CORS and third-party cookie issues.
const backendUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

export default {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};
