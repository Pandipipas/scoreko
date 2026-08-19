import { useQuasar } from 'quasar';
import { t } from '../i18n';

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirmDialog() {
  const $q = useQuasar();

  const confirmAction = (options: ConfirmActionOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      $q.dialog({
        title: options.title,
        message: options.message,
        class: 'glass-panel',
        cancel: {
          label: options.cancelLabel || t('dialogCancel') || 'Cancel',
          flat: true,
          color: 'secondary',
          noCaps: true,
          class: 'flat-back-btn',
        },
        ok: {
          label: options.confirmLabel || t('dialogConfirm') || 'Confirm',
          unelevated: true,
          color: options.destructive ? 'negative' : 'primary',
          noCaps: true,
          class: 'primary-action-btn',
        },
        persistent: true,
      }).onOk(() => {
        resolve(true);
      }).onCancel(() => {
        resolve(false);
      });
    });
  };

  return { confirmAction };
}
