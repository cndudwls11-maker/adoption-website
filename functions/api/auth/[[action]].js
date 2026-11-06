import { authJson, getCurrentMember, login, logout, register } from '../auth-handlers.js';

const routes = new Map([
  ['register', { method: 'POST', handler: register }],
  ['login', { method: 'POST', handler: login }],
  ['me', { method: 'GET', handler: getCurrentMember }],
  ['logout', { method: 'POST', handler: logout }],
]);

export async function onRequest({ request, env, params }) {
  const [action, extra] = params.action ?? [];
  const route = extra === undefined ? routes.get(action) : undefined;
  if (!route) return authJson({ error: '인증 API 경로를 찾을 수 없습니다.' }, 404);
  if (request.method !== route.method) {
    return authJson({ error: '지원하지 않는 요청 방식입니다.' }, 405, { Allow: route.method });
  }

  try {
    return await route.handler(request, env);
  } catch (error) {
    console.error('Authentication API failed', { action, error: error?.name });
    return authJson({ error: '인증 요청을 처리하지 못했습니다.' }, 500);
  }
}
