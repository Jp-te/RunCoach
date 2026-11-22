import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Excluir', onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
