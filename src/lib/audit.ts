// سجل النشاط: شكون دار واش ووقتاش (ما يطيحش العملية إذا الجدول مازال ما تنحّاش)
import { dbInsert } from "./db";

export async function audit(user: string, action: string, target?: string | null, details?: Record<string, unknown>) {
  try {
    await dbInsert("audit_log", { at: new Date().toISOString(), user_name: user, action, target: target ?? null, details: details ?? null });
  } catch (e) {
    console.error("audit:", String(e).slice(0, 200));
  }
}
