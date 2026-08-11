// Central API & WebSocket configuration helper for browser client
export const getApiUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    // If running local standalone frontend dev server on port 3001, connect directly to backend port 3000
    if (window.location.port === '3001') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
  }
  // Behind Nginx reverse proxy or in production domain, relative path '/api' is used
  return '';
};

export const getWsUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '3001') {
      return `ws://${window.location.hostname}:3000`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return 'ws://localhost:3000';
};
