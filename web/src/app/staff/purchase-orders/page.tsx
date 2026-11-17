// Staff purchase orders — SHELL. The purchase-order API (create from
// supplier_part, receiving into inventory) is core logic that is not
// built yet. See BACKEND_TODO.md ("Purchase orders & receiving").
// Supplier CRUD itself is available at /api/suppliers.
export default function StaffPurchaseOrdersPage() {
  return (
    <div>
      <h1>Purchase Orders</h1>
      <div className="notice">
        Backend pending — purchase order creation and receiving are not
        built yet. See BACKEND_TODO.md (&quot;Purchase orders &amp;
        receiving&quot;).
      </div>
      <table>
        <thead>
          <tr>
            <th>PO #</th>
            <th>Supplier</th>
            <th>Store</th>
            <th>Status</th>
            <th>Ordered</th>
            <th>Expected</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7}>No data yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
