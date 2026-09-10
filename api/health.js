module.exports = async function handler(req,res){
  const vars=['DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_DATABASE_URL'];
  const available=vars.filter(k=>Boolean(process.env[k]));
  res.status(200).json({ok:true,databaseEnvAvailable:available.length>0,availableVariableNames:available});
}
