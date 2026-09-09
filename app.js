import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, onSnapshot, setDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const FB = { apiKey:"AIzaSyBM6Ohu0xd39ihz0--nhekwuKSoUvcMWGs", authDomain:"tmg-landscape.firebaseapp.com", projectId:"tmg-landscape", storageBucket:"tmg-landscape.firebasestorage.app", messagingSenderId:"51507827374", appId:"1:51507827374:web:31bdb51948527b7535d33f" };
const app = initializeApp(FB);
const db = getFirestore(app);
const COL = 'companies';
const SCORE_COLS = ['Market Traction','Product Differentiation','Capital Efficiency','Clinical Validation','AI Actionability','Regulatory Complexity','Personalization Depth','Data Moat','Scalability'];

let allData=[], filteredData=[], curView='targets', curSection='dashboard';
let sortCol='', sortDir=1, curPrompt='newsletter', curVis='architecture', cmpPrompt='compare', numCmpSlots=3;
let charts={}, visCharts={}, claudePromptType='overview', claudePayload='';

const exp = {setView,showSection,openAddModal,closeAddModal,saveCompany,openSettings,closeSettings,saveSettings,applyFilters,srt,openPanel,closePanel,editCompany,deleteCompany,addLink,delLink,saveNotes,renderCompare,addCmpSlot,selPrompt,selCmpPrompt,generateAI,generateCmpAI,copyAI,copyCmpAI,saveKey,updateKeyLabel,setVis,exportCSV,importFromSheet,dlVis,dlChart,updateMatrix,updateBubble,updateRadar,dlRadarChart,renderVis,scrapeAndFill,openClaudeModal,closeClaudeModal,setClaude,copyForClaude,openClaude,loadData};
Object.entries(exp).forEach(([k,v])=>window[k]=v);
window.updateRadar=updateRadar;window.dlRadarChart=dlRadarChart;window.updateVCStyle=updateVCStyle;

onSnapshot(collection(db,COL),(snap)=>{
  // Deduplicate by Company Name - keep most recent if dupes exist
  const raw=snap.docs.map(d=>({...d.data(),_id:d.id}));
  const seen=new Map();
  raw.forEach(r=>{const n=r['Company Name']||'';if(!seen.has(n)||r['Last Updated']>seen.get(n)['Last Updated'])seen.set(n,r);});
  allData=[...seen.values()];
  document.getElementById('loadingMsg').style.display='none';
  document.getElementById('syncDot').className='sync-dot live';
  document.getElementById('lastUpd').textContent='Live - '+new Date().toLocaleTimeString();
  applyView(); if(curSection)showSection(curSection,true); populateCmpSelects();
},(err)=>{document.getElementById('loadingMsg').textContent='Firebase failed. Go to Firebase Console - Firestore - Rules - set allow read,write: if true';console.error(err);});

function loadData(){document.getElementById('lastUpd').textContent='Refreshed '+new Date().toLocaleTimeString();}

function init(){
  const load=(id,key)=>{const v=localStorage.getItem(key);if(v&&document.getElementById(id))document.getElementById(id).value=v;};
  load('s_geminiKey','tmg_geminiKey');load('s_claudeKey','tmg_claudeKey');load('s_workspaceId','tmg_workspaceId');load('s_groqKey','tmg_groqKey');
  const p=localStorage.getItem('tmg_provider')||'groq';
  ['aiProvider','s_provider'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=p;});
  updateKeyLabel();
}
init();

function setView(v,btn){
  curView=v;
  if(btn){const tog=btn.closest('.view-toggle');if(tog)tog.querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  applyView();
}
function applyView(){
  const base=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  filteredData=base; renderStats(base); renderCharts(base); applyFilters();
  if(curSection==='visuals')renderVis();
}
function showSection(id){
  curSection=id;
  document.querySelectorAll('.section-wrap').forEach(s=>s.classList.remove('active'));
  document.getElementById('sec-'+id)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const map={dashboard:0,companies:1,compare:2,visuals:3};
  document.querySelectorAll('.nav-btn')[map[id]]?.classList.add('active');
  if(id==='visuals')renderVis();
  if(id==='compare')renderCompare();
}

function renderStats(data){
  const s=data.filter(r=>r['Company Type']==='Startup').length;
  const p=data.filter(r=>r['TMG Interest Level']==='Priority').length;
  const inc=data.filter(r=>['Incumbent','Acquirer'].includes(r['Company Type'])).length;
  const raising=data.filter(r=>r['Estimated Runway (months)']&&+r['Estimated Runway (months)']<=12).length;
  document.getElementById('statsRow').innerHTML=`
    <div class="stat-card"><div class="stat-val">${s}</div><div class="stat-lbl">Startups tracked</div></div>
    <div class="stat-card s2"><div class="stat-val">${p}</div><div class="stat-lbl">Priority targets</div></div>
    <div class="stat-card s4"><div class="stat-val">${raising}</div><div class="stat-lbl">Raising soon (&lt;12mo runway)</div></div>
    <div class="stat-card s5"><div class="stat-val">${inc}</div><div class="stat-lbl">Incumbents & acquirers</div></div>`;
}

function cnt(data,key){return data.reduce((a,r)=>{const v=r[key]||'Unknown';a[v]=(a[v]||0)+1;return a;},{});}
function renderCharts(data){
  Object.values(charts).forEach(c=>c.destroy());charts={};
  const ORG='#e07535',NAV='#162535',GRN='#2a7f5f',RSE='#b85050',PUR='#6a3fa0';
  const PAL=[ORG,NAV,GRN,RSE,PUR,'#c9a84c','#3a8fa0','#7a5f30','#2a5f8f','#a05030'];
  const sc=cnt(data,'Sub-category');
  const total=Object.values(sc).reduce((a,b)=>a+b,0);
  charts.cPie=new Chart(document.getElementById('cPie'),{type:'doughnut',data:{labels:Object.keys(sc),datasets:[{data:Object.values(sc),backgroundColor:PAL,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:9},boxWidth:9,padding:7}},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`}},datalabels:{display:false}}}});
  const stgOrder=['Pre-seed','Seed','Series A','Series B','Public'];
  const stgCnt=cnt(data,'Stage');const sl=stgOrder.filter(s=>stgCnt[s]);
  charts.cFunding=new Chart(document.getElementById('cFunding'),{type:'bar',data:{labels:sl,datasets:[{data:sl.map(s=>stgCnt[s]||0),backgroundColor:[ORG,NAV,GRN,RSE,PUR],borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'#eef2f6'},ticks:{stepSize:1}}}}});
  const hc=cnt(data,'Healthspan Target');
  charts.cHealth=new Chart(document.getElementById('cHealth'),{type:'bar',data:{labels:Object.keys(hc),datasets:[{data:Object.values(hc),backgroundColor:GRN,borderRadius:5,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#eef2f6'},ticks:{stepSize:1}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
  // 4th dashboard slot = Live Intelligence Feed (AI-generated, not a chart)
  renderLiveFeed();
}
function dlChart(id){const c=charts[id];if(!c)return;const a=document.createElement('a');a.download=id+'_TMG.png';a.href=c.toBase64Image('image/png',1);a.click();}

function renderLiveFeed(){
  const el=document.getElementById('liveFeedPanel');if(!el)return;
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div style="font-size:12px;font-weight:600;color:var(--ink)">Live Market Intelligence</div>
    <button onclick="refreshFeed()" style="padding:4px 11px;background:var(--orange);border:none;color:white;border-radius:5px;font-size:10px;cursor:pointer;font-family:inherit">Refresh</button>
  </div>
  <div id="feedContent" style="font-size:11px;color:var(--ink-muted);font-style:italic">Click Refresh to load AI-generated market intelligence for TMG focus areas.</div>`;
}
window.refreshFeed=async function(){
  const el=document.getElementById('feedContent');if(!el)return;
  el.innerHTML='<div style="color:var(--ink-muted);font-style:italic">Generating intelligence brief...</div>';
  const data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  const tracked=data.map(r=>r['Company Name']).join(', ');
  const prompt='You are a market intelligence analyst for The March Group (TMG), a VC fund focused on the Consumer Healthspan Economy covering Precision Nutrition, Intelligent Health, and Food and Medicine. Generate a brief market intelligence update with exactly 4 items. Format as a JSON array: [{"category":"Regulatory","headline":"...","detail":"...","relevance":"..."},{"category":"Clinical","headline":"...","detail":"...","relevance":"..."},{"category":"Capital","headline":"...","detail":"...","relevance":"..."},{"category":"Technology","headline":"...","detail":"...","relevance":"..."}]. Categories must be one of: Regulatory, Clinical, Capital, Technology, Consumer. Each headline max 10 words. Each detail 1-2 sentences. Relevance = how it affects the TMG portfolio: '+tracked+'. Return ONLY the JSON array, no markdown, no explanation.';
  const result=await callAI(prompt);
  try{
    const items=JSON.parse(result.replace(/```json|```/g,'').trim());
    const catColors={Regulatory:'#7c3aed',Clinical:'#16a34a',Capital:'#e07535',Technology:'#2563eb',Consumer:'#db2777'};
    el.innerHTML=items.map(item=>`
      <div style="padding:8px 10px;background:var(--slate);border-radius:7px;margin-bottom:7px;border-left:3px solid ${catColors[item.category]||'#888'}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="font-size:9px;font-weight:600;color:${catColors[item.category]||'#888'};text-transform:uppercase">${item.category}</span>
          <span style="font-size:11px;font-weight:600;color:var(--ink)">${item.headline}</span>
        </div>
        <div style="font-size:10px;color:var(--ink-soft);margin-bottom:2px">${item.detail}</div>
        <div style="font-size:10px;color:var(--orange)">TMG relevance: ${item.relevance}</div>
      </div>`).join('');
  }catch(e){
    el.innerHTML='<div style="color:var(--ink-soft)">'+result.slice(0,400)+'</div>';
  }
};

function applyFilters(){
  const q=(document.getElementById('srch')||{value:''}).value.toLowerCase();
  const ff=(document.getElementById('fFocus')||{value:''}).value;
  const fs=(document.getElementById('fStage')||{value:''}).value;
  const fi=(document.getElementById('fInterest')||{value:''}).value;
  const ft=(document.getElementById('fType')||{value:''}).value;
  const fp=(document.getElementById('fPedigree')||{value:''}).value;
  const base=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  filteredData=base.filter(r=>{
    if(q&&!Object.values(r).join(' ').toLowerCase().includes(q))return false;
    if(ff&&r['TMG Focus Area']!==ff)return false;
    if(fs&&r['Stage']!==fs)return false;
    if(fi&&r['TMG Interest Level']!==fi)return false;
    if(ft&&r['Company Type']!==ft)return false;
    if(fp&&r['Founder Pedigree']!==fp)return false;
    return true;
  });
  const fc=document.getElementById('fCount');if(fc)fc.textContent=filteredData.length+' companies';
  renderTable();
}
function srt(col){if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1;}filteredData.sort((a,b)=>(a[col]||'').toString().localeCompare((b[col]||'').toString(),undefined,{numeric:true})*sortDir);renderTable();}
function fBadge(a){return a==='Precision Nutrition'?'b-pn':a==='Intelligent Health'?'b-ih':'b-fm';}
function tBadge(t){return t==='Startup'?'b-startup':t==='Incumbent'?'b-incumbent':'b-acquirer';}
function iBadge(l){return l==='Priority'?'b-priority':l==='Interested'?'b-interested':'b-watch';}
function sbar(v){const n=parseFloat(v)||0,p=(n/5)*100;return `<div class="sbar"><div class="strack"><div class="sfill" style="width:${p}%"></div></div><span class="snum">${v||'-'}</span></div>`;}

function renderTable(){
  const tb=document.getElementById('tBody');if(!tb)return;
  if(!filteredData.length){tb.innerHTML='<tr><td colspan="13" style="text-align:center;padding:28px;color:var(--ink-muted)">No companies match filters</td></tr>';return;}
  tb.innerHTML=filteredData.map(r=>`
    <tr onclick="openPanel('${(r['Company Name']||'').replace(/'/g,"\\'")}')">
      <td><div class="co-name">${r['Company Name']||''}</div><div class="co-sub">${r['One-liner']||''}</div></td>
      <td><span class="badge ${fBadge(r['TMG Focus Area'])}">${r['TMG Focus Area']||'-'}</span></td>
      <td style="font-size:10px">${r['Stage']||'-'}</td>
      <td style="font-size:10px">${r['Funding Raised']||'-'}</td>
      <td style="font-size:10px">${r['Geography']||'-'}</td>
      <td><span class="badge ${tBadge(r['Company Type'])}">${r['Company Type']||'-'}</span></td>
      <td>${r['Founder Pedigree']?`<span class="badge b-pedigree">${r['Founder Pedigree']}</span>`:'—'}</td>
      <td style="font-size:10px">${r['IP / Patent Status']||'-'}</td>
      <td style="font-size:10px">${r['Last Funded Date']||'-'}</td>
      <td style="font-size:10px">${r['Estimated Runway (months)']?r['Estimated Runway (months)']+'mo':'-'}</td>
      <td>${sbar(r['Market Traction'])}</td>
      <td>${sbar(r['Data Moat'])}</td>
      <td><span class="badge ${iBadge(r['TMG Interest Level'])}">${r['TMG Interest Level']||'-'}</span></td>
    </tr>`).join('');
}

function openPanel(name){
  const r=allData.find(c=>c['Company Name']===name);if(!r)return;
  const notes=JSON.parse(localStorage.getItem('tmg_notes')||'{}');
  const cn=notes[name]||{text:'',links:[]};
  const linksHtml=cn.links.length?`<ul class="links-list">${cn.links.map((l,i)=>`<li><a href="${l.url}" target="_blank">${l.label||l.url}</a><button class="link-del" onclick="delLink('${name}',${i})">x</button></li>`).join('')}</ul>`:'<p style="font-size:10px;color:var(--ink-muted);margin-bottom:6px">No links yet.</p>';
  const fld=(label,val,full)=>val?`<div class="dp-field${full?' full':''}"><label>${label}</label><span>${val}</span></div>`:'';
  const sc=(label,val)=>`<div class="dp-score-item"><div class="dp-score-val">${val||'-'}</div><div class="dp-score-lbl">${label}</div></div>`;
  document.getElementById('dpContent').innerHTML=`
    <div class="dp-header">
      <button class="dp-close" onclick="closePanel()">X</button>
      <div class="dp-co-name">${r['Company Name']}</div>
      <div class="dp-badges">
        <span class="badge ${fBadge(r['TMG Focus Area'])}">${r['TMG Focus Area']||''}</span>
        <span class="badge ${tBadge(r['Company Type'])}">${r['Company Type']||''}</span>
        <span class="badge ${iBadge(r['TMG Interest Level'])}">${r['TMG Interest Level']||''}</span>
        ${r['Founder Pedigree']?`<span class="badge b-pedigree">${r['Founder Pedigree']}</span>`:''}
      </div>
      ${r['Website']?`<a class="dp-website" href="${r['Website']}" target="_blank">Link: ${r['Website']}</a>`:''}
      <div class="dp-actions"><button class="dp-btn edit" onclick="editCompany('${name}')">Edit</button><button class="dp-btn del" onclick="deleteCompany('${name}')">Delete</button></div>
    </div>
    <div class="dp-body">
      <div class="dp-section"><div class="dp-section-title">Overview</div>
        ${fld('One-liner',r['One-liner'],true)}
        <div class="dp-grid">${fld('Sub-category',r['Sub-category'])}${fld('Healthspan Target',r['Healthspan Target'])}${fld('Geography',r['Geography'])}${fld('Stage',r['Stage'])}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Financials and Team</div>
        <div class="dp-grid">${fld('Funding Raised',r['Funding Raised'])}${fld('Last Funded',r['Last Funded Date'])}${fld('Runway',r['Estimated Runway (months)']?r['Estimated Runway (months)']+'months':'')}${fld('Business Model',r['Business Model'])}${fld('Pricing Model',r['Pricing Model']||'-')}${fld('Key Investors',r['Key Investors'])}${fld('No. of Founders',r['Number of Founders'])}${fld('Founder Pedigree',r['Founder Pedigree'])}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Technology and Moat</div>
        <div class="dp-grid">${fld('Ecosystem Position',r['Ecosystem Position'])}${fld('IP / Patent Status',r['IP / Patent Status'])}${fld('Key Technology',r['Key Technology'],true)}${fld('Core Moat',r['Core Moat']||'Not assessed',true)}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Market and Competition</div>
        <div class="dp-grid">${fld('Target Customer',r['Target Customer']||'Not assessed',true)}${fld('Key Competitors',r['Key Competitors']||'Not assessed',true)}${fld('Execution Risk',r['Execution Risk']||'Not assessed',true)}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Original Scores</div>
        <div class="dp-scores">${sc('Market Traction',r['Market Traction'])}${sc('Product Diff.',r['Product Differentiation'])}${sc('Capital Efficiency',r['Capital Efficiency'])}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Extended Scores</div>
        <div class="dp-scores">${sc('Clinical Valid.',r['Clinical Validation'])}${sc('AI Actionability',r['AI Actionability'])}${sc('Regulatory Cplx.',r['Regulatory Complexity'])}</div>
        <div class="dp-scores" style="margin-top:7px">${sc('Personalization',r['Personalization Depth'])}${sc('Data Moat',r['Data Moat'])}${sc('Scalability',r['Scalability'])}</div>
      </div>
      <div class="dp-section"><div class="dp-section-title">Notes and Links</div>
        ${linksHtml}
        <div class="link-add-row"><input id="newLinkLabel" type="text" placeholder="Label"><input id="newLinkUrl" type="text" placeholder="https://..."><button class="btn-add-link" onclick="addLink('${name}')">Add</button></div>
        <textarea class="notes-area" id="notesArea" placeholder="Meeting notes..." style="margin-top:8px">${cn.text}</textarea>
        <button class="save-notes-btn" onclick="saveNotes('${name}')">Save Notes</button>
      </div>
    </div>`;
  document.getElementById('overlay').classList.add('open');
  document.getElementById('detailPanel').classList.add('open');
}
function closePanel(){document.getElementById('overlay').classList.remove('open');document.getElementById('detailPanel').classList.remove('open');}
function addLink(name){const label=document.getElementById('newLinkLabel').value.trim();const url=document.getElementById('newLinkUrl').value.trim();if(!url)return;const notes=JSON.parse(localStorage.getItem('tmg_notes')||'{}');if(!notes[name])notes[name]={text:'',links:[]};notes[name].links.push({label:label||url,url});localStorage.setItem('tmg_notes',JSON.stringify(notes));openPanel(name);}
function delLink(name,idx){const notes=JSON.parse(localStorage.getItem('tmg_notes')||'{}');if(notes[name])notes[name].links.splice(idx,1);localStorage.setItem('tmg_notes',JSON.stringify(notes));openPanel(name);}
function saveNotes(name){const text=document.getElementById('notesArea').value;const notes=JSON.parse(localStorage.getItem('tmg_notes')||'{}');if(!notes[name])notes[name]={text:'',links:[]};notes[name].text=text;localStorage.setItem('tmg_notes',JSON.stringify(notes));const btn=event.target;btn.textContent='Saved';setTimeout(()=>btn.textContent='Save Notes',1500);}

function safeId(name){return (name||'unknown').replace(/[^a-zA-Z0-9]/g,'_');}
async function saveCompany(){
  const name=document.getElementById('f_name').value.trim();if(!name){alert('Company name is required');return;}
  const docId=document.getElementById('f_docId').value||safeId(name);
  const today=new Date().toLocaleDateString('en-GB').replace(/\//g,'.');
  const get=id=>{const el=document.getElementById(id);return el?el.value.trim():'';}
  const row={'Company Name':name,'One-liner':get('f_oneliner'),'TMG Focus Area':get('f_focus'),'Sub-category':get('f_sub'),'Healthspan Target':get('f_health'),'Ecosystem Position':get('f_eco'),'Business Model':get('f_biz'),'Company Type':get('f_type'),'Geography':get('f_geo'),'Stage':get('f_stage'),'Funding Raised':get('f_funding'),'Last Funded Date':get('f_lastfunded'),'Estimated Runway (months)':get('f_runway'),'Number of Founders':get('f_founders'),'Founder Pedigree':get('f_pedigree'),'Key Investors':get('f_investors'),'Key Technology':get('f_tech'),'IP / Patent Status':get('f_ip'),'Pricing Model':get('f_pricing'),'Target Customer':get('f_customer'),'Core Moat':get('f_moat'),'Key Competitors':get('f_competitors'),'Execution Risk':get('f_risk'),'Website':get('f_website'),'Market Traction':get('f_traction'),'Product Differentiation':get('f_diff'),'Capital Efficiency':get('f_capeff'),'Clinical Validation':get('f_cv'),'AI Actionability':get('f_ai'),'Regulatory Complexity':get('f_reg'),'Personalization Depth':get('f_pers'),'Data Moat':get('f_dm'),'Scalability':get('f_sc'),'TMG Interest Level':get('f_interest'),'Last Updated':today,'_source':'platform'};
  try{await setDoc(doc(db,COL,docId),row);closeAddModal();}catch(e){alert('Save failed: '+e.message);}
}
async function deleteCompany(name){
  const r=allData.find(c=>c['Company Name']===name);if(!r)return;
  if(!confirm('Delete '+name+'? This cannot be undone.'))return;
  try{if(r._id)await deleteDoc(doc(db,COL,r._id));closePanel();}catch(e){alert('Delete failed: '+e.message);}
}
function editCompany(name){
  const r=allData.find(c=>c['Company Name']===name);if(!r)return;
  document.getElementById('modalTitle').textContent='Edit Company';
  document.getElementById('f_docId').value=r._id||safeId(name);
  const s=(id,val)=>{const el=document.getElementById(id);if(el)el.value=val||'';};
  s('f_name',r['Company Name']);s('f_oneliner',r['One-liner']);s('f_focus',r['TMG Focus Area']);s('f_sub',r['Sub-category']);s('f_health',r['Healthspan Target']);s('f_eco',r['Ecosystem Position']);s('f_biz',r['Business Model']);s('f_type',r['Company Type']);s('f_geo',r['Geography']);s('f_stage',r['Stage']);s('f_funding',r['Funding Raised']);s('f_lastfunded',r['Last Funded Date']);s('f_runway',r['Estimated Runway (months)']);s('f_founders',r['Number of Founders']);s('f_pedigree',r['Founder Pedigree']);s('f_investors',r['Key Investors']);s('f_tech',r['Key Technology']);s('f_ip',r['IP / Patent Status']);s('f_pricing',r['Pricing Model']);s('f_customer',r['Target Customer']);s('f_moat',r['Core Moat']);s('f_competitors',r['Key Competitors']);s('f_risk',r['Execution Risk']);s('f_website',r['Website']);s('f_traction',r['Market Traction']);s('f_diff',r['Product Differentiation']);s('f_capeff',r['Capital Efficiency']);s('f_cv',r['Clinical Validation']);s('f_ai',r['AI Actionability']);s('f_reg',r['Regulatory Complexity']);s('f_pers',r['Personalization Depth']);s('f_dm',r['Data Moat']);s('f_sc',r['Scalability']);s('f_interest',r['TMG Interest Level']);
  closePanel();document.getElementById('addModal').classList.add('open');
}
function openAddModal(){
  document.getElementById('modalTitle').textContent='Add Company';
  document.getElementById('f_docId').value='';
  document.getElementById('scrapeUrl').value='';document.getElementById('scrapeStatus').textContent='Paste a URL above and let AI auto-populate the form below.';
  ['f_name','f_oneliner','f_sub','f_geo','f_funding','f_lastfunded','f_runway','f_founders','f_investors','f_tech','f_pricing','f_customer','f_moat','f_competitors','f_risk','f_website'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['f_focus','f_health','f_eco','f_biz','f_type','f_stage','f_pedigree','f_ip','f_traction','f_diff','f_capeff','f_cv','f_ai','f_reg','f_pers','f_dm','f_sc','f_interest'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('addModal').classList.add('open');
}
function closeAddModal(){document.getElementById('addModal').classList.remove('open');}

async function scrapeAndFill(){
  const url=document.getElementById('scrapeUrl').value.trim();
  if(!url){alert('Paste a URL first');return;}
  const btn=document.getElementById('btnScrape');
  const status=document.getElementById('scrapeStatus');
  btn.disabled=true;btn.textContent='Reading...';
  status.textContent='Fetching via Jina AI reader...';

  let pageText='';
  // r.jina.ai is built for AI text extraction - no CORS issues
  const jinaUrl='https://r.jina.ai/'+url;
  try{
    const r=await fetch(jinaUrl,{
      headers:{'Accept':'text/plain','X-Return-Format':'text','X-No-Cache':'true'},
      signal:AbortSignal.timeout(20000)
    });
    if(r.ok){
      pageText=(await r.text()).replace(/\s+/g,' ').trim();
      status.textContent='Got '+pageText.length+' characters. Extracting info...';
    }
  }catch(e){
    // try without custom headers (avoids CORS preflight)
    try{
      const r2=await fetch(jinaUrl,{signal:AbortSignal.timeout(15000)});
      if(r2.ok){pageText=(await r2.text()).replace(/\s+/g,' ').trim();}
    }catch(e2){}
  }

  if(!pageText||pageText.length<80){
    btn.disabled=false;btn.textContent='AI Scrape and Fill';
    status.textContent='Could not read page ('+pageText.length+' chars). Some sites block scrapers. Try: ensure URL starts with https://, or use the company Crunchbase/LinkedIn page instead.';
    return;
  }

  const prompt='You are a VC analyst assistant. Extract company info from this webpage text. Return ONLY a valid JSON object - no markdown, no explanation - with these keys (empty string if unknown): Company_Name, One_liner, Sub_category, Geography, Stage (Pre-seed/Seed/Series A/Series B/Public), Funding_Raised (e.g. $10M), Last_Funded_Date (e.g. Q2 2024), Number_of_Founders, Founder_Pedigree (Repeat Founder/Ex-FAANG/PhD-Researcher/First-time/Mixed or empty), Key_Investors, Key_Technology, IP_Patent_Status (None/Applied/Granted/Trade Secret or empty), Pricing_Model, Target_Customer, Core_Moat, Key_Competitors, Execution_Risk, Website_URL, TMG_Focus_Area (Precision Nutrition/Intelligent Health/Food and Medicine), Healthspan_Target (Metabolic Control/Gut Health/Cardiovascular Health/Neurological Health/Inflammation/Musculoskeletal/Multiple), Ecosystem_Position (Ingredient / Science/Platform/Brand/Distribution / Channel), Business_Model (B2C/B2B/B2B2C/Marketplace/SaaS), Company_Type (Startup/Incumbent/Acquirer).\n\nWebpage text ('+pageText.length+' chars):\n'+pageText.slice(0,5000);

  status.textContent='AI analysing page content...';
  const result=await callAI(prompt);

  try{
    const clean=result.replace(/```json|```/g,'').trim();
    const data=JSON.parse(clean);
    const textMap={Company_Name:'f_name',One_liner:'f_oneliner',Sub_category:'f_sub',Geography:'f_geo',Stage:'f_stage',Funding_Raised:'f_funding',Last_Funded_Date:'f_lastfunded',Number_of_Founders:'f_founders',Founder_Pedigree:'f_pedigree',Key_Investors:'f_investors',Key_Technology:'f_tech',Pricing_Model:'f_pricing',Target_Customer:'f_customer',Core_Moat:'f_moat',Key_Competitors:'f_competitors',Execution_Risk:'f_risk'};
    const selMap={TMG_Focus_Area:'f_focus',Healthspan_Target:'f_health',Ecosystem_Position:'f_eco',Business_Model:'f_biz',Company_Type:'f_type',Founder_Pedigree:'f_pedigree',IP_Patent_Status:'f_ip'};
    let filled=0;
    Object.entries(textMap).forEach(([k,id])=>{const el=document.getElementById(id);if(el&&data[k]&&data[k].trim()){el.value=data[k];filled++;}});
    Object.entries(selMap).forEach(([k,id])=>{const el=document.getElementById(id);if(el&&data[k]&&data[k].trim()){el.value=data[k];filled++;}});
    const web=document.getElementById('f_website');if(web&&!web.value){web.value=data.Website_URL||url;}
    status.textContent=filled>0?'Filled '+filled+' fields. Review and adjust before saving.':'AI could not extract structured data from this page. The page may be mostly JavaScript-rendered or behind a login.';
  }catch(e){
    status.textContent='Parse error. Raw AI response: '+result.slice(0,120)+'...';
  }
  btn.disabled=false;btn.textContent='AI Scrape and Fill';
}
async function importFromSheet(){
  const csvUrl=localStorage.getItem('tmg_csvUrl')||'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8LViFyryNqnjbQxgOO3SKHjHWAzY-2-S5mERrp7xABQc8_y2iw4mK2DV6PX5HsCN6Yj1wL6HtMOiY/pub?output=csv';
  const btn=event.target;btn.textContent='Syncing...';btn.disabled=true;
  const proxies=[u=>u,u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`];
  let rows=null;
  for(const px of proxies){try{const r=await fetch(px(csvUrl+'&t='+Date.now()));if(!r.ok)continue;const t=await r.text();if(!t.includes('Company Name'))continue;rows=parseCSV(t);if(rows.length)break;}catch(e){continue;}}
  if(!rows||!rows.length){btn.textContent='Sync from Sheet';btn.disabled=false;alert('Could not fetch sheet. Check Settings - CSV URL.');return;}

  // Query-first: build a map of existing docs by Company Name to avoid creating duplicates
  const existingMap={};
  allData.forEach(r=>{const name=r['Company Name'];if(name)existingMap[safeId(name)]=r._id||safeId(name);});

  let updated=0,created=0;
  for(const row of rows){
    const name=row['Company Name'];if(!name)continue;
    row['_source']='sheet';
    row['Last Updated']=row['Last Updated']||new Date().toLocaleDateString('en-GB').replace(/\//g,'.');
    const sid=safeId(name);
    try{
      // setDoc with a stable id (safeId(name)) always merges into the same doc -
      // no duplicates whether it's the first sync or the hundredth.
      await setDoc(doc(db,COL,existingMap[sid]||sid),row);
      existingMap[sid]?updated++:created++;
    }catch(e){console.error('Sync error',name,e);}
  }
  btn.textContent='Sync from Sheet';btn.disabled=false;
  alert('Sync complete: '+updated+' updated, '+created+' created. No duplicates.');
}
function parseCSV(txt){const lines=txt.trim().split('\n');const hdrs=splitLine(lines[0]);return lines.slice(1).map(l=>{const v=splitLine(l),obj={};hdrs.forEach((h,i)=>obj[h.trim()]=(v[i]||'').trim());return obj;}).filter(r=>r['Company Name']);}
function splitLine(line){const v=[];let cur='',inQ=false;for(let i=0;i<line.length;i++){if(line[i]==='"')inQ=!inQ;else if(line[i]===','&&!inQ){v.push(cur);cur='';}else cur+=line[i];}v.push(cur);return v;}

function exportCSV(){
  if(!allData.length){alert('No data to export');return;}
  const cols=Object.keys(allData[0]).filter(k=>!k.startsWith('_'));
  const NL=String.fromCharCode(10);const q='"';
  const rows=allData.map(r=>cols.map(c=>{const v=(r[c]||'').toString();return v.includes(',')||v.includes(q)?(q+v.replace(/"/g,q+q)+q):v;}).join(','));
  const csv=[cols.join(',')].concat(rows).join(NL);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='TMG_Landscape_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
}

function populateCmpSelects(){
  const opts=allData.map(r=>`<option value="${r['Company Name']}">${r['Company Name']}</option>`).join('');
  for(let i=0;i<numCmpSlots;i++){const el=document.getElementById('cmp_'+i);if(!el)continue;const cur=el.value;el.innerHTML=`<option value="">Select...</option>${opts}`;if(cur)el.value=cur;}
  renderCompare();
}
function addCmpSlot(){
  if(numCmpSlots>=10){alert('Max 10');return;}
  const cont=document.getElementById('cmpSelectors');
  const sel=document.createElement('select');sel.className='cmp-select';sel.id='cmp_'+numCmpSlots;sel.onchange=renderCompare;
  sel.innerHTML=`<option value="">Select...</option>`+allData.map(r=>`<option value="${r['Company Name']}">${r['Company Name']}</option>`).join('');
  const rm=document.createElement('button');rm.className='cmp-remove-btn';rm.textContent='X';rm.onclick=()=>{sel.remove();rm.remove();renderCompare();};
  cont.insertBefore(sel,cont.lastElementChild);cont.insertBefore(rm,cont.lastElementChild);numCmpSlots++;
}
function renderCompare(){
  const ids=new Set();document.querySelectorAll('#cmpSelectors .cmp-select').forEach(el=>{if(el.value)ids.add(el.value);});
  const companies=[...ids].map(n=>allData.find(r=>r['Company Name']===n)).filter(Boolean);
  const out=document.getElementById('cmpOutput');if(!out)return;
  if(!companies.length){out.innerHTML='<div class="cmp-empty">Select companies above to compare</div>';document.getElementById('cmpAiSection').style.display='none';return;}
  const rows=[['Focus Area','TMG Focus Area'],['Sub-category','Sub-category'],['Healthspan Target','Healthspan Target'],['Ecosystem','Ecosystem Position'],['Business Model','Business Model'],['Type','Company Type'],['Geography','Geography'],['Stage','Stage'],['Funding','Funding Raised'],['Last Funded','Last Funded Date'],['Runway (mo)','Estimated Runway (months)'],['Founders','Number of Founders'],['Pedigree','Founder Pedigree'],['Investors','Key Investors'],['Technology','Key Technology'],['IP Status','IP / Patent Status'],['Pricing','Pricing Model'],['Target Customer','Target Customer'],['Core Moat','Core Moat'],['Key Competitors','Key Competitors'],['Exec Risk','Execution Risk'],['Market Traction','Market Traction'],['Product Diff.','Product Differentiation'],['Capital Eff.','Capital Efficiency'],['Clinical Valid.','Clinical Validation'],['AI Actionability','AI Actionability'],['Regulatory Cplx.','Regulatory Complexity'],['Personalization','Personalization Depth'],['Data Moat','Data Moat'],['Scalability','Scalability'],['Interest','TMG Interest Level']];
  const scoreKeys=['Market Traction','Product Differentiation','Capital Efficiency','Clinical Validation','AI Actionability','Regulatory Complexity','Personalization Depth','Data Moat','Scalability'];
  out.innerHTML=`<div class="cmp-table-wrap"><table class="cmp-table"><thead><tr><th style="width:130px">Attribute</th>${companies.map(c=>`<th class="co-th">${c['Company Name']}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,key])=>{const vals=companies.map(c=>c[key]||'-');const isS=scoreKeys.includes(key);const nums=vals.map(v=>parseFloat(v)||0);const max=isS?Math.max(...nums):null;const min=isS?Math.min(...nums):null;return`<tr><td class="attr">${label}</td>${vals.map((v,i)=>{let cls='';if(isS&&companies.length>1){if(nums[i]===max&&max>0)cls='cmp-best';else if(nums[i]===min&&min>0&&max!==min)cls='cmp-worst';}return`<td class="val ${cls}">${v}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table></div>`;
  document.getElementById('cmpAiSection').style.display='block';window._cmpCompanies=companies;
}
function selCmpPrompt(btn,type){document.querySelectorAll('#cmpAiSection .ai-opt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');cmpPrompt=type;}
async function generateCmpAI(){
  const companies=window._cmpCompanies||[];if(!companies.length){alert('Select companies first');return;}
  const summary=companies.map(r=>`${r['Company Name']}: ${r['One-liner']} | Stage:${r['Stage']} | Pedigree:${r['Founder Pedigree']} | Traction:${r['Market Traction']}/5 | DataMoat:${r['Data Moat']}/5 | IP:${r['IP / Patent Status']}`).join('\n');
  const prompts={compare:`Compare these companies: technology, market position, moat, execution risk.\n${summary}`,winner:`If TMG could back only one, which and why? Consider pedigree, moat, healthspan thesis.\n${summary}`,gaps:`What market gaps do these companies leave uncovered?\n${summary}`,invest:`Investment memo: which to prioritise, monitor, or pass on.\n${summary}`};
  const out=document.getElementById('cmpAiOutput');out.textContent='Analysing...';out.className='ai-output idle';
  out.textContent=await callAI(prompts[cmpPrompt]);out.className='ai-output';
}
function copyCmpAI(){navigator.clipboard.writeText(document.getElementById('cmpAiOutput').textContent).then(()=>{const b=event.target;b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',1500);});}

function setVis(type,btn){curVis=type;document.querySelectorAll('.vis-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderVis();}
function renderVis(){
  const data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  const vc=document.getElementById('visContent');if(!vc)return;
  Object.values(visCharts).forEach(c=>{try{c.destroy();}catch(e){}});visCharts={};
  const renders={architecture:renderArchitecture,ecosystem:renderEcosystem,valuechain:renderValueChain,classic:renderClassic,tile:renderTile,matrix2x2:renderMatrix,bubble:renderBubble,heatmap:renderHeatmap,whitespace:renderWhitespace,radar:renderRadar,funding:renderFunding,geomap:renderGeoMap,bizmodel:renderBizModelMix,iplandscape:renderIPLandscape,whynow:renderWhyNow};
  if(renders[curVis])renders[curVis](data,vc);
}

function updateVCStyle(){renderVCInner(window._vcData||[],'column');}
function renderValueChain(data,vc){
  window._vcData=data;
  const cols=['Ingredient / Science','Platform','Brand','Distribution / Channel'];
  const cls=['vc-orange','vc-navy','vc-green','vc-rose'];
  const colData={};cols.forEach(c=>colData[c]=[]);
  data.forEach(r=>{const p=r['Ecosystem Position'];if(p&&colData[p])colData[p].push(r);});
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Value Chain Map</span><div style="display:flex;gap:7px;align-items:center"><button class="btn-dl-vis" onclick="dlVis('vc-inner')">Download PNG</button></div></div><div class="vis-card-desc">Companies positioned by role in the healthspan value chain.</div><div id="vc-inner" style="background:var(--white);padding:14px;border-radius:7px"><div id="vc-render"></div></div></div>`;
  setTimeout(()=>renderVCInner(data,'column'),50);
}
function renderVCInner(data,style){
  const cols=['Ingredient / Science','Platform','Brand','Distribution / Channel'];
  const cls=['vc-orange','vc-navy','vc-green','vc-rose'];
  const colData={};cols.forEach(c=>colData[c]=[]);
  data.forEach(r=>{const p=r['Ecosystem Position'];if(p&&colData[p])colData[p].push(r);});
  const t=document.getElementById('vc-render');if(!t)return;
  if(style==='flow'){
    const parts=cols.map((c,i)=>{
      const arrow=i>0?'<div style="display:flex;align-items:center;padding:0 6px;color:var(--ink-muted);font-size:18px">&rarr;</div>':'';
      const chips=(colData[c]||[]).map(r=>`<div class="vc-chip ${cls[i]}" onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\'")}')">
        ${r['Company Name']}</div>`).join('')||'<div style="font-size:10px;color:var(--ink-muted);text-align:center;padding:8px">-</div>';
      return arrow+`<div style="flex:1;min-width:130px"><div style="background:var(--navy);color:var(--white);padding:8px;font-size:9px;font-weight:600;text-transform:uppercase;text-align:center">${c}</div><div style="padding:9px;background:var(--orange-pale);border:2px solid var(--orange);border-top:none;min-height:140px">${chips}</div></div>`;
    });
    t.innerHTML='<div style="display:flex;align-items:stretch;overflow-x:auto">'+parts.join('')+'</div>';
  }else{
    const hdrs=cols.map(c=>`<div style="background:var(--navy);color:var(--white);padding:8px;font-size:9px;font-weight:600;text-transform:uppercase;text-align:center;border-right:1px solid #2a4560">${c}</div>`).join('');
    const bodies=cols.map((c,i)=>{
      const chips=(colData[c]||[]).map(r=>`<div class="vc-chip ${cls[i]}" onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\'")}')">
        ${r['Company Name']}</div>`).join('')||'<div style="font-size:10px;color:var(--ink-muted);text-align:center;padding:8px">-</div>';
      return `<div style="padding:9px;border-right:1px solid var(--border);min-height:140px">${chips}</div>`;
    }).join('');
    t.innerHTML='<div style="display:grid;grid-template-columns:repeat('+cols.length+',1fr)">'+hdrs+bodies+'</div>';
  }
}

function renderTile(data,vc){
  const areas=['Precision Nutrition','Intelligent Health','Food & Medicine'];
  const aClass=['pn','ih','fm'];const aColors={'pn':'#e07535','ih':'#162535','fm':'#b85050'};
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Tile Landscape</span><button class="btn-dl-vis" onclick="dlVis('tile-inner')">Download PNG</button></div><div class="vis-card-desc">Companies as tiles. Click any tile to view company details.</div><div id="tile-inner" style="background:var(--white);padding:14px;border-radius:7px">${areas.map((area,i)=>{const companies=data.filter(r=>r['TMG Focus Area']===area);return`<div style="margin-bottom:18px"><div style="background:${i===0?'#fce0cc':i===1?'#ddeaf4':'var(--rose-light)'};color:${aColors[aClass[i]]};font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:5px 10px;border-radius:5px;margin-bottom:8px">${area} - ${companies.length}</div><div class="tile-wrap">${companies.map(r=>`<div class="tile ${aClass[i]}" onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\\'")}')" title="${r['One-liner']||''}"><div class="tile-init" style="background:${aColors[aClass[i]]}">${(r['Company Name']||'?')[0].toUpperCase()}</div><div class="tile-name">${r['Company Name']}</div></div>`).join('')}</div></div>`;}).join('')}</div></div>`;
}

function renderClassic(data,vc){
  const stages=['Pre-seed','Seed','Series A','Series B'];
  const areas=['Precision Nutrition','Intelligent Health','Food & Medicine'];
  const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#162535','Food & Medicine':'#b85050'};
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Classic VC Landscape Grid</span><button class="btn-dl-vis" onclick="dlVis('classic-inner')">Download PNG</button></div><div class="vis-card-desc">Companies organized by stage (columns) and focus area (rows) - classic VC landscape format.</div><div id="classic-inner" style="background:var(--white);padding:16px;border-radius:7px;overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="background:var(--navy);color:var(--white);padding:8px;font-size:10px;width:130px;text-align:left">Focus Area</th>${stages.map(s=>`<th style="background:var(--navy2);color:var(--white);padding:8px;font-size:10px;text-align:center;border-left:1px solid #2a4560">${s}</th>`).join('')}</tr></thead><tbody>${areas.map(area=>`<tr style="border-bottom:1px solid var(--border)"><td style="padding:10px;font-size:11px;font-weight:600;color:${colors[area]};background:#f9f9f9">${area}</td>${stages.map(stage=>{const comps=data.filter(r=>r['TMG Focus Area']===area&&r['Stage']===stage);return`<td style="padding:8px;vertical-align:top;border-left:1px solid var(--border)"><div style="display:flex;flex-wrap:wrap;gap:6px">${comps.map(r=>`<div onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\\'")}');" style="cursor:pointer;background:${colors[area]};color:white;border-radius:6px;padding:5px 8px;font-size:9px;font-weight:600;text-align:center">${r['Company Name']}</div>`).join('')}${!comps.length?'<span style="font-size:10px;color:#ccc">-</span>':''}</div></td>`;}).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

let matChart=null;
function renderMatrix(data,vc){
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">2x2 Matrix</span><button class="btn-dl-vis" onclick="dlMatrixChart()">Download PNG</button></div><div class="vis-card-desc">Plot any two scored dimensions. Best = top-right quadrant.</div><div class="vis-controls"><label>X:</label><select id="mx_x" onchange="updateMatrix()">${SCORE_COLS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><label>Y:</label><select id="mx_y" onchange="updateMatrix()">${SCORE_COLS.map((c,i)=>`<option value="${c}" ${i===1?'selected':''}>${c}</option>`).join('')}</select><label>X Label:</label><input type="text" id="mx_cx" placeholder="Custom X label" oninput="updateMatrix()" style="width:140px"><label>Y Label:</label><input type="text" id="mx_cy" placeholder="Custom Y label" oninput="updateMatrix()" style="width:140px"></div><div class="vis-render" style="padding:0;background:var(--white)"><div style="position:relative;height:340px;padding:14px"><canvas id="matrixChart"></canvas></div></div></div>`;
  updateMatrix(data);
}
function updateMatrix(data){
  if(!data)data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  const xKey=document.getElementById('mx_x')?.value||'Market Traction';
  const yKey=document.getElementById('mx_y')?.value||'Product Differentiation';
  const xl=document.getElementById('mx_cx')?.value||xKey;
  const yl=document.getElementById('mx_cy')?.value||yKey;
  const cmap={'Precision Nutrition':'#e07535bb','Intelligent Health':'#162535bb','Food & Medicine':'#2a7f5fbb'};
  const grp={};
  data.filter(r=>r[xKey]&&r[yKey]).forEach(r=>{const a=r['TMG Focus Area']||'Other';if(!grp[a])grp[a]=[];grp[a].push({x:+r[xKey],y:+r[yKey],label:r['Company Name']});});
  if(matChart){try{matChart.destroy();}catch(e){}matChart=null;}
  const ctx=document.getElementById('matrixChart');if(!ctx)return;
  matChart=new Chart(ctx,{type:'scatter',data:{datasets:Object.entries(grp).map(([a,pts])=>({label:a,data:pts,backgroundColor:cmap[a]||'#888bb',pointRadius:9,pointHoverRadius:11}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:7}},tooltip:{callbacks:{label:c=>`${c.raw.label} (${c.raw.x},${c.raw.y})`}}},scales:{x:{min:0,max:6,title:{display:true,text:xl,font:{size:9}},grid:{color:'#eef2f6'}},y:{min:0,max:6,title:{display:true,text:yl,font:{size:9}},grid:{color:'#eef2f6'}}}}});
  visCharts.matrix=matChart;
}
function dlMatrixChart(){if(matChart){const a=document.createElement('a');a.download='TMG_Matrix.png';a.href=matChart.toBase64Image('image/png',1);a.click();}}

function renderHeatmap(data,vc){
  const areas=['Precision Nutrition','Intelligent Health','Food & Medicine'];
  const targets=['Metabolic Control','Gut Health','Cardiovascular Health','Neurological Health','Inflammation','Musculoskeletal'];
  const matrix={};areas.forEach(a=>{matrix[a]={};targets.forEach(t=>matrix[a][t]=0);});
  data.filter(r=>r['Healthspan Target']!=='Multiple').forEach(r=>{if(matrix[r['TMG Focus Area']]&&r['Healthspan Target'])matrix[r['TMG Focus Area']][r['Healthspan Target']]++;});
  function hm(n){return n===0?'hm-0':n===1?'hm-1':n===2?'hm-2':n===3?'hm-3':'hm-4';}
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Heatmap</span><button class="btn-dl-vis" onclick="dlVis('hm-inner')">Download PNG</button></div><div class="vis-card-desc">Company density by Focus Area x Healthspan Target. White = potential white space.</div><div id="hm-inner" style="background:var(--white);padding:14px;border-radius:7px;overflow-x:auto"><table class="heatmap-table"><thead><tr><th class="row-hdr">Focus Area</th>${targets.map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${areas.map(a=>`<tr><td style="font-weight:600;font-size:10px;background:var(--slate);padding:8px 10px;white-space:nowrap">${a}</td>${targets.map(t=>`<td class="${hm(matrix[a][t]||0)}">${matrix[a][t]||0}</td>`).join('')}</tr>`).join('')}</tbody></table><div style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:9px;color:var(--ink-muted)">Density: <span class="hm-0" style="padding:2px 6px;border-radius:3px">0</span><span class="hm-1" style="padding:2px 6px;border-radius:3px">1</span><span class="hm-2" style="padding:2px 6px;border-radius:3px">2</span><span class="hm-3" style="padding:2px 6px;border-radius:3px;color:#fff">3</span><span class="hm-4" style="padding:2px 6px;border-radius:3px;color:#fff">4+</span><span style="margin-left:8px;font-style:italic">0 = white space opportunity</span></div></div></div>`;
}

let bubbleChart=null;
function renderBubble(data,vc){
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Bubble Chart</span><button class="btn-dl-vis" onclick="dlBubbleChart()">Download PNG</button></div><div class="vis-card-desc">Choose any 3 scored dimensions for X, Y, and bubble size.</div><div class="vis-controls"><label>X:</label><select id="bx" onchange="updateBubble()">${SCORE_COLS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><label>Y:</label><select id="by" onchange="updateBubble()">${SCORE_COLS.map((c,i)=>`<option value="${c}" ${i===1?'selected':''}>${c}</option>`).join('')}</select><label>Size:</label><select id="bsize" onchange="updateBubble()">${SCORE_COLS.map((c,i)=>`<option value="${c}" ${i===2?'selected':''}>${c}</option>`).join('')}</select></div><div class="vis-render" style="padding:0"><div style="position:relative;height:340px;padding:14px"><canvas id="bubbleChartVis"></canvas></div></div></div>`;
  updateBubble(data);
}
function updateBubble(data){
  if(!data)data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  const xk=document.getElementById('bx')?.value||'Market Traction';
  const yk=document.getElementById('by')?.value||'Product Differentiation';
  const sk=document.getElementById('bsize')?.value||'Capital Efficiency';
  const cmap={'Precision Nutrition':'#e07535bb','Intelligent Health':'#162535bb','Food & Medicine':'#2a7f5fbb'};
  const grp={};
  data.filter(r=>r[xk]&&r[yk]).forEach(r=>{const a=r['TMG Focus Area']||'Other';if(!grp[a])grp[a]=[];grp[a].push({x:+r[xk],y:+r[yk],r:Math.max(6,(+r[sk]||2)*5),label:r['Company Name']});});
  if(bubbleChart){try{bubbleChart.destroy();}catch(e){}bubbleChart=null;}
  const ctx=document.getElementById('bubbleChartVis');if(!ctx)return;
  bubbleChart=new Chart(ctx,{type:'bubble',data:{datasets:Object.entries(grp).map(([a,pts])=>({label:a,data:pts,backgroundColor:cmap[a]||'#888bb',borderColor:'transparent'}))},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:7}},tooltip:{callbacks:{label:c=>`${c.raw.label}`}}},scales:{x:{min:0,max:6,title:{display:true,text:xk,font:{size:9}},grid:{color:'#eef2f6'}},y:{min:0,max:6,title:{display:true,text:yk,font:{size:9}},grid:{color:'#eef2f6'}}}}});
  visCharts.bubble=bubbleChart;
}
function dlBubbleChart(){if(bubbleChart){const a=document.createElement('a');a.download='TMG_Bubble.png';a.href=bubbleChart.toBase64Image('image/png',1);a.click();}}

function renderEcosystem(data,vc){
  vc.innerHTML=`<div class="vis-card">
    <div class="vis-card-hdr"><span class="vis-card-title">Ecosystem Map</span><button class="btn-dl-vis" onclick="dlVis('eco-wrap')">Download PNG</button></div>
    <div class="vis-card-desc">Concentric rings showing the Consumer Healthspan ecosystem — companies positioned by focus area and ecosystem role, with investor and market context in the outer ring.</div>
    <div id="eco-wrap" style="background:#f8faff;border-radius:8px;overflow:hidden;padding:10px"></div>
  </div>`;
  setTimeout(()=>{
    const W=860,H=760,cx=W/2,cy=H/2;
    const R={center:55,inner:130,mid:230,outer:320,label:370};
    const aColors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
    const ecoColors={'Ingredient / Science':'#7c3aed','Platform':'#0891b2','Brand':'#db2777','Distribution / Channel':'#92400e'};
    const areas=['Precision Nutrition','Intelligent Health','Food & Medicine'];

    // Build investor list from data
    const investorSet=new Set();
    data.forEach(r=>{if(r['Key Investors']){r['Key Investors'].split(/[,\/]/).slice(0,1).forEach(inv=>{const i=inv.trim();if(i&&i.length>2&&i.length<30)investorSet.add(i);});}});
    const investors=[...investorSet].slice(0,8);

    const svg=d3.select('#eco-wrap').append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('style','width:100%;height:auto');

    // Background rings
    [R.outer+60,R.outer,R.mid,R.inner].forEach((r,i)=>{
      svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',r).attr('fill',['#e8f0fe','#dbeafe','#eff6ff','#f0fdf4'][i]).attr('stroke','#cbd5e1').attr('stroke-width',1).attr('stroke-dasharray',i===0?'4,4':'none');
    });

    // Ring labels
    const ringLabels=[{r:R.mid+75,text:'MARKET CONTEXT'},{r:R.mid+10,text:'COMPANIES'},{r:R.inner+15,text:'FOCUS AREAS'},{r:28,text:'VALUE HUB'}];
    // Centre label
    svg.append('text').attr('x',cx).attr('y',cy-8).attr('text-anchor','middle').attr('font-family','DM Serif Display,serif').attr('font-size',12).attr('fill','#162535').attr('font-weight','400').text('Consumer');
    svg.append('text').attr('x',cx).attr('y',cy+8).attr('text-anchor','middle').attr('font-family','DM Serif Display,serif').attr('font-size',12).attr('fill','#162535').attr('font-weight','400').text('Healthspan');
    svg.append('text').attr('x',cx).attr('y',cy+22).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',9).attr('fill','#7a9ab0').text('Economy');
    svg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',R.center).attr('fill','#162535').attr('opacity',.9);
    svg.append('text').attr('x',cx).attr('y',cy-8).attr('text-anchor','middle').attr('font-family','DM Serif Display,serif').attr('font-size',12).attr('fill','white').text('Consumer');
    svg.append('text').attr('x',cx).attr('y',cy+6).attr('text-anchor','middle').attr('font-family','DM Serif Display,serif').attr('font-size',12).attr('fill','white').text('Healthspan');
    svg.append('text').attr('x',cx).attr('y',cy+20).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',8).attr('fill','rgba(255,255,255,.7)').text('Economy');

    // Inner ring: Focus areas as segments
    areas.forEach((area,i)=>{
      const angle=(i/areas.length)*2*Math.PI - Math.PI/2;
      const ax=cx+(R.inner-18)*Math.cos(angle);
      const ay=cy+(R.inner-18)*Math.sin(angle);
      const color=aColors[area];
      svg.append('circle').attr('cx',ax).attr('cy',ay).attr('r',34).attr('fill',color).attr('opacity',.85);
      const words=area.split(' ');
      words.forEach((w,wi)=>{
        svg.append('text').attr('x',ax).attr('y',ay+(wi-words.length/2+0.6)*12).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',9).attr('fill','white').attr('font-weight','600').text(w);
      });
    });

    // Mid ring: Companies positioned by focus area sector + ecosystem position
    const ecoPositions=['Ingredient / Science','Platform','Brand','Distribution / Channel'];
    areas.forEach((area,ai)=>{
      const companies=data.filter(r=>r['TMG Focus Area']===area);
      const sectorAngleStart=(ai/areas.length)*2*Math.PI - Math.PI/2;
      const sectorAngleEnd=((ai+1)/areas.length)*2*Math.PI - Math.PI/2;
      const color=aColors[area];
      companies.forEach((comp,ci)=>{
        const t=(ci+0.5)/Math.max(companies.length,1);
        const angle=sectorAngleStart+(sectorAngleEnd-sectorAngleStart)*t;
        const radVar=R.mid-20+Math.sin(ci*1.7)*25;
        const nx=cx+radVar*Math.cos(angle);
        const ny=cy+radVar*Math.sin(angle);
        // Eco position determines inner border color
        const ecoBorder=ecoColors[comp['Ecosystem Position']]||'#888';
        svg.append('circle').attr('cx',nx).attr('cy',ny).attr('r',18).attr('fill',color).attr('opacity',.75).attr('stroke',ecoBorder).attr('stroke-width',2.5);
        const n=comp['Company Name']||'';
        const short=n.length>9?n.slice(0,8)+'…':n;
        svg.append('text').attr('x',nx).attr('y',ny+3).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',7).attr('fill','white').attr('font-weight','600').text(short);
        svg.append('text').attr('x',nx).attr('y',ny+28).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',7).attr('fill','#4a6070').text(comp['Stage']||'');
        // Connection line from focus area hub
        const aAngle=(ai/areas.length)*2*Math.PI - Math.PI/2;
        const ax=cx+(R.inner-18)*Math.cos(aAngle);
        const ay=cy+(R.inner-18)*Math.sin(aAngle);
        svg.insert('line','circle').attr('x1',ax).attr('y1',ay).attr('x2',nx).attr('y2',ny).attr('stroke',color).attr('stroke-width',0.8).attr('stroke-opacity',.3);
      });
    });

    // Outer ring: Investors + market context nodes
    const outerNodes=[
      ...investors.map(inv=>({label:inv,type:'investor',color:'#d97706'})),
      {label:'GLP-1 Trend',type:'trend',color:'#7c3aed'},
      {label:'AI in Health',type:'trend',color:'#7c3aed'},
      {label:'FDA Regulation',type:'context',color:'#64748b'},
      {label:'Incumbents',type:'context',color:'#64748b'},
    ];
    outerNodes.forEach((node,i)=>{
      const angle=(i/outerNodes.length)*2*Math.PI - Math.PI/2;
      const nx=cx+R.outer*Math.cos(angle);
      const ny=cy+R.outer*Math.sin(angle);
      svg.append('circle').attr('cx',nx).attr('cy',ny).attr('r',node.type==='investor'?22:18).attr('fill',node.color).attr('opacity',.8);
      const words=node.label.split(' ');
      words.forEach((w,wi)=>{
        svg.append('text').attr('x',nx).attr('y',ny+(wi-words.length/2+0.6)*10).attr('text-anchor','middle').attr('font-family','DM Sans,sans-serif').attr('font-size',7).attr('fill','white').attr('font-weight','500').text(w);
      });
    });

    // Legend
    const leg=svg.append('g').attr('transform','translate(14,14)');
    const legItems=[
      {color:'#e07535',label:'Precision Nutrition'},{color:'#2563eb',label:'Intelligent Health'},{color:'#16a34a',label:'Food & Medicine'},
      {color:'#d97706',label:'Investor (outer)'},{color:'#7c3aed',label:'Market Trend'},
    ];
    legItems.forEach(({color,label},i)=>{
      leg.append('circle').attr('cx',8).attr('cy',i*18+8).attr('r',6).attr('fill',color).attr('opacity',.85);
      leg.append('text').attr('x',18).attr('y',i*18+12).attr('font-family','DM Sans,sans-serif').attr('font-size',9).attr('fill','#4a6070').text(label);
    });
    // Eco position legend (border colors)
    const leg2=svg.append('g').attr('transform',`translate(${W-160},14)`);
    leg2.append('text').attr('x',0).attr('y',10).attr('font-family','DM Sans,sans-serif').attr('font-size',9).attr('fill','#7a9ab0').attr('font-weight','600').text('Border = Ecosystem Role');
    Object.entries(ecoColors).forEach(([eco,color],i)=>{
      const short={'Ingredient / Science':'Ingredient/Science','Platform':'Platform','Brand':'Brand','Distribution / Channel':'Distribution'}[eco]||eco;
      leg2.append('rect').attr('x',0).attr('y',i*16+16).attr('width',20).attr('height',4).attr('rx',2).attr('fill',color);
      leg2.append('text').attr('x',24).attr('y',i*16+23).attr('font-family','DM Sans,sans-serif').attr('font-size',8).attr('fill','#4a6070').text(short);
    });
  },100);
}

// FUNDING COMPARISON
function renderFundingComp(data,vc){
  const companies=data.filter(r=>r['Funding Raised']&&r['Funding Raised']!=='-').slice(0,20);
  const parseFunding=s=>{if(!s)return 0;const m=s.replace(/,/g,'').match(/[\d.]+/);if(!m)return 0;const n=parseFloat(m[0]);if(s.includes('B'))return n*1000;return n;};
  const sorted=[...companies].sort((a,b)=>parseFunding(b['Funding Raised'])-parseFunding(a['Funding Raised']));
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Funding Comparison</span><button class="btn-dl-vis" onclick="dlChart('cFundComp')">Download PNG</button></div><div class="vis-card-desc">Funding raised by company (USD millions). Click bar to view company.</div><div class="chart-wrap" style="height:${Math.max(200,sorted.length*28)}px"><canvas id="cFundComp"></canvas></div></div>`;
  const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
  setTimeout(()=>{
    const ctx=document.getElementById('cFundComp');if(!ctx)return;
    const c=new Chart(ctx,{type:'bar',data:{labels:sorted.map(r=>r['Company Name']),datasets:[{data:sorted.map(r=>parseFunding(r['Funding Raised'])),backgroundColor:sorted.map(r=>colors[r['TMG Focus Area']]||'#888'),borderRadius:4,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`$${ctx.raw}M`}}},scales:{x:{grid:{color:'#eef2f6'},title:{display:true,text:'USD (millions)',font:{size:9}}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
    visCharts.cFundComp=c;charts.cFundComp=c;
  },50);
}

// SCORE RANKINGS
function renderScoreRankings(data,vc){
  const dims=['Market Traction','Product Differentiation','Data Moat','Clinical Validation','AI Actionability','Scalability'];
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Score Rankings</span></div><div class="vis-card-desc">Top companies ranked by each score dimension. Click a tab to switch dimension.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${dims.map(d=>`<button onclick="updateScoreRank('${d}')" class="btn-sm" id="srank_${d.replace(/ /g,'_')}">${d}</button>`).join('')}</div>
    <div id="scoreRankContent"></div></div>`;
  window.updateScoreRank=function(dim){
    document.querySelectorAll('[id^=srank_]').forEach(b=>b.style.background='');
    const btn=document.getElementById('srank_'+dim.replace(/ /g,'_'));
    if(btn)btn.style.cssText='background:var(--orange);border-color:var(--orange);color:white';
    const sorted=[...data].filter(r=>r[dim]).sort((a,b)=>(+b[dim]||0)-(+a[dim]||0)).slice(0,15);
    const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
    const html=sorted.map((r,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer" onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\'")}')">
      <span style="font-size:10px;color:var(--ink-muted);width:18px;text-align:right">${i+1}</span>
      <div style="flex:1;background:var(--border);border-radius:4px;height:24px;overflow:hidden;position:relative">
        <div style="height:100%;width:${(+r[dim]/5*100)}%;background:${colors[r['TMG Focus Area']]||'#888'};opacity:.85"></div>
        <span style="position:absolute;left:8px;top:4px;font-size:10px;font-weight:500;color:white">${r['Company Name']}</span>
      </div>
      <span style="font-size:11px;font-weight:600;color:var(--ink);width:20px">${r[dim]}</span>
    </div>`).join('');
    document.getElementById('scoreRankContent').innerHTML=html;
  };
  window.updateScoreRank(dims[0]);
  window.openPanel=window.openPanel;
}

// BUSINESS MODEL MIX
function renderBizModelMix(data,vc){
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Business Model Mix</span><button class="btn-dl-vis" onclick="dlChart('cBizMix')">Download PNG</button></div><div class="vis-card-desc">B2C vs B2B vs B2B2C distribution across focus areas.</div><div class="chart-wrap" style="height:220px"><canvas id="cBizMix"></canvas></div></div>`;
  setTimeout(()=>{
    const areas=['Precision Nutrition','Intelligent Health','Food & Medicine'];
    const models=['B2C','B2B','B2B2C','SaaS','Marketplace'];
    const modelColors={'B2C':'#e07535','B2B':'#2563eb','B2B2C':'#16a34a','SaaS':'#7c3aed','Marketplace':'#d97706'};
    const datasets=models.map(m=>({label:m,data:areas.map(a=>data.filter(r=>r['TMG Focus Area']===a&&r['Business Model']===m).length),backgroundColor:modelColors[m],borderRadius:4}));
    const ctx=document.getElementById('cBizMix');if(!ctx)return;
    const c=new Chart(ctx,{type:'bar',data:{labels:areas,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:9}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'#eef2f6'},ticks:{stepSize:1}}}}});
    visCharts.cBizMix=c;charts.cBizMix=c;
  },50);
}

// IP LANDSCAPE
function renderIPLandscape(data,vc){
  const statuses=['None','Applied','Granted','Trade Secret'];
  const statusColors={'None':'#e5e7eb','Applied':'#fbbf24','Granted':'#16a34a','Trade Secret':'#7c3aed'};
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">IP Landscape</span><button class="btn-dl-vis" onclick="dlVis('ip-inner')">Download PNG</button></div><div class="vis-card-desc">Patent and IP status across all tracked companies.</div>
    <div id="ip-inner" style="background:var(--white);padding:14px;border-radius:7px">
      <div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap">
        ${statuses.map(s=>{const n=data.filter(r=>r['IP / Patent Status']===s).length;return`<div style="text-align:center;padding:10px 16px;border-radius:8px;background:${statusColors[s]}22;border:2px solid ${statusColors[s]}"><div style="font-size:22px;font-weight:700;color:${statusColors[s]}">${n}</div><div style="font-size:10px;color:var(--ink-muted)">${s}</div></div>`;}).join('')}
      </div>
      <div>${data.filter(r=>r['IP / Patent Status']&&r['IP / Patent Status']!=='None').map(r=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;padding:6px 10px;background:var(--slate);border-radius:6px;cursor:pointer" onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\'")}')">
        <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[r['IP / Patent Status']]||'#888'}"></div>
        <span style="font-size:11px;font-weight:500">${r['Company Name']}</span>
        <span class="badge ${r['TMG Focus Area']==='Precision Nutrition'?'b-pn':r['TMG Focus Area']==='Intelligent Health'?'b-ih':'b-fm'}">${r['TMG Focus Area']||''}</span>
        <span style="margin-left:auto;font-size:10px;font-weight:600;color:${statusColors[r['IP / Patent Status']]}">${r['IP / Patent Status']}</span>
        ${r['Key Technology']?`<span style="font-size:9px;color:var(--ink-muted)">${r['Key Technology'].slice(0,40)}</span>`:''}
      </div>`).join('')}</div>
    </div>
  </div>`;
}

// COMPETITOR NETWORK
function renderCompetitorNetwork(data,vc){
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Competitor Network</span></div><div class="vis-card-desc">Who lists whom as a competitor. Lines show competitive relationships.</div><div id="comp-net" style="background:var(--white);border-radius:7px;border:1px solid var(--border)"></div></div>`;
  setTimeout(()=>{
    const W=860,H=460;
    const nodes=[],links=[];
    const nameSet=new Set(data.map(r=>r['Company Name']));
    data.forEach(r=>nodes.push({id:r['Company Name'],focus:r['TMG Focus Area']}));
    data.forEach(r=>{if(r['Key Competitors']){r['Key Competitors'].split(/[,\/]/).forEach(comp=>{const c=comp.trim();if(nameSet.has(c)&&c!==r['Company Name'])links.push({source:r['Company Name'],target:c});});}});
    const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
    const svg=d3.select('#comp-net').append('svg').attr('viewBox',`0 0 ${W} ${H}`).attr('style','width:100%;height:auto');
    const sim=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(90)).force('charge',d3.forceManyBody().strength(-100)).force('center',d3.forceCenter(W/2,H/2)).force('collision',d3.forceCollide(28));
    const link=svg.append('g').selectAll('line').data(links).join('line').attr('stroke','#e07535').attr('stroke-width',1.5).attr('stroke-opacity',.5);
    const node=svg.append('g').selectAll('g').data(nodes).join('g').call(d3.drag().on('start',(e,d)=>{if(!e.active)sim.alphaTarget(.3).restart();d.fx=d.x;d.fy=d.y;}).on('drag',(e,d)=>{d.fx=e.x;d.fy=e.y;}).on('end',(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;}));
    node.append('circle').attr('r',15).attr('fill',d=>colors[d.focus]||'#888').attr('opacity',.85);
    node.append('text').attr('text-anchor','middle').attr('dy',24).attr('font-size',8).attr('fill','#4a6070').text(d=>{const n=d.id||'';return n.length>12?n.slice(0,10)+'..':n;});
    node.append('title').text(d=>d.id);
    sim.on('tick',()=>{link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);node.attr('transform',d=>`translate(${Math.max(18,Math.min(W-18,d.x))},${Math.max(18,Math.min(H-18,d.y))})`);});
  },100);
}

function renderRadar(data,vc){
  const opts=data.map(r=>`<option value="${r['Company Name']}">${r['Company Name']}</option>`).join('');
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Radar Chart</span><button class="btn-dl-vis" onclick="dlRadarChart()">Download PNG</button></div><div class="vis-card-desc">Compare up to 4 companies across 6 strategic dimensions.</div><div class="vis-controls">${[0,1,2,3].map(i=>`<select id="rad_${i}" onchange="updateRadar()"><option value="">Company ${i+1}...</option>${opts}</select>`).join('')}</div><div class="vis-render" style="padding:0"><div style="position:relative;height:320px;padding:14px"><canvas id="radarChart"></canvas></div></div></div>`;
}
function updateRadar(){
  const dims=['Market Traction','Product Differentiation','Clinical Validation','AI Actionability','Data Moat','Scalability'];
  const colors=['#e07535','#162535','#2a7f5f','#b85050'];
  const sel=[0,1,2,3].map(i=>document.getElementById('rad_'+i)?.value).filter(Boolean);
  const companies=sel.map(n=>allData.find(r=>r['Company Name']===n)).filter(Boolean);
  if(!companies.length)return;
  const existing=visCharts.radar;if(existing){try{existing.destroy();}catch(e){}}
  const ctx=document.getElementById('radarChart');if(!ctx)return;
  const c=new Chart(ctx,{type:'radar',data:{labels:dims,datasets:companies.map((co,i)=>({label:co['Company Name'],data:dims.map(d=>+co[d]||0),borderColor:colors[i],backgroundColor:colors[i]+'22',pointBackgroundColor:colors[i],borderWidth:2}))},options:{responsive:true,maintainAspectRatio:false,scales:{r:{min:0,max:5,ticks:{stepSize:1,font:{size:8}},pointLabels:{font:{size:9}}}},plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:7}}}}});
  visCharts.radar=c;
}
function dlRadarChart(){const c=visCharts.radar;if(c){const a=document.createElement('a');a.download='TMG_Radar.png';a.href=c.toBase64Image('image/png',1);a.click();}}

function renderWhitespace(data,vc){
  const targets=['Metabolic Control','Gut Health','Cardiovascular Health','Neurological Health','Inflammation','Musculoskeletal'];
  const ecos=['Ingredient / Science','Platform','Brand','Distribution / Channel'];
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">White Space Matrix</span><button class="btn-dl-vis" onclick="dlVis('ws-inner')">Download PNG</button></div><div class="vis-card-desc">Healthspan Target x Ecosystem Position. Empty = investment opportunity.</div><div id="ws-inner" style="background:var(--white);padding:14px;border-radius:7px;overflow-x:auto"><table class="wspace-table"><thead><tr><th class="row-hdr">Healthspan Target</th>${ecos.map(e=>`<th>${e}</th>`).join('')}</tr></thead><tbody>${targets.map(t=>`<tr><td style="font-weight:600;font-size:10px;padding:7px 9px;background:var(--slate)">${t}</td>${ecos.map(e=>{const comps=data.filter(r=>r['Healthspan Target']===t&&r['Ecosystem Position']===e);return comps.length?`<td class="ws-filled">${comps.map(r=>`<div style="font-size:9px">${r['Company Name']}</div>`).join('')}</td>`:`<td class="ws-empty">white space</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function renderFunding(data,vc){
  const stageOrder={'Pre-seed':1,'Seed':2,'Series A':3,'Series B':4,'Public':5};
  const sorted=[...data].filter(r=>stageOrder[r['Stage']]).sort((a,b)=>stageOrder[a['Stage']]-stageOrder[b['Stage']]);
  const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Funding Timeline</span><button class="btn-dl-vis" onclick="dlVis('ft-inner')">Download PNG</button></div><div class="vis-card-desc">Companies arranged by funding stage from earliest to most mature.</div><div id="ft-inner" style="background:var(--white);padding:14px;border-radius:7px">${['Pre-seed','Seed','Series A','Series B','Public'].map(stage=>{const comps=sorted.filter(r=>r['Stage']===stage);if(!comps.length)return'';return`<div style="margin-bottom:18px"><div style="font-size:9px;font-weight:600;color:var(--ink-muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:7px;display:flex;align-items:center;gap:7px"><div style="height:1px;flex:1;background:var(--border)"></div>${stage}<div style="height:1px;flex:1;background:var(--border)"></div></div><div style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center">${comps.map(r=>`<div onclick="showSection('companies');openPanel('${r['Company Name'].replace(/'/g,"\'")}');" style="cursor:pointer;background:${colors[r['TMG Focus Area']]||'#888'};color:white;padding:6px 11px;border-radius:7px;font-size:10px;font-weight:500;min-width:90px;text-align:center"><div>${r['Company Name']}</div><div style="font-size:8px;opacity:.75">${r['Funding Raised']||'Undisclosed'}</div>${r['Last Funded Date']?`<div style="font-size:8px;opacity:.6">${r['Last Funded Date']}</div>`:''}</div>`).join('')}</div></div>`;}).join('')}</div></div>`;
}

function renderGeoMap(data,vc){
  // Real lat/lon projected onto the actual world map image (worldmap.png must
  // sit alongside index.html/app.js). Projection is calibrated to that image:
  // x = (180 - lon) / 360 * W   (map's left edge is the Pacific split, ~lon +180)
  // y = (LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM) * H
  const W=1600,H=794,LAT_TOP=83,LAT_BOTTOM=-58;
  const proj=(lat,lon)=>({x:(180-lon)/360*W, y:(LAT_TOP-lat)/(LAT_TOP-LAT_BOTTOM)*H});
  const geo={
    'US':{lat:39.8,lon:-98.6,label:'United States'},'USA':{lat:39.8,lon:-98.6,label:'United States'},'United States':{lat:39.8,lon:-98.6,label:'United States'},
    'UK':{lat:54.0,lon:-2.0,label:'UK'},'United Kingdom':{lat:54.0,lon:-2.0,label:'UK'},
    'France':{lat:46.6,lon:2.2,label:'France'},'Ireland':{lat:53.1,lon:-8.0,label:'Ireland'},
    'Israel':{lat:31.0,lon:34.8,label:'Israel'},'Switzerland':{lat:46.8,lon:8.2,label:'Switzerland'},
    'Sweden':{lat:62.0,lon:15.0,label:'Sweden'},'Singapore':{lat:1.35,lon:103.8,label:'Singapore'},
    'Germany':{lat:51.2,lon:10.4,label:'Germany'},'Canada':{lat:56.1,lon:-106.3,label:'Canada'},
    'Australia':{lat:-25.3,lon:133.8,label:'Australia'},'India':{lat:22.0,lon:79.0,label:'India'},
    'China':{lat:35.0,lon:103.8,label:'China'},'Japan':{lat:36.5,lon:138.0,label:'Japan'}
  };
  const companies=data.filter(r=>r['Geography']&&geo[r['Geography'].trim()]);
  const colors={'Precision Nutrition':'#e07535','Intelligent Health':'#2563eb','Food & Medicine':'#16a34a'};
  const locGroups={};
  companies.forEach(r=>{const g=r['Geography'].trim();if(!locGroups[g])locGroups[g]=[];locGroups[g].push(r);});

  const bubbles=Object.entries(locGroups).map(([geoKey,comps])=>{
    const info=geo[geoKey];if(!info)return'';
    const {x,y}=proj(info.lat,info.lon);
    const r=Math.max(14,comps.length*11);
    const names=comps.map(c=>c['Company Name']).join(', ');
    const focusCounts={};comps.forEach(c=>{focusCounts[c['TMG Focus Area']]=(focusCounts[c['TMG Focus Area']]||0)+1;});
    const dominant=Object.entries(focusCounts).sort((a,b)=>b[1]-a[1])[0][0];
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[dominant]||'#888'}" opacity=".85" stroke="white" stroke-width="2"/><text x="${x}" y="${y+3}" text-anchor="middle" font-size="${r>20?10:9}" fill="white" font-weight="700">${comps.length}</text><text x="${x}" y="${y+r+12}" text-anchor="middle" font-size="9" fill="#162535" font-weight="600" style="paint-order:stroke;stroke:white;stroke-width:3px">${info.label}</text><title>${geoKey}: ${names}</title>`;
  }).join('');

  const missing=[...new Set(data.filter(r=>r['Geography']&&!geo[r['Geography'].trim()]).map(r=>r['Geography'].trim()))];

  vc.innerHTML=`<div class="vis-card">
    <div class="vis-card-hdr"><span class="vis-card-title">Geographic Map</span><button class="btn-dl-vis" onclick="dlVis('geo-inner')">Download PNG</button></div>
    <div class="vis-card-desc">Company HQs plotted on real geography. Bubble size = number of companies at that location.${missing.length?' Not yet mapped: '+missing.join(', ')+' (add lat/lon in renderGeoMap).':''}</div>
    <div id="geo-inner" style="background:#1a7fc4;border-radius:7px;overflow:hidden;position:relative">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <image href="./worldmap.png" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
        ${bubbles}
        <rect x="10" y="${H-58}" width="215" height="52" fill="white" opacity=".9" rx="5"/>
        <circle cx="24" cy="${H-42}" r="7" fill="#e07535" opacity=".9"/><text x="36" y="${H-38}" font-size="9" fill="#333">Precision Nutrition</text>
        <circle cx="24" cy="${H-24}" r="7" fill="#2563eb" opacity=".9"/><text x="36" y="${H-20}" font-size="9" fill="#333">Intelligent Health</text>
        <circle cx="128" cy="${H-42}" r="7" fill="#16a34a" opacity=".9"/><text x="140" y="${H-38}" font-size="9" fill="#333">Food and Medicine</text>
        <text x="128" y="${H-20}" font-size="8" fill="#7a9ab0">Number = companies in location</text>
      </svg>
    </div>
  </div>`;
}
function renderArchitecture(data,vc){
  vc.innerHTML=`<div class="vis-card"><div class="vis-card-hdr"><span class="vis-card-title">Platform Architecture</span><button class="btn-dl-vis" onclick="dlVis('arch-inner')">Download PNG</button></div><div class="vis-card-desc">How data flows from web sources through the platform to deliver investment intelligence.</div><div id="arch-inner" style="background:var(--white);padding:20px;border-radius:7px"><svg viewBox="0 0 900 320" style="width:100%;height:auto"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#e07535"/></marker></defs><text x="450" y="22" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#7a9ab0" font-weight="600">DATA SOURCES</text><rect x="40" y="30" width="140" height="52" rx="7" fill="#162535"/><text x="110" y="50" text-anchor="middle" font-family="sans-serif" font-size="10" fill="white" font-weight="500">Startup Website</text><text x="110" y="63" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#7a9ab0">Jina AI Scraper</text><text x="110" y="75" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#e07535">AI fills form</text><rect x="260" y="30" width="140" height="52" rx="7" fill="#162535"/><text x="330" y="50" text-anchor="middle" font-family="sans-serif" font-size="10" fill="white" font-weight="500">LinkedIn Profile</text><text x="330" y="63" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#7a9ab0">Jina AI Reader</text><text x="330" y="75" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#e07535">Founder Pedigree</text><rect x="480" y="30" width="140" height="52" rx="7" fill="#162535"/><text x="550" y="50" text-anchor="middle" font-family="sans-serif" font-size="10" fill="white" font-weight="500">Google Sheet</text><text x="550" y="63" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#7a9ab0">CSV Sync</text><text x="550" y="75" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#e07535">Manual entry</text><line x1="110" y1="82" x2="110" y2="115" stroke="#e07535" stroke-width="1.5"/><line x1="330" y1="82" x2="330" y2="115" stroke="#e07535" stroke-width="1.5"/><line x1="550" y1="82" x2="550" y2="115" stroke="#e07535" stroke-width="1.5"/><line x1="110" y1="115" x2="550" y2="115" stroke="#e07535" stroke-width="1.5"/><line x1="330" y1="115" x2="330" y2="128" stroke="#e07535" stroke-width="1.5" marker-end="url(#arr)"/><rect x="200" y="128" width="260" height="48" rx="8" fill="#ff8000" opacity=".9"/><text x="330" y="149" text-anchor="middle" font-family="sans-serif" font-size="13" fill="white">Firebase Firestore</text><text x="330" y="165" text-anchor="middle" font-family="sans-serif" font-size="9" fill="rgba(255,255,255,.8)">Real-time - Shared across all 5 teammates</text><line x1="230" y1="176" x2="140" y2="210" stroke="#dde4ec" stroke-width="1.2"/><line x1="280" y1="176" x2="320" y2="210" stroke="#dde4ec" stroke-width="1.2"/><line x1="380" y1="176" x2="500" y2="210" stroke="#dde4ec" stroke-width="1.2"/><line x1="430" y1="176" x2="680" y2="210" stroke="#dde4ec" stroke-width="1.2"/><rect x="70" y="210" width="140" height="48" rx="7" fill="#162535"/><text x="140" y="231" text-anchor="middle" font-family="sans-serif" font-size="9" fill="white" font-weight="600">Dashboard Charts</text><text x="140" y="245" text-anchor="middle" font-family="sans-serif" font-size="8" fill="rgba(255,255,255,.7)">17 Visual types</text><rect x="250" y="210" width="140" height="48" rx="7" fill="#7a3fd0"/><text x="320" y="231" text-anchor="middle" font-family="sans-serif" font-size="9" fill="white" font-weight="600">AI Analysis</text><text x="320" y="245" text-anchor="middle" font-family="sans-serif" font-size="8" fill="rgba(255,255,255,.7)">Claude / Gemini</text><rect x="430" y="210" width="140" height="48" rx="7" fill="#2a7f5f"/><text x="500" y="231" text-anchor="middle" font-family="sans-serif" font-size="9" fill="white" font-weight="600">CSV Export</text><text x="500" y="245" text-anchor="middle" font-family="sans-serif" font-size="8" fill="rgba(255,255,255,.7)">Google Sheets backup</text><rect x="610" y="210" width="140" height="48" rx="7" fill="#e07535"/><text x="680" y="231" text-anchor="middle" font-family="sans-serif" font-size="9" fill="white" font-weight="600">Newsletter PNGs</text><text x="680" y="245" text-anchor="middle" font-family="sans-serif" font-size="8" fill="rgba(255,255,255,.7)">Visuals tab</text><rect x="210" y="268" width="220" height="34" rx="6" fill="#f0e8fe" stroke="#7a3fd0" stroke-width="1.5"/><text x="320" y="283" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#5a1a9a" font-weight="600">Send to Claude connector</text><text x="320" y="296" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#7a3fd0">Query your landscape from Claude chat</text><line x1="320" y1="258" x2="320" y2="268" stroke="#7a3fd0" stroke-width="1.2"/></svg></div></div>`;
}

function renderWhyNow(data,vc){
  const W=860,H=480;
  vc.innerHTML=`<div class="vis-card">
    <div class="vis-card-hdr"><span class="vis-card-title">Why Now - Converging Catalysts</span><button class="btn-dl-vis" onclick="dlVis('wn-inner')">Download PNG</button></div>
    <div class="vis-card-desc">5 converging forces making the Consumer Healthspan Economy investable right now. Framework pre-populated with known milestones - add your own as they emerge.</div>
    <div id="wn-inner" style="background:var(--white);padding:16px;border-radius:8px">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
        <text x="${W/2}" y="28" text-anchor="middle" font-family="DM Serif Display,serif" font-size="16" fill="#162535">The Healthspan Investment Window is Open Now</text>
        ${[
          {y:55,color:'#7c3aed',icon:'\u{1F465}',title:'Demographic Shift',milestones:['2020: Global 60+ population hits 1B','2024: Healthy aging top consumer priority','2035: $14.5T food and health market projected']},
          {y:135,color:'#e07535',icon:'\u{1F48A}',title:'GLP-1 Revolution',milestones:['2021: FDA approves Ozempic for obesity','2023: $1.5B Poppi acquisition signals shift','2024: Food cos. reformulating for GLP-1 users']},
          {y:215,color:'#2563eb',icon:'\u{1F9EC}',title:'AI-Enabled Discovery',milestones:['2022: AlphaFold2 protein structure breakthrough','2023: AI bioactive discovery 10-100x faster','2024: Small teams match large pharma R&D']},
          {y:295,color:'#16a34a',icon:'\u{1F4CA}',title:'Data and Biomarkers',milestones:['2021: CGM becomes consumer mainstream','2022: Microbiome sequencing costs fall 90%','2024: 100+ biomarker panels for $499/year']},
          {y:375,color:'#db2777',icon:'\u{1F4B0}',title:'Capital Formation',milestones:['2021: Longevity VC hits record $4B invested','2023: Danone acquires Kate Farms','2025: TMG thesis validated across all 3 verticals']},
        ].map(({y,color,icon,title,milestones})=>`
          <rect x="10" y="${y}" width="${W-20}" height="72" rx="8" fill="${color}11" stroke="${color}" stroke-width="1"/>
          <text x="30" y="${y+22}" font-family="sans-serif" font-size="11">${icon}</text>
          <text x="50" y="${y+24}" font-family="DM Sans,sans-serif" font-size="12" fill="${color}" font-weight="700">${title}</text>
          ${milestones.map((m,i)=>`<text x="${200+i*210}" y="${y+22}" font-family="sans-serif" font-size="9" fill="#162535" font-weight="500">${m.split(':')[0]}:</text><text x="${200+i*210}" y="${y+36}" font-family="sans-serif" font-size="9" fill="#4a6070">${m.split(':').slice(1).join(':').trim()}</text>`).join('')}
          <text x="${W-80}" y="${y+46}" font-family="sans-serif" font-size="9" fill="${color}" font-weight="600">ACTIVE NOW &#8594;</text>
        `).join('')}
        <text x="${W/2}" y="${H-18}" text-anchor="middle" font-family="DM Serif Display,serif" font-size="13" fill="#162535">All 5 forces converge - exceptional entry point for Precision Nutrition, Intelligent Health, Food and Medicine</text>
      </svg>
    </div>
  </div>`;
}
function dlVis(innerId){
  const el=document.getElementById(innerId);if(!el)return;
  const go=()=>window.html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true}).then(canvas=>{const a=document.createElement('a');a.download='TMG_Visual.png';a.href=canvas.toDataURL('image/png');a.click();});
  if(window.html2canvas){go();}else{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';s.onload=go;document.head.appendChild(s);}
}

function openClaudeModal(){
  const data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  setClaude(document.querySelector('.claude-prompt-btn'),'overview',data);
  document.getElementById('claudeModal').classList.add('open');
}
function closeClaudeModal(){document.getElementById('claudeModal').classList.remove('open');}
function setClaude(btn,type,data){
  claudePromptType=type;
  if(btn){document.querySelectorAll('.claude-prompt-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const d=data||(curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData);
  const table=d.map(r=>`- ${r['Company Name']} (${r['TMG Focus Area']}, ${r['Stage']}) - ${r['One-liner']}\n  Scores: Traction ${r['Market Traction']}/5 | Data Moat ${r['Data Moat']}/5 | Diff ${r['Product Differentiation']}/5 | Pedigree: ${r['Founder Pedigree']||'Unknown'} | IP: ${r['IP / Patent Status']||'Unknown'} | Last funded: ${r['Last Funded Date']||'Unknown'} | Runway: ${r['Estimated Runway (months)']||'?'}mo`).join('\n');
  const prompts={overview:`I am an analyst at The March Group (TMG), a VC fund focused on the Consumer Healthspan Economy. Here is our current investment landscape:\n\n${table}\n\nPlease give me a strategic overview - key themes, strongest companies, and top observations.`,priority:`I am an analyst at The March Group. Based on this landscape data, which 3 companies should we call first and why? Consider founder pedigree, IP status, runway, and scores.\n\n${table}`,runway:`Based on this landscape, which companies are most likely approaching their next fundraise? Flag anyone with low runway or last funded over 18 months ago.\n\n${table}`,whitespace:`Based on this landscape, what are the most compelling white space opportunities - areas with few or no companies - that TMG should explore?\n\n${table}`,newsletter:`Write a 200-word newsletter paragraph about the Consumer Healthspan Economy based on this landscape data. Reference specific companies and trends.\n\n${table}`};
  claudePayload=prompts[type]||prompts.overview;
  document.getElementById('claudeDataBox').textContent=claudePayload;
}
function copyForClaude(){
  navigator.clipboard.writeText(claudePayload).then(()=>{const b=event.target;b.textContent='Copied!';setTimeout(()=>b.textContent='Copy to Clipboard',1500);});
}
function openClaude(){navigator.clipboard.writeText(claudePayload).catch(()=>{});window.open('https://claude.ai/new','_blank');}

function updateKeyLabel(){
  const p=document.getElementById('aiProvider')?.value||'groq';
  const lbl=document.getElementById('aiKeyLbl');
  if(lbl)lbl.textContent=p==='groq'?'Groq API Key:':p==='gemini'?'Gemini API Key:':'Anthropic API Key:';
  const inp=document.getElementById('apiKeyInput');
  if(inp){
    inp.placeholder=p==='groq'?'gsk_...':p==='gemini'?'AIza...':'sk-ant-...';
    inp.value=localStorage.getItem(p==='groq'?'tmg_groqKey':p==='gemini'?'tmg_geminiKey':'tmg_claudeKey')||'';
  }
}
function saveKey(){
  const p=document.getElementById('aiProvider')?.value||'groq';
  const k=document.getElementById('apiKeyInput').value.trim();
  if(k){localStorage.setItem(p==='groq'?'tmg_groqKey':p==='gemini'?'tmg_geminiKey':'tmg_claudeKey',k);alert('API key saved!');}
}
function selPrompt(btn,type){document.querySelectorAll('.ai-panel .ai-opt').forEach(b=>b.classList.remove('active'));btn.classList.add('active');curPrompt=type;}

async function callAI(prompt){
  const provider=document.getElementById('aiProvider')?.value||localStorage.getItem('tmg_provider')||'groq';

  // GROQ - most reliable free option. llama-3.3-70b-versatile was deprecated by Groq
  // (Aug 2026) - gpt-oss-120b is their recommended replacement, with a smaller fallback.
  if(provider==='groq'){
    const key=localStorage.getItem('tmg_groqKey')||document.getElementById('apiKeyInput')?.value.trim();
    if(!key)return'Add your Groq API key in Settings. Free at console.groq.com';
    const MODELS=['openai/gpt-oss-120b','openai/gpt-oss-20b'];
    let lastErr='';
    for(const m of MODELS){
      try{
        const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
          body:JSON.stringify({model:m,messages:[{role:'user',content:prompt}],max_tokens:1024})
        });
        const d=await r.json();
        if(d.error){lastErr=d.error.message;continue;}
        return d.choices?.[0]?.message?.content||'No response.';
      }catch(e){lastErr=e.message;continue;}
    }
    return'Groq error: '+lastErr;
  }

  // GEMINI - free but model names change, try a couple of fallbacks
  if(provider==='gemini'){
    const key=localStorage.getItem('tmg_geminiKey')||document.getElementById('apiKeyInput')?.value.trim();
    if(!key)return'Add your Gemini API key in Settings. Free at aistudio.google.com/app/apikey';
    const MODELS=['gemini-1.5-flash-8b','gemini-1.5-flash'];
    let lastErr='';
    for(const m of MODELS){
      try{
        const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+m+':generateContent?key='+key,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
        });
        const d=await r.json();
        if(d.error){lastErr=d.error.message;continue;}
        return d.candidates?.[0]?.content?.parts?.[0]?.text||'No response.';
      }catch(e){lastErr=e.message;continue;}
    }
    return'Gemini error: '+lastErr;
  }

  // CLAUDE
  const key=localStorage.getItem('tmg_claudeKey')||document.getElementById('apiKeyInput')?.value.trim();
  if(!key)return'Add your Claude API key in Settings.';
  const w=localStorage.getItem('tmg_workspaceId');
  const headers={'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
  if(w)headers['anthropic-workspace-id']=w;
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers,body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
    const d=await r.json();
    if(d.error)throw new Error(d.error.message);
    return d.content?.[0]?.text||'No response.';
  }catch(e){return'Claude error: '+e.message;}
}

function buildPrompt(type){
  const data=curView==='targets'?allData.filter(r=>r['Company Type']==='Startup'):allData;
  const summary=data.map(r=>`${r['Company Name']} (${r['TMG Focus Area']}, ${r['Stage']}, Pedigree:${r['Founder Pedigree']||'?'}, IP:${r['IP / Patent Status']||'?'}, Runway:${r['Estimated Runway (months)']||'?'}mo, Traction:${r['Market Traction']}/5, DataMoat:${r['Data Moat']}/5): ${r['One-liner']}`).join('\n');
  const p={newsletter:`You are a senior analyst at The March Group. Write a 180-word investor newsletter paragraph covering key trends in Precision Nutrition, Intelligent Health, and Food and Medicine. Reference specific companies.\n\n${summary}`,whitespace:`Identify 3 specific white spaces in this landscape. For each: name the gap, explain why it exists, describe a winning company.\n\n${summary}`,priority:`Write a 200-word investment memo with TMG top 3 priority targets. For each: strategic fit, key differentiator, main risk.\n\n${summary}`,thesis:`Assess how this landscape validates TMG shifts: (1) Calories to Health Outcomes, (2) Brands to Platforms, (3) Reactive to Preventative. 180 words.\n\n${summary}`,diligence:`Identify top competitive dynamics, platform risks, and biggest execution risks. 200 words.\n\n${summary}`,runway:`Which companies are most likely to need their next round in the next 6-12 months based on last funded dates and runway? Flag them for TMG to proactively engage.\n\n${summary}`};
  return p[type]||p.newsletter;
}
async function generateAI(){
  const btn=document.getElementById('btnGen');const out=document.getElementById('aiOutput');
  btn.disabled=true;btn.textContent='Generating...';out.textContent='Analysing...';out.className='ai-output idle';
  out.textContent=await callAI(buildPrompt(curPrompt));out.className='ai-output';
  btn.disabled=false;btn.textContent='Generate';
}
function copyAI(){navigator.clipboard.writeText(document.getElementById('aiOutput').textContent).then(()=>{const b=event.target;b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',1500);});}

function openSettings(){
  const load=(id,key)=>{const v=localStorage.getItem(key);const el=document.getElementById(id);if(el&&v)el.value=v;};
  load('s_geminiKey','tmg_geminiKey');load('s_claudeKey','tmg_claudeKey');load('s_workspaceId','tmg_workspaceId');load('s_groqKey','tmg_groqKey');
  const p=localStorage.getItem('tmg_provider')||'groq';const el=document.getElementById('s_provider');if(el)el.value=p;
  document.getElementById('settingsModal').classList.add('open');
}
function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
function saveSettings(){
  const save=(id,key)=>{const el=document.getElementById(id);if(el&&el.value.trim())localStorage.setItem(key,el.value.trim());};
  save('s_geminiKey','tmg_geminiKey');save('s_claudeKey','tmg_claudeKey');save('s_workspaceId','tmg_workspaceId');save('s_groqKey','tmg_groqKey');
  const p=document.getElementById('s_provider')?.value||'groq';localStorage.setItem('tmg_provider',p);
  const ai=document.getElementById('aiProvider');if(ai)ai.value=p;updateKeyLabel();
  const u=document.getElementById('s_csvUrl')?.value;if(u)localStorage.setItem('tmg_csvUrl',u);
  closeSettings();alert('Settings saved!');
}
