// أسماء العمليات فسجل النشاط
const actions: Record<string, string> = {
  login: "🔑 دخل للوحة", "order.status": "🔄 بدّل حالة طلبية", "order.edit": "✏️ عدّل طلبية", "order.delete": "🗑️ حذف طلبية", "order.ship": "🚚 بعث طرد",
  "orders.export": "⬇️ صدّر الطلبيات", "product.create": "➕ زاد منتج", "product.edit": "✏️ عدّل منتج", "product.delete": "🗑️ حذف منتج",
  "settings.edit": "⚙️ بدّل الإعدادات", block: "🚫 حظر", unblock: "🔓 فك حظر", "user.create": "🧑‍💼 زاد موظف", "user.update": "🧑‍💼 عدّل موظف",
  "stock.incoming": "📥 دخّل سلعة", "stock.damaged": "🗑️ سجّل تالف", "stock.set": "✏️ صحّح المخزون", "stock.enable": "▶️ بدا تتبع المخزون", "stock.disable": "⏹ وقّف تتبع المخزون",
  "customer.note": "📝 ملاحظة على زبون", backup: "💾 نسخة احتياطية",
};
export const actionLabel = (a: string) => actions[a] || a;
