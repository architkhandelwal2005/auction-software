/* Which of a player's sheet columns to show, and under what label. Shared by
   the roster, the live view and the admin dashboard, so every screen shows
   the same details.

   With columns chosen in setup (config "display_fields"), those are shown in
   that order. With none chosen, the most useful ones are picked: playing
   role, age, batting and bowling style, keeping, skill, city, organisation,
   profession, then any other short answer. Serial numbers, timestamps,
   contact details, prices and long free-text answers are never shown. */
(function (root) {
  'use strict';

  const HIDDEN = /^(name|player[\s_]*name|full[\s_]*name|photo|photo[\s_]*url|photo[\s_]*preview|image|base[\s_]*price|price|category|id|player[\s_]*id|mobile|mobile[\s_]*(no|number)\.?|phone|phone[\s_]*(no|number)\.?|contact|contact[\s_]*(no|number)\.?|email|e-?mail[\s_]*(id|address)|whatsapp|whatsapp[\s_]*(no|number)\.?|address|team[\s_]*id|team[\s_]*role|sold[\s_]*price|status|sold[\s_]*at|timestamp|column[\s_]*\d+|s\.?[\s_]*no\.?|sr\.?[\s_]*no\.?|serial([\s_]*(no|number))?)$/i;

  // [pattern, short label] — one column per pattern, in this order.
  const PRIORITY = [
    [/role|position|plays[\s_]*as|speciali[sz]/i, 'Role'],
    [/^age\b|\bage$/i, 'Age'],
    [/batting/i, 'Bat'],
    [/bowling/i, 'Bowl'],
    [/keep/i, 'WK'],
    [/skill|strength|level|rate[\s_]*themselves|experience/i, 'Skill'],
    [/city|town|location|area/i, 'City'],
    [/company|organi[sz]ation|club/i, 'Org'],
    [/profession|occupation|designation/i, 'Work'],
  ];
  const SHORT = 28;   // longer answers are free text, not a detail

  function playerDetails(attributes, displayFields, max, category) {
    if (!attributes || typeof attributes !== 'object') return [];
    const cat = String(category || '').trim().toLowerCase();
    const entries = Object.entries(attributes).filter(([k, v]) =>
      v != null && String(v).trim() !== '' && !HIDDEN.test(String(k).trim())
      && String(v).trim().toLowerCase() !== cat);   // the category is shown already
    const limit = max || 4;

    const chosen = Array.isArray(displayFields) ? displayFields.map(f => String(f).trim().toLowerCase()) : [];
    if (chosen.length) {
      return entries
        .filter(([k]) => chosen.includes(String(k).trim().toLowerCase()))
        .sort(([a], [b]) => chosen.indexOf(a.trim().toLowerCase()) - chosen.indexOf(b.trim().toLowerCase()))
        .slice(0, limit)
        .map(([k, v]) => ({ key: k, label: k, value: String(v).trim() }));
    }

    const picked = [], used = new Set();
    PRIORITY.forEach(([re, label]) => {
      const hit = entries.find(([k, v]) => !used.has(k) && re.test(k) && String(v).trim().length <= SHORT);
      if (hit) { used.add(hit[0]); picked.push({ key: hit[0], label: label, value: String(hit[1]).trim() }); }
    });
    entries.forEach(([k, v]) => {
      if (!used.has(k) && String(v).trim().length <= SHORT && String(k).trim().length <= 18) {
        used.add(k); picked.push({ key: k, label: k, value: String(v).trim() });
      }
    });
    return picked.slice(0, limit);
  }

  root.playerDetails = playerDetails;
})(typeof window !== 'undefined' ? window : this);
