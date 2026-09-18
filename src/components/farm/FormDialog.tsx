import type { FormEvent, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function FormDialog({
  open, onOpenChange, title, description, children, onSubmit, submitting, submitLabel = "حفظ", danger,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  danger?: ReactNode;
}) {
  const handle = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4" noValidate>
          {children}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1" size="lg">
              {submitting && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
          </div>
          {danger}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open, onOpenChange, title, description, onConfirm, confirmLabel = "حذف", pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass-strong rounded-3xl border-0">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:justify-start">
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            className="h-12 flex-1 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="glass h-12 rounded-2xl border-0">إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
