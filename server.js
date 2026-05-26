// ============================================================
// DugoutOS — Softball Coach Assistant
// Express server — all AI calls stay server-side
// ============================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// ── Init ────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Middleware ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

// ── System prompts ──────────────────────────────────────────
const SYSTEM_PROMPTS = {
  'head-coach': (ctx) => `You are an experienced travel softball head coach and player development expert. Practical, specific, actionable. Respond in markdown.
Team: ${ctx.teamName || 'My Team'} (${ctx.ageGroup || '10U'}), Season: ${ctx.season || 'current'}
Record: ${ctx.record || 'not set'}. Roster: ${ctx.rosterCount || 0} players.`,

  'practice-planner': (ctx) => `You are a travel softball practice plan specialist. Create structured, time-blocked plans.
Team: ${ctx.teamName} (${ctx.ageGroup}). Duration: ${ctx.duration}. Focus: ${ctx.focus}. Players: ${ctx.playerCount}.
${ctx.coaches ? `Assistant coaches: ${ctx.coaches}` : 'Solo coach.'}
Generate TWO versions separated ONLY by this exact line: ---PLAYER-VERSION---
COACH version: markdown with station assignments, reps, coaching cues.
PLAYER version: age-appropriate language with SVG field diagrams inline.`,

  'tournament-planner': (ctx) => `You are a travel softball tournament logistics expert. Create dual-version weekend itineraries.
Team: ${ctx.teamName} (${ctx.ageGroup}). Tournament: ${ctx.tournamentName} at ${ctx.location}.
Generate TWO versions separated ONLY by: ---PARENT-VERSION---
COACH version: coaching strategy, prep, game-by-game playbook, logistics.
PARENT/PLAYER version: scannable, bold key facts, what to bring, uniform, food plan.`,

  'fundraising': (ctx) => `You are a youth sports fundraising expert. Create practical, actionable fundraiser plans.
Team: ${ctx.teamName} (${ctx.ageGroup}). Fundraiser: ${ctx.name} (${ctx.type}). Goal: $${ctx.goal}.
Generate TWO versions separated ONLY by: ---FAMILY-VERSION---
COORDINATOR version: numbered task checklist, timeline, marketing plan, execution guide.
FAMILY version: what we're doing, how to help, important dates, FAQ.`,

  'band-post': (ctx) => `You write warm, clear Band app posts for youth softball team parents. Plain text. Emojis OK. No hashtags. No markdown. Under 200 words.
Team: ${ctx.teamName || 'the team'}. Coach: ${ctx.coachName || 'Coach'}.${ctx.lastGame ? ` Last game: ${ctx.lastGame}` : ''}`,

  'gc-analysis': () => `You are a travel softball batting analyst. Analyze GameChanger stats and provide specific coaching insights.
Use markdown. Sections: ## Team overview, ## Strengths, ## Areas to develop, ## Top performers, ## Recommended practice focus.`,

  'research': (ctx) => `You are a softball skill development expert specializing in ${ctx.ageGroup || '10U'} ${ctx.level || 'intermediate'} players.
Provide a thorough breakdown of the requested topic. Markdown sections: ## Overview, ## Key mechanics, ## Progressions (3 steps), ## Common errors & fixes, ## Coaching cues, ## Practice integration.`,

  'ask-coach': (ctx) => `You are an expert travel softball head coach and educator. Answer questions about mechanics, strategy, player development, parent communication, and team management.
Team context: ${ctx.teamName || 'My Team'} (${ctx.ageGroup || '10U'}). Respond in markdown.`
};

// ── Helper: streaming response ───────────────────────────────
async function streamAI(res, { mode, context = {}, messages, maxTokens = 2000 }) {
  const systemFn = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS['ask-coach'];
  const system   = typeof systemFn === 'function' ? systemFn(context) : systemFn;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

// ── Error wrapper ────────────────────────────────────────────
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// ROUTES — PRACTICE
// ============================================================
app.post('/api/practice/generate', wrap(async (req, res) => {
  const { age, duration, players, focus, coaches, notes, context = {} } = req.body;
  await streamAI(res, {
    mode: 'practice-planner',
    context: { ...context, ageGroup: age, duration, playerCount: players, focus, coaches, notes },
    messages: [{ role: 'user', content: `Generate dual practice plan.\nAge: ${age}\nDuration: ${duration}\nPlayers: ${players}\nFocus: ${focus}\nCoaches: ${coaches || 'solo'}\n${notes ? 'Notes: ' + notes : ''}` }],
    maxTokens: 6000
  });
}));

app.get('/api/practice/plans', wrap(async (req, res) => {
  const orgId = req.query.org_id;
  const { data, error } = await supabase
    .from('practice_plans')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  res.json(data);
}));

app.post('/api/practice/plans', wrap(async (req, res) => {
  const { org_id, title, age, duration, focus, coaches_list, coach_content, player_content } = req.body;
  const { data, error } = await supabase.from('practice_plans').insert({
    id: uuidv4(), org_id, title, age, duration, focus, coaches_list,
    coach_content, player_content, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/practice/plans/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('practice_plans').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ============================================================
// ROUTES — TOURNAMENTS
// ============================================================
app.post('/api/tournaments/generate', wrap(async (req, res) => {
  const { tournament, context = {} } = req.body;
  const gameLines = (tournament.games || []).map((g, i) =>
    `Game ${i+1}: Day ${g.day} | #${g.gameNum} | ${g.time || 'TBD'} (arrive ${g.arrive || 'TBD'}) | vs ${g.opp || 'TBD'} | ${g.field || 'TBD'} | ${g.uniform}`
  ).join('\n');

  await streamAI(res, {
    mode: 'tournament-planner',
    context: { ...context, tournamentName: tournament.name, location: tournament.location },
    messages: [{ role: 'user', content: `Tournament: ${tournament.name}\nLocation: ${tournament.location}\nDates: ${tournament.startDate} to ${tournament.endDate || tournament.startDate}\nFormat: ${tournament.format}\nPrimary uniform: ${tournament.uniformPrimary || 'team primary'}\nAlternate: ${tournament.uniformAlt || 'team alternate'}\nParking: ${tournament.parkingInfo || 'standard'}\nFood: ${tournament.foodPlan || 'on your own'}\nSchedule:\n${gameLines}\nNotes: ${tournament.notes || 'none'}` }],
    maxTokens: 7000
  });
}));

app.post('/api/tournaments', wrap(async (req, res) => {
  const { tournament } = req.body;
  const { data, error } = await supabase.from('tournaments').insert({
    id: uuidv4(), ...tournament, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.get('/api/tournaments', wrap(async (req, res) => {
  const { data, error } = await supabase.from('tournaments')
    .select('*, tournament_games(*)')
    .eq('org_id', req.query.org_id)
    .order('start_date', { ascending: true });
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// ROUTES — SEASON / GAMES
// ============================================================
app.get('/api/games', wrap(async (req, res) => {
  const { data, error } = await supabase.from('games')
    .select('*')
    .eq('org_id', req.query.org_id)
    .order('game_date', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

app.post('/api/games', wrap(async (req, res) => {
  const { data, error } = await supabase.from('games').insert({
    id: uuidv4(), ...req.body, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/games/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('games').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

app.post('/api/games/:id/stats', wrap(async (req, res) => {
  const { stats } = req.body; // { playerId: {ab,h,d,t,hr,rbi,r,bb,k,sb} }
  const upserts = Object.entries(stats).map(([pid, s]) => ({
    id: uuidv4(), game_id: req.params.id, player_id: pid, ...s,
    created_at: new Date().toISOString()
  }));
  await supabase.from('player_stats').delete().eq('game_id', req.params.id);
  const { data, error } = await supabase.from('player_stats').insert(upserts).select();
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// ROUTES — ROSTER / PLAYERS
// ============================================================
app.get('/api/players', wrap(async (req, res) => {
  const { data, error } = await supabase.from('players')
    .select('*, player_stats(*)')
    .eq('org_id', req.query.org_id)
    .order('jersey_number', { ascending: true });
  if (error) throw error;
  res.json(data);
}));

app.post('/api/players', wrap(async (req, res) => {
  const { data, error } = await supabase.from('players').insert({
    id: uuidv4(), ...req.body, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.patch('/api/players/:id', wrap(async (req, res) => {
  const { data, error } = await supabase.from('players')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/players/:id', wrap(async (req, res) => {
  await supabase.from('player_stats').delete().eq('player_id', req.params.id);
  const { error } = await supabase.from('players').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ============================================================
// ROUTES — FUNDRAISING
// ============================================================
app.post('/api/fundraising/generate', wrap(async (req, res) => {
  const { fundraiser, context = {} } = req.body;
  await streamAI(res, {
    mode: 'fundraising',
    context: { ...context, name: fundraiser.name, type: fundraiser.type, goal: fundraiser.goalAmount },
    messages: [{ role: 'user', content: `Fundraiser: ${fundraiser.name}\nType: ${fundraiser.type}\nGoal: $${fundraiser.goalAmount}${fundraiser.perPlayer ? ` ($${fundraiser.perPlayer}/player)` : ''}\nDates: ${fundraiser.startDate || 'TBD'} to ${fundraiser.endDate || 'TBD'}\nCoordinator: ${fundraiser.coordinator || 'TBD'}\nLocation: ${fundraiser.location || 'TBD'}\nDescription: ${fundraiser.description || 'Standard fundraiser'}` }],
    maxTokens: 5000
  });
}));

app.post('/api/fundraising', wrap(async (req, res) => {
  const { data, error } = await supabase.from('fundraising_campaigns').insert({
    id: uuidv4(), ...req.body.fundraiser, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.get('/api/fundraising', wrap(async (req, res) => {
  const { data, error } = await supabase.from('fundraising_campaigns')
    .select('*').eq('org_id', req.query.org_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// ROUTES — LIBRARY / RESEARCH
// ============================================================
app.post('/api/library/research', wrap(async (req, res) => {
  const { topic, age, level, category, context = {} } = req.body;
  await streamAI(res, {
    mode: 'research',
    context: { ...context, ageGroup: age, level },
    messages: [{ role: 'user', content: `Research: ${topic}\nAge: ${age}\nLevel: ${level}\nCategory: ${category}` }],
    maxTokens: 2500
  });
}));

app.post('/api/library', wrap(async (req, res) => {
  const { data, error } = await supabase.from('drill_library').insert({
    id: uuidv4(), ...req.body, created_at: new Date().toISOString()
  }).select().single();
  if (error) throw error;
  res.json(data);
}));

app.get('/api/library', wrap(async (req, res) => {
  let query = supabase.from('drill_library').select('*').eq('org_id', req.query.org_id);
  if (req.query.category) query = query.eq('category', req.query.category);
  if (req.query.search) query = query.ilike('topic', `%${req.query.search}%`);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/library/:id', wrap(async (req, res) => {
  const { error } = await supabase.from('drill_library').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

// ============================================================
// ROUTES — COACH AI CHAT
// ============================================================
app.post('/api/chat', wrap(async (req, res) => {
  const { messages, mode = 'ask-coach', context = {} } = req.body;
  await streamAI(res, { mode, context, messages, maxTokens: 1500 });
}));

// ============================================================
// ROUTES — INTEGRATIONS
// ============================================================

// GameChanger CSV import
app.post('/api/integrations/gamechanger/import', upload.single('file'), wrap(async (req, res) => {
  let rawText = '';
  if (req.file) {
    rawText = req.file.buffer.toString('utf8');
  } else if (req.body.pastedText) {
    rawText = req.body.pastedText;
  } else {
    return res.status(400).json({ error: 'No file or pasted text provided' });
  }

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: 'Parse GameChanger stats. Return ONLY valid JSON, no markdown. Schema: { teamAVG, teamOPS, totalHR, totalRBI, totalSB, gamesCount, topHitter: {name, avg}, players: [{name, ab, h, avg, ops, hr, rbi, sb}] }',
    messages: [{ role: 'user', content: `Parse:\n\n${rawText.slice(0, 8000)}` }]
  });

  const text = msg.content[0]?.text || '';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json({ ok: true, stats: parsed });
  } catch {
    res.json({ ok: false, raw: text, error: 'Could not auto-parse — use raw text' });
  }
}));

// GameChanger AI analysis
app.post('/api/integrations/gamechanger/analyze', wrap(async (req, res) => {
  const { stats, context = {} } = req.body;
  await streamAI(res, {
    mode: 'gc-analysis',
    context,
    messages: [{ role: 'user', content: `Analyze for ${context.teamName || 'the team'} (${context.ageGroup || '10U'}):\n\n${JSON.stringify(stats, null, 2)}` }],
    maxTokens: 1200
  });
}));

// Band post draft
app.post('/api/integrations/band/draft', wrap(async (req, res) => {
  const { type, context = {} } = req.body;
  const typePrompts = {
    'game-recap':   'Write a Band app post recapping the most recent game. Celebratory, 3-5 sentences. End with a hype line.',
    'practice':     'Write a Band app practice reminder with [DAY] [TIME] placeholders. Under 100 words.',
    'tournament':   'Write a Band app tournament info post with [TOURNAMENT NAME], [DATE], [LOCATION] placeholders.',
    'fundraiser':   'Write a Band app fundraiser push post with [LINK] placeholder.',
    'weather':      'Write a Band app weather/schedule update with [SITUATION] placeholder.',
    'spotlight':    'Write a Band app player spotlight with [PLAYER NAME] and [JERSEY #] placeholders.',
    'highlight':    'Write a Band app caption for a highlight video. Hype the player, 2-3 softball emojis, under 60 words.'
  };
  await streamAI(res, {
    mode: 'band-post',
    context,
    messages: [{ role: 'user', content: (typePrompts[type] || typePrompts['game-recap']) + `\n\nTeam: ${context.teamName}\nCoach: ${context.coachName || 'Coach'}${context.lastGame ? '\nLast game: ' + context.lastGame : ''}` }],
    maxTokens: 400
  });
}));

// AI Compose (multi-platform)
app.post('/api/integrations/compose', wrap(async (req, res) => {
  const { platform, type, contextNote, context = {} } = req.body;
  const guides = {
    band: 'Band app post. Brief, plain text, emojis OK, no markdown, no hashtags.',
    gc:   'GameChanger post. Stats-focused, plain text.',
    ncs:  'NCS tournament announcement. Official but friendly.'
  };
  await streamAI(res, {
    mode: 'band-post',
    context,
    messages: [{ role: 'user', content: `Write a ${type} for ${(platform||'band').toUpperCase()}.\nTeam: ${context.teamName} (${context.ageGroup})\n${contextNote ? 'Context: ' + contextNote : ''}\nStyle: ${guides[platform] || guides.band}` }],
    maxTokens: 500
  });
}));

// AI briefing
app.post('/api/integrations/briefing', wrap(async (req, res) => {
  const { context = {} } = req.body;
  await streamAI(res, {
    mode: 'ask-coach',
    context,
    messages: [{ role: 'user', content: `Generate a cross-platform team status briefing.\n\nTeam: ${context.teamName} (${context.ageGroup})\nRecord: ${context.record || 'not set'}\nRoster: ${context.rosterCount || 0} players\nPlans: ${context.plansCount || 0}\nActive fundraisers: ${context.activeFundraisers || 0}\n${context.lastGame ? 'Last game: ' + context.lastGame : ''}\n\nSections: ## Season status, ## What to post on Band, ## GameChanger focus, ## NCS events to watch.` }],
    maxTokens: 700
  });
}));

// ============================================================
// ROUTES — SETTINGS / ORG
// ============================================================
app.get('/api/settings', wrap(async (req, res) => {
  const { data, error } = await supabase.from('organizations')
    .select('*').eq('id', req.query.org_id).single();
  if (error) return res.status(404).json({ error: 'Org not found' });
  res.json(data);
}));

app.patch('/api/settings', wrap(async (req, res) => {
  const { data, error } = await supabase.from('organizations')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.body.org_id).select().single();
  if (error) throw error;
  res.json(data);
}));

// ============================================================
// STATIC FALLBACK (GitHub Pages SPA)
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`DugoutOS running on http://localhost:${PORT}`));
module.exports = app;
