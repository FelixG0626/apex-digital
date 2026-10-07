import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {randomBytes,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const scrypt=promisify(derive), root=new URL('./',import.meta.url);
const production=process.env.NODE_ENV==='production';
const dataRoot=process.env.DATA_DIR?pathToFileURL(resolve(process.env.DATA_DIR)+'/'):new URL('data/',root);
const appOrigin=process.env.APP_URL?new URL(process.env.APP_URL).origin:null;
if(production&&(!appOrigin||!appOrigin.startsWith('https://')))throw Error('Production requires an HTTPS APP_URL');
await mkdir(dataRoot,{recursive:true});
let admin, workspace;
try {admin=JSON.parse(await readFile(new URL('admin.json',dataRoot),'utf8'));}
catch(e){if(e.code!=='ENOENT') throw e; if(production&&(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16))throw Error('First production start requires ADMIN_PASSWORD of at least 16 characters'); const password=process.env.ADMIN_PASSWORD||randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex'); admin={username:process.env.ADMIN_USERNAME||'admin',salt,hash:(await scrypt(password,salt,64)).toString('hex')}; await writeFile(new URL('admin.json',dataRoot),JSON.stringify(admin),{flag:'wx',mode:0o600}); if(!production)await writeFile(new URL('admin-credentials.txt',dataRoot),`Username: ${admin.username}\nPassword: ${password}\nLogin: http://localhost:8100/admin\nKeep this file private.\n`,{flag:'wx',mode:0o600});}
const file=new URL('workspace.json',dataRoot);
try{workspace=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;workspace={clients:[],requests:[]};}
const sessions=new Map(), attempts=new Map();
const routes={'/':['home.html','text/html'],'/home.css':['home.css','text/css'],'/admin':['admin.html','text/html'],'/admin.js':['admin.js','text/javascript'],'/style.css':['style.css','text/css'],'/workspace':['workspace.html','text/html'],'/app.js':['app.js','text/javascript']};
routes['/home.js']=['home.js','text/javascript'];
const privatePaths=new Set(['/workspace','/app.js']);
const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.length<=max;
function valid(s){return s&&Array.isArray(s.clients)&&Array.isArray(s.requests)&&s.clients.length<=10000&&s.requests.length<=50000&&s.clients.every(c=>c&&safeId(c.id)&&text(c.name,100)&&c.name.trim()&&text(c.industry,100)&&text(c.email,150)&&text(c.url,250)&&['onboarding','active','cancelled'].includes(c.status)&&['Payment','Assets','Assembly','Launch'].includes(c.stage)&&typeof c.paid==='boolean'&&typeof c.mandate==='boolean'&&Number.isFinite(c.monthly)&&c.monthly>=0&&Number.isFinite(c.setup)&&c.setup>=0&&(c.status!=='active'||c.paid&&c.mandate))&&s.requests.every(r=>r&&safeId(r.id)&&s.clients.some(c=>c.id===r.clientId)&&text(r.title,160)&&r.title.trim()&&['minor','custom'].includes(r.scope)&&['open','done'].includes(r.status)&&Number.isFinite(r.hours)&&r.hours>0&&r.hours<=1000&&Number.isFinite(Date.parse(r.created)))&&new Set(s.clients.map(c=>c.id)).size===s.clients.length&&new Set(s.requests.map(r=>r.id)).size===s.requests.length;}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>5*1024*1024)throw Error('Payload too large');}return JSON.parse(raw);}
function token(req){return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('apex_session='))?.slice(13);}
function redirect(res,path){res.writeHead(303,{Location:path});res.end();}
let queue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 const path=new URL(req.url,'http://localhost').pathname,key=token(req);let session=sessions.get(key);if(session&&session.expires<=Date.now()){sessions.delete(key);session=null;}
 try{
  if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==(appOrigin||`http://${req.headers.host}`))return json(res,403,{error:'Request origin rejected'});
  if(path==='/api/login'&&req.method==='POST'){
   const ip=req.socket.remoteAddress,record=attempts.get(ip);if(record&&record.until>Date.now()&&record.count>=5)return json(res,429,{error:'Too many attempts. Try again in 15 minutes.'});
   const input=await body(req);if(!text(input.password,200)||!text(input.username,64))return json(res,400,{error:'Invalid login'});
   const hash=await scrypt(input.password,admin.salt,64);
   if(input.username!==admin.username||!timingSafeEqual(hash,Buffer.from(admin.hash,'hex'))){attempts.set(ip,{count:record?.until>Date.now()?record.count+1:1,until:Date.now()+900000});return json(res,401,{error:'Incorrect username or password'});}
   attempts.delete(ip);const sessionKey=randomBytes(32).toString('hex');sessions.set(sessionKey,{csrf:randomBytes(32).toString('hex'),expires:Date.now()+28800000});res.setHeader('Set-Cookie',`apex_session=${sessionKey}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`);return json(res,200,{ok:true});
  }
  if(path.startsWith('/api/')){
   if(!session)return json(res,401,{error:'Admin login required'});
   if(path==='/api/session'&&req.method==='GET')return json(res,200,{username:admin.username,csrf:session.csrf});
   if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)return json(res,403,{error:'CSRF token required'});
   if(path==='/api/logout'&&req.method==='POST'){sessions.delete(key);res.setHeader('Set-Cookie',`apex_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`);return json(res,200,{ok:true});}
   if(path==='/api/workspace'&&req.method==='GET')return json(res,200,workspace);
   if(path==='/api/workspace'&&req.method==='PUT'){const incoming=await body(req);if(!valid(incoming))return json(res,422,{error:'Invalid workspace data'});const operation=queue.then(async()=>{const tmp=new URL('workspace.tmp',dataRoot);await writeFile(tmp,JSON.stringify(incoming,null,2),{mode:0o600});await rename(tmp,file);workspace=incoming;});queue=operation.catch(()=>{});await operation;return json(res,200,{ok:true});}
   return json(res,404,{error:'Not found'});
  }
  if(privatePaths.has(path)&&!session){if(path==='/workspace')return redirect(res,'/admin');return json(res,401,{error:'Admin login required'});}
  if(path==='/admin'&&session)return redirect(res,'/workspace');
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  const route=routes[path];if(!route)return json(res,404,{error:'Not found'});const content=await readFile(new URL(`public/${route[0]}`,root));res.writeHead(200,{'Content-Type':`${route[1]}; charset=utf-8`});res.end(req.method==='HEAD'?undefined:content);
 }catch(e){console.error(e.message);json(res,400,{error:'Unable to process request'});}
});
setInterval(()=>{for(const[k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);for(const[k,v]of attempts)if(v.until<Date.now())attempts.delete(k);},60000).unref();
server.listen(Number(process.env.PORT||8100),process.env.HOST||(production?'0.0.0.0':'127.0.0.1'),()=>console.log(`Apex Digital listening on port ${process.env.PORT||8100}`));
