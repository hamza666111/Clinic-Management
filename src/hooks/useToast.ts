import toast from 'react-hot-toast';

export function useToast() {
  const success = (message: string) => toast.success(message);
  const error = (message: string) => toast.error(message);
  const loading = (message: string) => toast.loading(message);
  const dismiss = (id?: string) => toast.dismiss(id);
  const promise = <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => toast.promise(promise, messages);

  return { success, error, loading, dismiss, promise };
}
