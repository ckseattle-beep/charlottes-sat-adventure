const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

function dbUrl(){
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.STORAGE_DATABASE_URL;
}
function hashProfile(profile){
  return crypto.createHash('sha256').update(String(profile)).digest('hex');
}
module.exports = async function handler(req,res){
  try{
    const url=dbUrl();
    if(!url) return res.status(503).json({error:'Database environment variable is not available to this deployment.'});
    const sql=neon(url);
    await sql`CREATE TABLE IF NOT EXISTS sat_progress (profile_hash text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    if(req.method==='GET'){
      const profile=req.query.profile;
      if(!profile) return res.status(400).json({error:'Missing profile'});
      const h=hashProfile(profile);
      const rows=await sql`SELECT payload, updated_at FROM sat_progress WHERE profile_hash=${h} LIMIT 1`;
      return res.status(200).json(rows[0]||{payload:null});
    }
    if(req.method==='POST'){
      const {profile,payload}=req.body||{};
      if(!profile||!payload) return res.status(400).json({error:'Missing profile or payload'});
      const body=JSON.stringify(payload);
      if(body.length>900000) return res.status(413).json({error:'Payload too large'});
      const h=hashProfile(profile);
      await sql`INSERT INTO sat_progress (profile_hash,payload,updated_at) VALUES (${h},${body}::jsonb,now()) ON CONFLICT (profile_hash) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()`;
      return res.status(200).json({ok:true});
    }
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'Method not allowed'});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'Progress sync failed'});
  }
}
