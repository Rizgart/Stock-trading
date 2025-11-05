import type { HistoricalCandle } from '../services/marketData';

export const movingAverage = (values: number[], period: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) {
      result.push(NaN);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const avg = slice.reduce((acc, value) => acc + value, 0) / period;
    result.push(Number(avg.toFixed(2)));
  }
  return result;
};

export const rsi = (values: number[], period = 14): number[] => {
  if (values.length === 0) {
    return [];
  }
  const result: number[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    if (i <= period) {
      if (change > 0) gains += change;
      else losses -= change;
      result.push(NaN);
      continue;
    }

    const averageGain = (gains * (period - 1) + Math.max(change, 0)) / period;
    const averageLoss = (losses * (period - 1) + Math.max(-change, 0)) / period;
    gains = averageGain;
    losses = averageLoss;

    if (averageLoss === 0) {
      result.push(100);
    } else {
      const rs = averageGain / averageLoss;
      const value = 100 - 100 / (1 + rs);
      result.push(Number(value.toFixed(2)));
    }
  }

  result.unshift(NaN);
  return result;
};

export const atr = (candles: HistoricalCandle[], period = 14): number[] => {
  if (candles.length === 0) {
    return [];
  }
  const trs: number[] = candles.map((candle, idx) => {
    if (idx === 0) {
      return candle.high - candle.low;
    }
    const prevClose = candles[idx - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );
  });

  const result: number[] = [];
  let previous = trs[0];
  for (let i = 0; i < trs.length; i += 1) {
    if (i < period) {
      result.push(NaN);
      previous = trs[i];
      continue;
    }
    const value = (previous * (period - 1) + trs[i]) / period;
    previous = value;
    result.push(Number(value.toFixed(2)));
  }
  return result;
};
