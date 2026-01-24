const cron = require('cron');
const https = require('https');

// Self-ping cron job to prevent Render free tier from spinning down
// Pings the health endpoint every 14 minutes (Render spins down after 15 min idle)
const job = new cron.CronJob('*/14 * * * *', function () {
  const apiUrl = process.env.API_URL;
  
  if (!apiUrl) {
    console.warn('⚠️ API_URL not set - cron job cannot ping server');
    return;
  }

  console.log('🔄 Cron: Pinging server to keep alive...');
  
  https
    .get(apiUrl, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Cron: Server pinged successfully');
      } else {
        console.log(`⚠️ Cron: Ping failed with status ${res.statusCode}`);
      }
    })
    .on('error', (e) => {
      console.error('❌ Cron: Error while pinging server:', e.message);
    });
});

module.exports = job;

// Cron jobs are scheduled tasks that run periodically at fixed intervals
// We send 1 GET request every 14 minutes to keep the server awake on Render's free tier

// How to define a "Schedule"?
// You define a schedule using a cron expression, which consists of 5 fields representing:

//! MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

//? EXAMPLES && EXPLANATION:
//* */14 * * * * - Every 14 minutes
//* 0 0 * * 0 - At midnight on every Sunday
//* 30 3 15 * * - At 3:30 AM, on the 15th of every month
//* 0 0 1 1 * - At midnight, on January 1st
//* 0 * * * * - Every hour
