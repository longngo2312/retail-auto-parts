// Staff orders — SHELL. The orders API is core logic that is not built
// yet (order placement transaction, status flow). See BACKEND_TODO.md.
export default function StaffOrdersPage() {
  return (
    <div>
      <h1>Orders</h1>
      <div className="notice">
        Backend pending — order listing and the status flow
        (placed → picking → dispatched → delivered / cancelled) are not
        built yet. See BACKEND_TODO.md (&quot;Orders &amp; checkout&quot;).
      </div>
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Store</th>
            <th>Status</th>
            <th>Ordered at</th>
            <th>Total</th>
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
