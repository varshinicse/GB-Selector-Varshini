/**
 * MAGTORQ GB-Selector
 * Score Gauge — Animated SVG arc gauge showing the 0–100 verification score.
 */

import React, { useEffect, useState } from 'react';

interface ScoreGaugeProps {
  score: number;        // 0 – 100
  size?: number;        // diameter in px, default 160
  strokeWidth?: number; // default 14
}

function scoreColor(score: number): string {
  if (score === 100) return '#10b981'; // emerald
  if (score >= 75)   return '#f59e0b'; // amber
  if (score >= 50)   return '#f97316'; // orange
  return '#ef4444';                    // red
}

function scoreLabel(score: number): string {
  if (score === 100) return 'PERFECT';
  if (score >= 75)   return 'GOOD';
  if (score >= 50)   return 'REVIEW';
  return 'FAILED';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 160,
  strokeWidth = 14
}) => {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    // Animate from 0 to score
    let frame: number;
    let current = 0;
    const step = () => {
      current = Math.min(current + 2, score);
      setAnimated(current);
      if (current < score) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Arc spans 270° (from 135° to 45°, going clockwise)
  const arcFraction = 0.75; // 270/360
  const dashTotal = circumference * arcFraction;
  const dashOffset = dashTotal - (animated / 100) * dashTotal;

  const color = scoreColor(score);
  const label = scoreLabel(score);

  // Start angle: 135° (bottom-left), rotating clockwise
  const startAngle = 135;
  const rotation = startAngle;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashTotal} ${circumference - dashTotal}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation}, ${cx}, ${cy})`}
          style={{ transition: 'none' }}
        />
        {/* Foreground arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashTotal} ${circumference - dashTotal}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${rotation}, ${cx}, ${cy})`}
          style={{
            filter: `drop-shadow(0 0 6px ${color}55)`,
            transition: 'none'
          }}
        />
        {/* Score number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          fill={color}
        >
          {animated}
        </text>
        {/* /100 */}
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.09}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          fill="#94a3b8"
        >
          / 100
        </text>
      </svg>
      {/* Label below gauge */}
      <span
        className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border"
        style={{ color, borderColor: `${color}44`, backgroundColor: `${color}11` }}
      >
        {label}
      </span>
    </div>
  );
};
