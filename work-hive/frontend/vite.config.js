/** @type {import('vite').UserConfig} */
export default {
  server: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', '.up.railway.app']
  },
  preview: {
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', '.up.railway.app']
  }
};
