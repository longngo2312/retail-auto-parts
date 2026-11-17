// Staff returns — SHELL. Returns processing (part_return rows, refund
// amounts, restocking) is core logic that is not built yet.
// See BACKEND_TODO.md ("Returns").
export default function StaffReturnsPage() {
  return (
    <div>
      <h1>Returns</h1>
      <div className="notice">
        Backend pending — returns processing is not built yet. See
        BACKEND_TODO.md (&quot;Returns&quot;).
      </div>
      <table>
        <thead>
          <tr>
            <th>Return #</th>
            <th>Order line</th>
            <th>Quantity</th>
            <th>Reason</th>
            <th>Refund</th>
            <th>Returned at</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={6}>No data yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
