/* eslint-disable no-console */
require('dotenv').config();
const TradingView = require('../main');

const SYMBOL = process.argv[2] || 'NSE:BANKNIFTY1!';
const TIMEFRAME = process.argv[3] || '30';
const timeZone = process.argv[4] || 'Asia/Kolkata'; // Timezone of the exchange

const client = new TradingView.Client({
  server: 'prodata',
  token: process.env.SESSION,
  signature: process.env.SIGNATURE,
  DEBUG: false, // logs raw ~m~ packets
});

const chart = new client.Session.Chart();
chart.setTimezone(timeZone);
chart.onError((...e) => console.error('Chart error:', ...e));

chart.setMarket(SYMBOL, { timeframe: TIMEFRAME, range: 500 });

// 1) Preload Sessions study
const sessionsInd = new TradingView.BuiltInIndicator('Sessions@tv-basicstudies-256');
const sessions = new chart.Study(sessionsInd);

sessions.onError((...e) => console.error('Sessions error:', ...e));
sessions.onReady(() => {
  console.log('Sessions loaded, now creating Footprint...');

  // 2) Then create Footprint
  const fp = new TradingView.BuiltInIndicator('Footprint@tv-volumebyprice-147!');
  fp.setOption('userProPlan', ''); // free, pro, pro+, premium
  fp.setOption('rowSize', 'Auto');
  fp.setOption('atrLength', 14);
  fp.setOption('ticksPerRow', 100);
  fp.setOption('showVA', false);
  fp.setOption('vaPercent', 70);
  fp.setOption('imbalancePercent', 300);
  fp.setOption('calcStackedImbalance', false);
  fp.setOption('stackedImbalanceCount', 3);

  console.log(fp);

  const footprint = new chart.Study(fp, {source: 'sds_1'});
  footprint.onError((name, msg) => {
    if (String(name).startsWith('study_not_auth')) {
      console.warn('Footprint not authorized on this account.');
      return;
    }
    console.error('Footprint error:', name, msg);
  });

  footprint.onReady(() => console.log('Footprint ready'));
  footprint.onUpdate((changes) => {
    console.log('Footprint updated:', changes);
    if (!changes.includes('graphic') && !changes.includes('plots')) return;
    // Inspect graphic/plots here
    // console.log(footprint.graphic);
  });
});

chart.onUpdate(() => {
  if (chart.footprints.length) 
  {
    const candleCount = chart.periods.length;
    const footprints = chart.footprints.slice(0, candleCount);
    console.log(`Last ${candleCount} candles have footprints:`, footprints.length === candleCount);

    const combined = footprints.map((f, i) => ({
      ...chart.periods[i],
      footprint: f,
    }) );

    combined.forEach((candle) => {
      const exchange_timestamp = new Date(candle.time * 1000).toLocaleString('en-US', { timeZone: timeZone || chart.timezone});
      //console.log("CANDLE:", exchange_timestamp, candle.volume, candle.footprint.levels);
    });

    const last = combined[0];
    const timestamp = last.time;
    const exchange_timestamp = new Date(timestamp * 1000).toLocaleString('en-US', { timeZone: timeZone || chart.timezone});
    console.log(exchange_timestamp, last['open'], last['high'], last['low'], last['close'], ' | ', last.footprint.levels.length, 'levels', last.footprint.levels);
  }
});
