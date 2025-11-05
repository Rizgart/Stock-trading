import type { StockRecommendation } from '../analysis/ranking';

export const signalClass = (signal: StockRecommendation['signal']): string => {
  switch (signal) {
    case 'Köp':
      return 'buy';
    case 'Sälj':
      return 'sell';
    default:
      return 'hold';
  }
};
