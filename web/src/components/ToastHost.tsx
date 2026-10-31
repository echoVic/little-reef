import * as Toast from "@radix-ui/react-toast";

interface ToastHostProps {
  message: string;
}

// Radix Toast host: the hook drives visibility by clearing the message after
// its timeout; focus/keyboard management and swipe-to-dismiss come from the lib.
export function ToastHost({ message }: ToastHostProps) {
  return (
    <Toast.Provider swipeDirection="down" duration={5200}>
      <Toast.Root id="toast" className="toast" open={!!message} onOpenChange={(open) => { if (!open) { /* message cleared by hook */ } }}>
        <Toast.Description>{message}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  );
}
