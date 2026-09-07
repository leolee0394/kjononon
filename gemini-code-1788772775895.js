// State Management
let rawData = [
  { "Company Name": "NutriFit AI", "TMG Focus Area": "Precision Nutrition", "Stage": "Seed", "Location": "San Francisco, CA", "Estimated Runway (months)": 18, "Market Traction": 4, "Data Moat": 3 },
  { "Company Name": "Pulse Health", "TMG Focus Area": "Intelligent Health", "Stage": "Series A", "Location": "Boston, MA", "Estimated Runway (months)": 24, "Market Traction": 5, "Data Moat": 4 },
  { "Company Name": "BioFarm Meds", "TMG Focus Area": "Food & Medicine", "Stage": "Pre-seed", "Location": "New York, NY", "Estimated Runway (months)": 12, "Market Traction": 2, "Data Moat": 2 },
  { "Company Name": "GeneCare", "TMG Focus Area": "Intelligent Health", "Stage": "Series B", "Location": "London, UK", "Estimated Runway (months)": 30, "Market Traction": 4, "Data Moat": 5 }
];

let dataStore = [];
let filteredData = [];
let claudePayload = '';
let claudePromptType = 'overview';

// Init Application
document.addEventListener("DOMContentLoaded", () => {
  loadData(rawData);
  updateKeyLabel();
});

function loadData(inputArray) {
  // Deduplicate entries by Company Name upon refresh or reload
  const map = new Map();
  inputArray.forEach(item => {
    if (item["Company Name"]) {
      map.set(item["Company Name"].trim().toLowerCase(), item);
    }
  });
  dataStore = Array.from(map.values());
  filterAndRender();
}

function refreshData() {
  // Reload without producing duplicate items
  loadData(rawData);
}

function filterAndRender() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const stage = document.getElementById('stageFilter').value;

  filteredData = dataStore.filter(item => {
    const matchesSearch = !query || 
      item['Company Name']?.toLowerCase().includes(query) ||
      item['TMG Focus Area']?.toLowerCase().includes(query) ||
      item['Location']?.toLowerCase().includes(query);
    
    const matchesStage = !stage || item['Stage'] === stage;
    return matchesSearch && matchesStage;
  });

  renderTable(filteredData);
  renderVisualizations(filteredData);
}

// Render Table
function renderTable(data) {
  const tbody = document.querySelector('#companyTable tbody');
  if(!tbody) return;
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><strong>${r['Company Name']}</strong></td>
      <td>${r['TMG Focus Area'] || 'N/A'}</td>
      <td><span class="badge" style="background:#e2e8f0">${r['Stage']}</span></td>
      <td>${r['Location'] || 'Unknown'}</td>
      <td>${r['Estimated Runway (months)'] ? r['Estimated Runway (months)'] + ' mo' : 'N/A'}</td>
    </tr>
  `).join('');
}

// Render Remaining Required Visualizations (Funding Timeline & Geo Map)
function renderVisualizations(data) {
  const vcFunding = document.getElementById('vis-funding');
  const vcGeo = document.getElementById('vis-geo');

  if(vcFunding) renderFundingTimeline(data, vcFunding);
  if(vcGeo) renderGeographicMap(data, vcGeo);
}

function renderFundingTimeline(data, container) {
  const stageOrder = {'Pre-seed':1, 'Seed':2, 'Series A':3, 'Series B':4, 'Public':5};
  const sorted = [...data].filter(r => stageOrder[r['Stage']]).sort((a,b) => stageOrder[a['Stage']] - stageOrder[b['Stage']]);
  const colors = {'Precision Nutrition':'#e07535', 'Intelligent Health':'#2563eb', 'Food & Medicine':'#16a34a'};

  container.innerHTML = `
    <div class="vis-card">
      <div class="vis-card-hdr">
        <span class="vis-card-title">Funding Timeline</span>
        <button class="btn btn-secondary" onclick="dlVis('ft-inner')">Download PNG</button>
      </div>
      <div class="vis-card-desc">Companies arranged by funding stage maturity.</div>
      <div id="ft-inner" style="background:#fff; padding:14px; border-radius:7px">
        ${['Pre-seed','Seed','Series A','Series B','Public'].map(stage => {
          const comps = sorted.filter(r => r['Stage'] === stage);
          if(!comps.length) return '';
          return `
            <div style="margin-bottom:14px">
              <div style="font-size:11px; font-weight:600; color:#64748b; margin-bottom:6px;">${stage.toUpperCase()}</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${comps.map(r => `
                  <div style="background:${colors[r['TMG Focus Area']] || '#888'}; color:white; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600">
                    ${r['Company Name']}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderGeographicMap(data, container) {
  // Safe geographic location display with fallback handling
  const locations = {};
  data.forEach(r => {
    const loc = r['Location'] || 'Unknown';
    locations[loc] = (locations[loc] || 0) + 1;
  });

  container.innerHTML = `
    <div class="vis-card">
      <div class="vis-card-hdr">
        <span class="vis-card-title">Geographic Breakdown</span>
        <button class="btn btn-secondary" onclick="dlVis('geo-inner')">Download PNG</button>
      </div>
      <div class="vis-card-desc">Distribution of portfolio companies by registered location.</div>
      <div id="geo-inner" style="background:#fff; padding:14px; border-radius:7px">
        ${Object.keys(locations).length === 0 ? '<p style="font-size:0.875rem; color:#64748b;">No geographic data available.</p>' : ''}
        <ul style="list-style:none; padding:0;">
          ${Object.entries(locations).map(([loc, count]) => `
            <li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:0.875rem;">
              <span>📍 ${loc}</span>
              <strong>${count} company${count > 1 ? 'ies' : ''}</strong>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

// Decoupled URL Scraper (Works independently without requiring Gemini/Claude)
async function scrapeUrl() {
  const url = document.getElementById('scrapeUrl').value.trim();
  const output = document.getElementById('scrapeResult');
  if (!url) { alert('Please enter a valid URL'); return; }

  output.textContent = "Fetching content via Jina Reader...";

  try {
    const res = await fetch(`https://r.jina.ai/${url}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    output.textContent = text.substring(0, 1500) + (text.length > 1500 ? '\n\n[Truncated...]' : '');
  } catch (err) {
    output.textContent = `Scraping Error: ${err.message}. Jina AI fetched raw content, but web endpoint failed to respond.`;
  }
}

// AI Integration Handler
async function callAI(promptText) {
  const provider = localStorage.getItem('tmg_provider') || 'gemini';
  try {
    if (provider === 'gemini') {
      const key = localStorage.getItem('tmg_geminiKey');
      if (!key) throw new Error('Missing Gemini API Key');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error.message || 'Gemini error');
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    } else {
      const key = localStorage.getItem('tmg_claudeKey');
      if (!key) throw new Error('Missing Claude API Key');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'dangerously-allow-browser-headers': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [{ role: 'user', content: promptText }]
        })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error.message || 'Claude error');
      return data?.content?.[0]?.text || 'No response generated.';
    }
  } catch (err) {
    return `AI Generation Notice: ${err.message}`;
  }
}

// UI Navigation & Modals
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(`view-${tabId}`).classList.add('active');
}

function openSettings() { document.getElementById('settingsModal').classList.add('open'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }

function saveSettings() {
  localStorage.setItem('tmg_geminiKey', document.getElementById('s_geminiKey').value.trim());
  localStorage.setItem('tmg_claudeKey', document.getElementById('s_claudeKey').value.trim());
  localStorage.setItem('tmg_provider', document.getElementById('s_provider').value);
  updateKeyLabel();
  closeSettings();
}

function updateKeyLabel() {
  const p = localStorage.getItem('tmg_provider') || 'gemini';
  const label = document.getElementById('activeProviderLabel');
  if (label) label.textContent = `Provider: ${p === 'gemini' ? 'Gemini' : 'Claude'}`;
}

function openClaudeModal() {
  setClaude('overview');
  document.getElementById('claudeModal').classList.add('open');
}
function closeClaudeModal() { document.getElementById('claudeModal').classList.remove('open'); }

function setClaude(type) {
  claudePromptType = type;
  document.querySelectorAll('#claudeModal .ai-opt').forEach(b => b.classList.remove('btn-primary'));
  const summary = filteredData.map(r => `${r['Company Name']} | ${r['TMG Focus Area']} | Stage: ${r['Stage']}`).join('\n');
  
  const prompts = {
    overview: `Analyze this market landscape (${filteredData.length} companies):\n${summary}`,
    gaps: `Identify market white spaces based on:\n${summary}`,
    synthesis: `Summarize portfolio trends across:\n${summary}`
  };
  
  claudePayload = prompts[type] || prompts.overview;
  document.getElementById('claudePromptText').textContent = claudePayload;
}

function copyForClaude() {
  navigator.clipboard.writeText(claudePayload);
  alert('Prompt copied to clipboard!');
}

function openClaude() { window.open('https://claude.ai', '_blank'); }

function dlVis(id) {
  const el = document.getElementById(id);
  if (!el) return;
  html2canvas(el).then(canvas => {
    const a = document.createElement('a');
    a.download = `${id}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}