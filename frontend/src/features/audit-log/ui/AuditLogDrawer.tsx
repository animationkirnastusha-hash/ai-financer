import { Drawer } from '@/shared/ui';
import type { AuditLogItem } from '@/features/audit-log/model/auditLog.types';
import { AuditLogCard } from '@/features/audit-log/ui/AuditLogCard';

type Props = {
  open: boolean;
  items: AuditLogItem[];
  onClose: () => void;
};

export function AuditLogDrawer({ open, items, onClose }: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="AI Audit Log">
      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-white/55">
            AI-аудит пока пуст.
          </div>
        ) : (
          items.map((item) => <AuditLogCard key={item.id} item={item} />)
        )}
      </div>
    </Drawer>
  );
}