import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    ring: 'from-blue-600/20 to-blue-400/5',
  },
  green: {
    bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ring: 'from-emerald-600/20 to-emerald-400/5',
  },
  yellow: {
    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ring: 'from-amber-600/20 to-amber-400/5',
  },
  cyan: {
    bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    ring: 'from-cyan-600/20 to-cyan-400/5',
  },
  purple: {
    bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    ring: 'from-purple-600/20 to-purple-400/5',
  },
  red: {
    bg: 'bg-red-500/10 text-red-400 border-red-500/20',
    ring: 'from-red-600/20 to-red-400/5',
  },
};

export const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp = true,
  color = 'blue',
  className = '',
}) => {
  const colorTheme = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.025] p-3.5 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 sm:p-5 ${className}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[10px] font-semibold uppercase leading-snug tracking-wider text-gray-400 sm:text-xs">
          {title}
        </span>
        {Icon && (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border sm:h-10 sm:w-10 ${colorTheme.bg}`}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1 sm:mt-3">
        <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {value ?? 0}
        </div>

        {trend && (
          <div
            className={`inline-flex max-w-full items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs ${
              trendUp
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {trendUp ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            )}
            {trend}
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 break-words text-[11px] font-normal leading-snug text-gray-400 sm:text-xs">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatsCard;
