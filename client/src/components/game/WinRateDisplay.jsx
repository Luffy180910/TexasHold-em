import { useMemo } from 'react';
import { estimateWinRate } from '../../utils/handUtils';

/**
 * 显示当前手牌胜率估算（蒙特卡洛）
 * 仅在翻牌后才有意义，翻牌前显示预翻牌胜率
 */
export default function WinRateDisplay({ hand, community, numOpponents }) {
  const rate = useMemo(() => {
    if (!hand || hand.length < 2) return null;
    // 限制仿真次数避免 UI 卡顿
    return estimateWinRate(hand, community, numOpponents, 300);
  }, [hand, community, numOpponents]);

  if (rate === null) return null;

  const color = rate >= 70 ? '#66bb6a' : rate >= 40 ? '#ffa726' : '#ef5350';
  const barWidth = `${rate}%`;

  return (
    <div className="win-rate">
      <div className="win-rate-label">
        胜率估算
        <span className="win-rate-value" style={{ color }}>{rate}%</span>
      </div>
      <div className="win-rate-bar">
        <div className="win-rate-fill" style={{ width: barWidth, background: color }} />
      </div>
    </div>
  );
}
