import type { ComponentChildren } from "preact";

export interface TableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ComponentChildren;
}

interface TableProps<Row> {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
}

export function Table<Row>({ caption, columns, rows, rowKey }: TableProps<Row>) {
  return (
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left">
        <caption class="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th class="border-b border-slate-300 px-3 py-2 font-semibold" scope="col" key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td class="border-b border-slate-200 px-3 py-2" key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td class="px-3 py-4 text-slate-600" colSpan={columns.length}>
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
