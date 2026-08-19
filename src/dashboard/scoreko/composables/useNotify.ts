import { Notify } from 'quasar';

export function useNotify() {
  const notifySuccess = (message: string) => {
    Notify.create({
      type: 'positive',
      message,
      icon: 'check_circle',
      position: 'bottom-right',
      timeout: 3000,
    });
  };

  const notifyError = (message: string) => {
    Notify.create({
      type: 'negative',
      message,
      icon: 'error',
      position: 'bottom-right',
      timeout: 5000,
      actions: [{ icon: 'close', color: 'white', size: 'sm', round: true }],
    });
  };

  const notifyWarning = (message: string) => {
    Notify.create({
      type: 'warning',
      message,
      icon: 'warning',
      position: 'bottom-right',
      timeout: 4000,
    });
  };

  const notifyInfo = (message: string) => {
    Notify.create({
      type: 'info',
      message,
      icon: 'info',
      position: 'bottom-right',
      timeout: 3000,
    });
  };

  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };
}
