export function demoFiles() {
  const campaigns = [
    ['g-brand', 'Brand · Search', 4800, 33600, 12, 28000],
    ['g-nonbrand', 'Non-brand · Search', 12600, 44100, 18, 62000],
    ['m-retarget', 'Retargeting · Meta', 6400, 28800, 16, 34000],
    ['m-prospect', 'Prospecting · Meta', 9600, 14400, 8, 48000],
    ['g-pmax', 'Performance Max', 8200, 24600, 10, 39000],
    ['m-lookalike', 'Lookalike · Meta', 5200, 3900, 3, 21000],
  ];
  const ads = ['Campaign ID,Campaign name,Date,Amount spent,Currency'];
  const crm = ['Record ID,Campaign ID,Campaign,Deal Stage,Amount,Currency'];
  let sequence = 1;
  for (const [id, name, spend, revenue, closed, pipeline] of campaigns) {
    for (let day = 1; day <= 30; day++) ads.push(`${id},${name},2026-08-${String(day).padStart(2, '0')},${(day === 30 ? spend - Math.floor(spend / 30) * 29 : Math.floor(spend / 30)).toFixed(2)},USD`);
    for (let i = 0; i < closed; i++) crm.push(`${sequence++},${id},${name},Closed Won,${(revenue / closed).toFixed(2)},USD`);
    for (let i = 0; i < 8; i++) crm.push(`${sequence++},${id},${name},Proposal,${(pipeline / 8).toFixed(2)},USD`);
    for (let i = 0; i < 3; i++) crm.push(`${sequence++},${id},${name},Closed Lost,1500,USD`);
  }
  ads.push(...ads.slice(8, 18)); crm.push(...crm.slice(3, 7));
  return { ads: ads.join('\n'), crm: crm.join('\n') };
}
