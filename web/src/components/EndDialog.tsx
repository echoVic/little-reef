import * as AlertDialog from "@radix-ui/react-alert-dialog";

interface EndDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function EndDialog({ open, onClose, onConfirm }: EndDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content id="end-dialog">
          <AlertDialog.Title className="dialog-title">这一段时间，也算数。</AlertDialog.Title>
          <AlertDialog.Description className="dialog-description">结束后会保留实际专注时间。已有的鱼儿和水草不变，本轮不结算新的成长。</AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel id="end-cancel" className="subtle-button">继续这轮</AlertDialog.Cancel>
            <AlertDialog.Action id="end-confirm" className="primary-button" onClick={onConfirm}>结束并记录</AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
