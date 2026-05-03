import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

type Toast = Omit<ToasterToast, "id">

function useToast() {
  return {
    toasts: [],
    toast: (props: Toast) => ({ id: "1", dismiss: () => {}, update: () => {} }),
    dismiss: () => {},
  }
}

export { useToast }
