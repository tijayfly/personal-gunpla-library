// Shared helpers: parse a free-text kit name, score image-search candidates.
// Works in Node (require) and is copied into the renderer.
(function (root) {
  const GRADES = ['PGU', 'PG', 'MG', 'RG', 'HG', 'EG', 'SD', 'FM', 'AG', 'Mega', 'Other'];
  const GRADE_INFO = {
    PG:   { name: 'Perfect Grade',   scale: '1/60',  rrp: 16500 },
    MG:   { name: 'Master Grade',    scale: '1/100', rrp: 5500 },
    RG:   { name: 'Real Grade',      scale: '1/144', rrp: 3300 },
    HG:   { name: 'High Grade',      scale: '1/144', rrp: 2200 },
    EG:   { name: 'Entry Grade',     scale: '1/144', rrp: 990 },
    SD:   { name: 'Super Deformed',  scale: '',      rrp: 990 },
    FM:   { name: 'Full Mechanics',  scale: '1/100', rrp: 4950 },
    AG:   { name: 'Advanced Grade',  scale: '1/144', rrp: 660 },
    Mega: { name: 'Mega Size',       scale: '1/48',  rrp: 11000 },
    Other:{ name: 'Other / Limited', scale: '',      rrp: 1650 },
  };
  const SERIES_HINTS = [
    [/aerial|calibarn|lfrith|witch from mercury|darilbalde|pharact/i, 'The Witch from Mercury'],
    [/gquuuuuux|gquuuux|gfred|military police zaku|challia/i, 'Mobile Suit Gundam GQuuuuuuX'],
    [/unicorn|banshee|phenex|sinanju|kshatriya/i, 'Mobile Suit Gundam Unicorn'],
    [/\bν\b|nu gundam|sazabi|hi-?ν|rx-93/i, "Char's Counterattack"],
    [/strike|freedom|justice|raider|aegis|duel|buster|seed|destiny/i, 'Gundam SEED'],
    [/age-?\d|gundam age/i, 'Gundam AGE'],
    [/qubeley|psycho|zeta|z gundam|hyaku|mk-?ii|rick dias/i, 'Zeta Gundam'],
    [/zaku iii|zz gundam|double zeta/i, 'Gundam ZZ'],
    [/gp0\d|0083/i, 'Mobile Suit Gundam 0083'],
    [/rose|nobell|shining|burning|god gundam|master gundam/i, 'G Gundam'],
    [/wing|deathscythe|heavyarms|sandrock|epyon/i, 'Gundam Wing'],
    [/exia|00 |dynames|kyrios|virtue|00 raiser/i, 'Gundam 00'],
    [/barbatos|iron-blooded|gusion|kimaris/i, 'Iron-Blooded Orphans'],
    [/turn ?a|∀/i, 'Turn A Gundam'],
    [/build|amazing|lah gundam|metaverse/i, 'Gundam Build series'],
    [/rx-78f00|factory yokohama/i, 'Gundam Factory Yokohama'],
    [/eva|evangelion/i, 'Evangelion'],
    [/patlabor|ingram/i, 'Patlabor'],
    [/valkyrie|macross|vf-1/i, 'Macross'],
    [/rx-78|zaku|guntank|guncannon|gouf|dom|z'?gok|gm\b|char/i, 'Mobile Suit Gundam'],
  ];

  function parseName(raw) {
    let s = String(raw || '').trim().replace(/\s+/g, ' ');
    let grade = 'Other';
    const m = s.match(/^(PGU|PG ?Unleashed|PG|MG|RG|HGUC|HGCE|HGFC|HGCC|HGBF|HGWM|HG|EG|Entry Grade|SDEX|SDCS|SD|FM|Full Mechanics|AG|Advanced Grade|Mega ?Size)(?![a-z])/i);
    if (m) {
      const g = m[1].toUpperCase().replace(/\s/g, '');
      if (g.startsWith('PG')) grade = 'PG';
      else if (g.startsWith('HG')) grade = 'HG';
      else if (g === 'ENTRYGRADE') grade = 'EG';
      else if (g.startsWith('SD')) grade = 'SD';
      else if (g === 'FULLMECHANICS') grade = 'FM';
      else if (g === 'ADVANCEDGRADE') grade = 'AG';
      else if (g.startsWith('MEGA')) grade = 'Mega';
      else grade = g;
    }
    let scale = (s.match(/\b1\/\d{2,3}\b/) || [''])[0] || GRADE_INFO[grade].scale;
    // tidy common shorthand
    let title = s
      .replace(/^MG ?3(\.0)?\s+(.*)$/i, 'MG $2 Ver.3.0')
      .replace(/^RG ?2(\.0)?\s+(.*)$/i, 'RG $2 Ver.2.0')
      .replace(/^PGU\b/i, 'PG Unleashed')
      .replace(/\bnu gundam\b/i, 'ν Gundam')
      .replace(/\bver\.? ?(\d)/i, 'Ver.$1');
    title = title.replace(/\b(\w)/g, (c) => c).trim();
    let series = '';
    for (const [re, name] of SERIES_HINTS) if (re.test(s)) { series = name; break; }
    const limited = /p-?bandai|premium bandai|gundam base|limited|exclusive|side-?f|yokohama|expo|clear|coating|ecopla/i.test(s);
    return { title, grade, scale, series, limited, rrpJpy: GRADE_INFO[grade].rrp };
  }

  const NOISE = /\b(review|reddit|r\/gunpla|tiktok|wiki|fandom|blog|youtube|painted|custom set|decal|water ?decal|g-rework|revealed|news|restock|3d print|wallpaper)\b/i;
  const GRADE_TOKENS = { PG: /\b(pg|perfect grade)\b/i, MG: /\b(mg|master grade)\b/i, RG: /\b(rg|real grade)\b/i, HG: /\b(hg|hguc|hgfc|hgcc|hgbf|high grade)\b/i, EG: /\b(eg|entry grade)\b/i, SD: /\b(sd|sdex|sdcs)\b/i, FM: /\b(full mechanics|fm)\b/i, AG: /\b(ag|advanced grade)\b/i, Mega: /\bmega\b/i };

  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9ν\-\/. ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !['the', 'gundam', 'gunpla', 'ver', 'bandai', 'model', 'kit', 'and', '1/144', '1/100'].includes(t));
  }
  function scoreCandidate(item, cand) {
    const t = cand.t || '';
    let score = 0;
    const want = tokens(item.title);
    const have = new Set(tokens(t));
    for (const w of want) if (have.has(w) || t.toLowerCase().includes(w)) score += 2;
    const g = item.grade;
    if (GRADE_TOKENS[g] && GRADE_TOKENS[g].test(t)) score += 3;
    for (const [k, re] of Object.entries(GRADE_TOKENS)) if (k !== g && re.test(t) && !(GRADE_TOKENS[g] && GRADE_TOKENS[g].test(t))) score -= 3;
    if (NOISE.test(t)) score -= 4;
    if (/unleashed/i.test(t) && !/unleashed/i.test(item.title)) score -= 6;
    if (/[぀-ヿ]/.test(t)) score -= 1; // marketplace listings, often used photos
    return score;
  }
  function rankCandidates(item, cands) {
    return cands.map((c, i) => ({ ...c, score: scoreCandidate(item, c) - i * 0.3 })).sort((a, b) => b.score - a.score);
  }

  const api = { GRADES, GRADE_INFO, parseName, scoreCandidate, rankCandidates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Match = api;
})(typeof window !== 'undefined' ? window : globalThis);
