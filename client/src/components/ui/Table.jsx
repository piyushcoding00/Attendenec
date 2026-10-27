import React from 'react';

export const Table = ({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'No records found',
  className = '',
  onRowClick,
}) => {
  return (
    <div className={`table-scroll rounded-xl border border-white/10 ${className}`}>
      <table className="w-full text-left text-sm text-gray-300">
        <thead className="bg-navy-900/80 text-xs uppercase tracking-wider text-gray-400 border-b border-white/10 select-none">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key || col.label}
                scope="col"
                className={`px-5 py-3.5 font-semibold ${col.headerClassName || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 bg-navy-950/40">
          {isLoading ? (
            // 5 Skeleton rows
            Array.from({ length: 5 }).map((_, rIdx) => (
              <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                {columns.map((col, cIdx) => (
                  <td key={`skeleton-cell-${cIdx}`} className="px-5 py-4">
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-12 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={row._id || row.id || index}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors duration-150 hover:bg-white/5 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key || col.label}
                    className={`px-5 py-4 whitespace-nowrap text-sm ${
                      col.cellClassName || ''
                    }`}
                  >
                    {col.render ? col.render(row, index) : row[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
