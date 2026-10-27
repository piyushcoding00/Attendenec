import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const LiveDateTime = ({
  dateFormat = 'EEEE, MMMM dd, yyyy',
  className = '',
  dateClassName = '',
  timeClassName = '',
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div className={`flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className={`inline-flex min-w-0 items-center ${dateClassName}`}>
        <Calendar className="mr-1.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <span className="min-w-0 break-words">{formatDate(now, dateFormat)}</span>
      </span>
      <span
        className={`inline-flex items-center font-mono tabular-nums ${timeClassName}`}
        aria-label="Current local time"
      >
        <Clock className="mr-1.5 h-3.5 w-3.5 shrink-0" />
        <time>{now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}</time>
      </span>
    </div>
  );
};

export default LiveDateTime;
