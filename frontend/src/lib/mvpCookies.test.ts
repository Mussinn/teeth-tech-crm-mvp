import {describe,it,expect,vi,afterEach} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
import {clearAuthCookies,isSecureRequest,AUTH_TOKEN_COOKIE} from './serverAuthCookies';
describe('MVP local-network authentication',()=>{
 afterEach(()=>vi.unstubAllEnvs());
 it('expires cookies without Secure on a production HTTP installation',()=>{
  vi.stubEnv('NODE_ENV','production');
  const response=NextResponse.json({ok:true});clearAuthCookies(response);
  const cookie=response.cookies.get(AUTH_TOKEN_COOKIE);
  expect(cookie?.maxAge).toBe(0);expect(cookie?.secure).toBe(false);
 });
 it('uses the public forwarded scheme for login cookies',()=>{
  expect(isSecureRequest(new NextRequest('http://frontend:3000',{headers:{'x-forwarded-proto':'http'}}))).toBe(false);
  expect(isSecureRequest(new NextRequest('http://frontend:3000',{headers:{'x-forwarded-proto':'https'}}))).toBe(true);
 });
});
