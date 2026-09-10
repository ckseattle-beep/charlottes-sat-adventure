const { neon } = require('@neondatabase/serverless');

function dbUrl(){
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_DATABASE_URL;
}

// This is a single-student family site. All browsers/devices use one server-side
// profile so Charlotte's progress follows her without requiring a login.
const PROFILE_ID = 'charlotte-sat-2027-main';

function seedPayload(){
  return {
    state: {
      practiceDates: ['2026-09-09']
    },
    vocab: {},
    serverSeeded: true,
    clientUpdatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req,res){
  try{
    const url=dbUrl();
    if(!url) return res.status(503).json({error:'Database environment variable is not available to this deployment.'});
    const sql=neon(url);
    await sql`CREATE TABLE IF NOT EXISTS sat_progress (profile_hash text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    const h=PROFILE_ID;

    if(req.method==='GET'){
      let rows=await sql`SELECT payload, updated_at FROM sat_progress WHERE profile_hash=${h} LIMIT 1`;
      if(!rows[0]){
        const seed=seedPayload();
        const body=JSON.stringify(seed);
        await sql`INSERT INTO sat_progress (profile_hash,payload,updated_at) VALUES (${h},${body}::jsonb,now()) ON CONFLICT (profile_hash) DO NOTHING`;
        rows=await sql`SELECT payload, updated_at FROM sat_progress WHERE profile_hash=${h} LIMIT 1`;
      }
      return res.status(200).json(rows[0]||{payload:seedPayload()});
    }

    if(req.method==='POST'){
      const {payload}=req.body||{};
      if(!payload) return res.status(400).json({error:'Missing payload'});
      // Preserve the known first practice day during the migration from browser-only storage.
      payload.state=payload.state||{};
      const dates=new Set(payload.state.practiceDates||[]);
      dates.add('2026-09-09');
      payload.state.practiceDates=[...dates].sort();
      const body=JSON.stringify(payload);
      if(body.length>900000) return res.status(413).json({error:'Payload too large'});
      await sql`INSERT INTO sat_progress (profile_hash,payload,updated_at) VALUES (${h},${body}::jsonb,now()) ON CONFLICT (profile_hash) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()`;
      return res.status(200).json({ok:true,profile:'charlotte'});
    }

    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'Method not allowed'});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'Progress sync failed'});
  }
}
