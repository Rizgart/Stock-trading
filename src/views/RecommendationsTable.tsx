import React from 'react';
import type { StockRecommendation } from '../analysis/ranking';
import { formatCurrency, formatPct } from '../utils/format';
import { signalClass } from '../utils/signals';

interface Props {
  items: StockRecommendation[];
  compact?: boolean;
}

const RecommendationsTable: React.FC<Props> = ({ items, compact }) => {
  return (
    <div className={`table ${compact ? 'compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Bolag</th>
            <th>Poäng</th>
            <th>Signal</th>
            <th>Pris</th>
            <th>1d</th>
            <th>Motivering</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7}>Inga rekommendationer matchade ditt filter.</td>
            </tr>
          )}
          {items.map((item) => (
            <tr key={item.symbol}>
              <td>{item.symbol}</td>
              <td>{item.name}</td>
              <td>{item.score}</td>
              <td className={`signal ${signalClass(item.signal)}`}>{item.signal}</td>
              <td>{formatCurrency(item.price)}</td>
              <td className={item.changePct >= 0 ? 'positive' : 'negative'}>
                {formatPct(item.changePct)}
              </td>
              <td>
                <ul>
                  {item.factors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecommendationsTable;
