const KEY = 'apex-digital-workspace-v1';
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const stages = ['Payment', 'Assets', 'Assembly', 'Launch'];
const money = n => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let state = { clients: [], requests: [] };
let view = 'overview';
// Server records are loaded after the admin session is verified.
function valid(data) {
  return Array.isArray(data.clients) && Array.isArray(data.requests)
    && data.clients.every(c => c && safeId(c.id)) && data.requests.every(r => r && safeId(r.id) && safeId(r.clientId))
    && data.clients.every(c => typeof c.id === 'string' && typeof c.name === 'string' && typeof c.industry === 'string' && typeof c.email === 'string' && typeof c.url === 'string' && Number.isFinite(c.monthly) && c.monthly >= 0 && Number.isFinite(c.setup) && c.setup >= 0 && ['onboarding','active','cancelled'].includes(c.status) && stages.includes(c.stage) && typeof c.paid === 'boolean' && typeof c.mandate === 'boolean')
    && data.requests.every(r => typeof r.id === 'string' && typeof r.title === 'string' && data.clients.some(c => c.id === r.clientId) && ['minor','custom'].includes(r.scope) && ['open','done'].includes(r.status) && Number.isFinite(r.hours) && r.hours > 0 && Number.isFinite(Date.parse(r.created)))
    && new Set(data.clients.map(c => c.id)).size === data.clients.length && new Set(data.requests.map(r => r.id)).size === data.requests.length;
}
let csrfToken;
let saveQueue = Promise.resolve();
async function persist() { const snapshot = JSON.stringify(state); const operation = saveQueue.then(async () => { const response = await fetch('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken }, body: snapshot }); if (response.status === 401) { location.assign('/admin'); throw new Error('Session expired'); } if (!response.ok) throw new Error('Could not save changes. Export your workspace now.'); }); saveQueue = operation.catch(() => {}); try { await operation; render(); return true; } catch (error) { toast(error.message); return false; } }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.style.display = 'none', 4000); }
function empty(title, description, action = '') { return `<div class="empty"><div class="empty-icon">◇</div><strong>${title}</strong><p>${description}</p>${action}</div>`; }
function clientRows(clients) { return clients.map(c => `<tr><td><strong>${escape(c.name)}</strong><small>${escape(c.industry)}</small></td><td>${money(c.monthly)}<small>per month</small></td><td><span class="tag">${escape(c.status)}</span></td><td>${escape(c.stage)}</td><td><select aria-label="Status for ${escape(c.name)}" data-status="${c.id}">${['onboarding','active','cancelled'].map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join(''); }
function clientTable(clients) { return `<div class="table-wrap"><table><thead><tr><th>Client</th><th>Subscription</th><th>Status</th><th>Launch stage</th><th>Manage</th></tr></thead><tbody>${clientRows(clients)}</tbody></table></div>`; }
function overview() {
  const active = state.clients.filter(c => c.status === 'active');
  const onboarding = state.clients.filter(c => c.status === 'onboarding');
  const open = state.requests.filter(r => r.status === 'open');
  const mrr = active.reduce((sum,c) => sum + c.monthly, 0);
  return `<div class="stats">${[['Monthly recurring revenue',money(mrr),'From active subscriptions'],['Active clients',active.length,'Your recurring revenue base'],['In onboarding',onboarding.length,'On the road to launch'],['Open edit requests',open.length,'48-hour target for minor edits']].map(([label,value,foot]) => `<div class="card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`).join('')}</div>
  <div class="two-col"><div class="card"><div class="card-top"><h2>Revenue outlook</h2><span class="tag">Current run rate</span></div><p class="muted">Six-month projection if current active subscriptions remain unchanged.</p><div class="chart">${Array.from({length:6}, () => `<div class="bar" style="height:${mrr ? 78 : 1}%" title="${money(mrr)} projected monthly revenue"></div>`).join('')}</div><div class="months">${Array.from({length:6},(_,i) => `<span>${new Date(new Date().getFullYear(),new Date().getMonth()+i,1).toLocaleDateString('en-MY',{month:'short'})}</span>`).join('')}</div><div class="plan-row"><span>Annual recurring revenue</span><b>${money(mrr * 12)}</b></div></div><div class="card"><div class="card-top"><h2>Your standard plan</h2><span class="tag">WaaS</span></div><div class="plan"><strong>One website. Ongoing peace of mind.</strong><div class="plan-row"><span>One-time setup</span><b>RM 499</b></div><div class="plan-row"><span>Monthly subscription</span><b>RM 399</b></div><div class="plan-row"><span>Minimum term</span><b>12 months</b></div><div class="plan-row"><span>Minimum contract value</span><b>RM 5,287</b></div></div><p class="muted">Includes one hour of minor edits per month. Custom work starts at RM 150/hour.</p></div></div>
  <div class="card section-gap"><div class="card-top"><h2>Onboarding pipeline</h2><button class="text-link" data-view="onboarding">View pipeline →</button></div><div class="pipeline">${stages.map((s,i) => `<div class="stage"><strong>${onboarding.filter(c => c.stage === s).length}</strong><span>0${i+1} · ${s}</span></div>`).join('')}</div></div><div class="card section-gap"><div class="card-top"><h2>Client portfolio</h2><button class="text-link" data-view="clients">All clients →</button></div>${state.clients.length ? clientTable(state.clients.slice(-5).reverse()) : empty('Your next client starts here','Add a business and turn a signed contract into recurring revenue.','<button class="text-link" data-add>Add your first client →</button>')}</div>`;
}
function clients() { return `<div class="card"><div class="card-top"><h2>All clients <span class="muted">· ${state.clients.length}</span></h2></div><div class="toolbar"><input id="search" placeholder="Search businesses…" aria-label="Search clients"></div><div id="client-list">${state.clients.length ? clientTable(state.clients) : empty('No clients yet','Add your first business to get started.')}</div></div>`; }
function onboarding() {
  const pending = state.clients.filter(c => c.status === 'onboarding');
  return `<div class="card"><h2>From contract to launch</h2><p class="muted">Confirm payment and recurring billing before assembly. Target launch: 48 hours after onboarding.</p></div><div class="board">${stages.map(s => `<div class="board-column"><h2>${s} <span class="muted">· ${pending.filter(c => c.stage === s).length}</span></h2>${pending.filter(c => c.stage === s).map(c => `<div class="client-tile"><strong>${escape(c.name)}</strong><span class="tiny">${escape(c.industry)}</span><label class="check"><input type="checkbox" data-check="paid" data-id="${c.id}" ${c.paid ? 'checked' : ''}>Setup payment received</label><label class="check"><input type="checkbox" data-check="mandate" data-id="${c.id}" ${c.mandate ? 'checked' : ''}>Recurring mandate authorized</label><label>Stage<select data-stage="${c.id}">${stages.map(stage => `<option ${c.stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select></label>${s === 'Assets' ? '<p class="tiny">Collect logo, photos, top 3 services, and Google Business Profile.</p>' : ''}${s === 'Launch' ? `<button class="text-link" data-activate="${c.id}">Mark website live →</button>` : ''}</div>`).join('') || '<p class="tiny">No clients at this stage</p>'}</div>`).join('')}</div>`;
}
function requests() { return `<div class="card"><div class="card-top"><h2>Content edits & custom work</h2><button class="primary" id="add-request">+ New request</button></div><p class="muted">Minor edits target 48 hours. Batch when possible; custom work is billed separately.</p>${state.requests.length ? `<div class="table-wrap"><table><thead><tr><th>Request</th><th>Scope / allowance</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.requests.map(r => {
    const c = state.clients.find(c => c.id === r.clientId);
    const due = new Date(Date.parse(r.created) + 48 * 3600000);
    const used = state.requests.filter(x => x.clientId === c.id && x.scope === 'minor' && x.created.slice(0,7) === r.created.slice(0,7)).reduce((s,x) => s+x.hours,0);
    return `<tr><td><strong>${escape(r.title)}</strong><small>${escape(c.name)}</small></td><td>${r.scope === 'custom' ? money(r.hours * 150) + ' estimate' : `${used.toFixed(2)} / 1 hour requested this month`}<small>${r.hours}h · ${r.scope === 'minor' && used > 1 ? 'Allowance exceeded — agree additional scope' : escape(r.scope)}</small></td><td class="${r.status === 'open' && due < new Date() && r.scope === 'minor' ? 'danger' : ''}">${r.scope === 'minor' ? due.toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'}) : 'Agree project timeline'}</td><td><span class="tag">${r.status}</span></td><td><button class="text-link" data-request-status="${r.id}">${r.status === 'open' ? 'Complete' : 'Reopen'}</button></td></tr>`;
  }).join('')}</tbody></table></div>` : empty('A clear queue, a clear head','Log client edits here to keep scope and turnaround under control.')}</div>`; }
function render() {
  const names = {overview:'Overview',clients:'Clients',onboarding:'Onboarding',requests:'Edit requests'};
  const titles = {overview:'A little clarity. A lot of growth.',clients:'Good relationships. Recurring revenue.',onboarding:'A smooth path to going live.',requests:'Small changes, kept in check.'};
  document.querySelector('#title').textContent = titles[view];
  document.querySelector('#breadcrumb').textContent = names[view];
  document.querySelector('#subtitle').textContent = view === 'overview' ? 'Keep your clients moving and your recurring revenue growing.' : 'A focused workspace for your Website-as-a-Service agency.';
  document.querySelectorAll('nav [data-view]').forEach(el => el.classList.toggle('selected',el.dataset.view === view));
  document.querySelector('.notice').style.display = state.clients.length ? 'none' : 'block';
  document.querySelector('#workspace').innerHTML = ({overview,clients,onboarding,requests})[view]();
}
function ready(c) { return c.paid && c.mandate; }
document.addEventListener('click', async e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.view) { view = button.dataset.view; render(); }
  if (button.id === 'add-client' || button.hasAttribute('data-add')) document.querySelector('#client-dialog').showModal();
  if (button.dataset.close) document.getElementById(button.dataset.close).close();
  if (button.id === 'add-request') {
    const eligible = state.clients.filter(c => c.status !== 'cancelled');
    if (!eligible.length) return toast('Add an active or onboarding client first.');
    document.querySelector('#request-client').innerHTML = eligible.map(c => `<option value="${c.id}">${escape(c.name)}</option>`).join('');
    document.querySelector('#request-dialog').showModal();
  }
  if (button.dataset.activate) { const c = state.clients.find(c => c.id === button.dataset.activate); if (!ready(c)) return toast('Confirm setup payment and recurring mandate first.'); c.status = 'active'; if (!await persist()) return; toast('Client is live. Subscription added to MRR.'); }
  if (button.dataset.requestStatus) { const r = state.requests.find(r => r.id === button.dataset.requestStatus); r.status = r.status === 'open' ? 'done' : 'open'; if (!await persist()) return; }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.check) { const c = state.clients.find(c => c.id === el.dataset.id); c[el.dataset.check] = el.checked; if (!ready(c)) c.stage = 'Payment'; if (!await persist()) return; }
  if (el.dataset.stage || el.dataset.status) {
    const c = state.clients.find(c => c.id === (el.dataset.stage || el.dataset.status));
    if ((el.dataset.stage && el.value !== 'Payment' || el.dataset.status && el.value === 'active') && !ready(c)) { toast('Confirm setup payment and recurring mandate in Onboarding first.'); render(); return; }
    c[el.dataset.stage ? 'stage' : 'status'] = el.value;
    if (c.status === 'active') c.stage = 'Launch';
    if (!await persist()) return;
  }
});
document.addEventListener('input', e => { if (e.target.id === 'search') { const query = e.target.value.toLowerCase(); document.querySelector('#client-list').innerHTML = clientTable(state.clients.filter(c => c.name.toLowerCase().includes(query) || c.industry.toLowerCase().includes(query))); } });
document.querySelector('#client-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.target); const name = form.get('name').trim(); if (!name) return toast('Enter a business name.');
  state.clients.push({id:crypto.randomUUID(),name,industry:form.get('industry'),email:form.get('email'),monthly:Number(form.get('monthly')),setup:Number(form.get('setup')),url:form.get('url'),stage:'Payment',status:'onboarding',paid:false,mandate:false,created:new Date().toISOString()});
  if (!await persist()) return; e.target.reset(); document.querySelector('#client-dialog').close(); toast('Client added to onboarding.');
});
document.querySelector('#request-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.target); const title = form.get('title').trim(); if (!title) return toast('Enter a request title.');
  state.requests.push({id:crypto.randomUUID(),clientId:form.get('clientId'),title,scope:form.get('scope'),hours:Number(form.get('hours')),status:'open',created:new Date().toISOString()});
  if (!await persist()) return; e.target.reset(); document.querySelector('#request-dialog').close(); toast('Request added.');
});
document.querySelector('#export').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = `apex-digital-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); });
document.querySelector('#import').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try { const imported = JSON.parse(await file.text()); if (!valid(imported)) throw new Error(); if (!confirm('Replace this browser’s workspace with the imported backup? Export existing data first if needed.')) return; state = imported; if (!await persist()) return; toast('Workspace restored.'); } catch { toast('Invalid backup. Your workspace was not changed.'); } finally { e.target.value = ''; }
});
async function start() {
  try {
    const sessionResponse = await fetch('/api/session');
    if (sessionResponse.status === 401) { location.assign('/admin'); return; }
    if (!sessionResponse.ok) throw new Error('Unable to verify admin session.');
    csrfToken = (await sessionResponse.json()).csrf;
    const response = await fetch('/api/workspace');
    if (!response.ok) throw new Error('Unable to load workspace.');
    state = await response.json();
    if (!valid(state)) throw new Error('Invalid server workspace.');
    const legacy = localStorage.getItem(KEY);
    if (legacy && state.clients.length === 0 && state.requests.length === 0) {
      const previous = JSON.parse(legacy);
      if (valid(previous) && (previous.clients.length || previous.requests.length)) {
        state = previous;
        if (!await persist()) return;
        localStorage.removeItem(KEY);
        toast('Previous browser records moved to your private admin workspace.');
      }
    }
    render();
  } catch (error) { document.querySelector('#workspace').textContent = error.message + ' Reload to try again.'; }
}
document.querySelector('#logout').addEventListener('click', async () => {
  const response = await fetch('/api/logout', {method:'POST',headers:{'x-csrf-token':csrfToken}});
  if (response.ok || response.status === 401) location.assign('/admin'); else toast('Unable to sign out. Try again.');
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
start();
