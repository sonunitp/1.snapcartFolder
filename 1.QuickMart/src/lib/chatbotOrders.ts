import Order from "@/models/order.model";

export type OrderSummary = {
  id: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  isPaid: boolean;
};

/**
 * Recent orders for prompt context (newest first).
 * Example query: Order.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
 */
export async function fetchRecentOrdersForUser(
  userId: string,
  limit = 5
): Promise<OrderSummary[]> {
  const rows = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("_id status createdAt totalAmount isPaid")
    .lean();

  return rows.map((o) => ({
    id: String(o._id),
    status: String(o.status ?? "unknown"),
    createdAt: o.createdAt
      ? new Date(o.createdAt).toISOString().slice(0, 10)
      : "unknown",
    totalAmount: typeof o.totalAmount === "number" ? o.totalAmount : 0,
    isPaid: Boolean(o.isPaid),
  }));
}

export function formatOrdersForPrompt(orders: OrderSummary[]): string {
  if (orders.length === 0) {
    return "No recent orders on file for this customer.";
  }
  return orders
    .map(
      (o, i) =>
        `${i + 1}. Order ID: ${o.id} | Status: ${o.status} | Date: ${o.createdAt} | Total: ₹${o.totalAmount} | Paid: ${o.isPaid ? "yes" : "no"}`
    )
    .join("\n");
}

export function formatLatestOrderReply(orders: OrderSummary[]): string {
  if (orders.length === 0) {
    return "You don’t have any orders yet. Once you place one, you’ll see status updates here and under **My orders**.";
  }
  const o = orders[0];
  return `**Your latest order**  
• **Order ID:** \`${o.id}\`  
• **Status:** **${o.status}**  
• **Placed:** ${o.createdAt}  
• **Total:** ₹${o.totalAmount}  

Track anytime from **My orders** in the app.`;
}
