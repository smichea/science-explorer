// Local-first single-page application: no server rendering, no prerendering.
// Every route is served by the same shell and hydrates on the device.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
