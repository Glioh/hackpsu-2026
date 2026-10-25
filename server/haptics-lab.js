import { randomBytes } from 'node:crypto';
import express from 'express';

// Isolated experiments: no game rooms or third-party relay service involved.
export function installHapticsLab(app) {
  const sessions = new Map(), lifetime = 5 * 60 * 1000;
  function prune() { for (const [id, s] of sessions) if (Date.now() > s.expires) sessions.delete(id); }
  app.use('/api/haptics-lab', express.json({limit:'1kb'}), (req, res, next) => {
    res.set('Cache-Control', 'no-store'); prune(); next();
  });
  app.post('/api/haptics-lab', (req, res) => {
    if (sessions.size >= 100) return res.status(429).json({error:'Too many experiments. Try again in five minutes.'});
    const id = randomBytes(24).toString('hex');
    sessions.set(id, {expires:Date.now()+lifetime, queue:[], next:0, polls:0, attempted:0, lastPoll:null, stopped:false});
    res.json({id});
  });
  app.use('/api/haptics-lab/:id', (req, res, next) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({error:'Experiment expired. Create a new one.'});
    res.locals.session = session; next();
  });
  app.post('/api/haptics-lab/:id/pulse', (req, res) => {
    const s = res.locals.session, delayMs = req.body?.delayMs ?? 0;
    if (s.stopped) return res.status(409).json({error:'Experiment stopped. Create a new one.'});
    if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 15000) return res.status(400).json({error:'Invalid delay.'});
    if (s.queue.length >= 10) return res.status(429).json({error:'Experiment queue full.'});
    const pulse = {id:++s.next, due:Date.now()+delayMs}; s.queue.push(pulse);
    res.json({queued:pulse.id, due:pulse.due});
  });
  app.get('/api/haptics-lab/:id/status', (req, res) => {
    const s = res.locals.session;
    res.json({polls:s.polls, attempted:s.attempted, lastPoll:s.lastPoll, queued:s.queue.length, stopped:s.stopped});
  });
  app.post('/api/haptics-lab/:id/stop', (req, res) => {
    const s = res.locals.session; s.stopped = true; s.queue = []; res.json({ok:true});
  });
  app.get('/api/haptics-lab/:id/poll', (req, res) => {
    const s = res.locals.session;
    s.polls++; s.lastPoll = Date.now();
    const attempted = Number(req.query.attempted);
    if (Number.isSafeInteger(attempted) && attempted >= 0 && attempted <= s.next) s.attempted = Math.max(s.attempted, attempted);
    // The wait is on the server so the synchronous browser experiment needn't busy-spin.
    setTimeout(() => {
      const index = s.queue.findIndex(p => p.due <= Date.now());
      const pulse = index < 0 ? null : s.queue.splice(index, 1)[0];
      res.json({pulse, stopped:s.stopped});
    }, 180);
  });
}
