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

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

// Global event emitter for toast notifications
class ToastEmitter extends EventTarget {
  private toasts: ToasterToast[] = []
  
  addToast(toast: Toast): ToasterToast {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    
    this.toasts = [newToast, ...this.toasts].slice(0, TOAST_LIMIT)
    this.dispatchEvent(new CustomEvent("toasts-changed", { detail: this.toasts }))
    
    setTimeout(() => {
      this.removeToast(id)
    }, TOAST_REMOVE_DELAY)
    
    return newToast
  }
  
  removeToast(toastId?: string) {
    this.toasts = this.toasts.filter((t) => t.id !== toastId)
    this.dispatchEvent(new CustomEvent("toasts-changed", { detail: this.toasts }))
  }
  
  getToasts() {
    return this.toasts
  }
}

const emitter = new ToastEmitter()

function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>(emitter.getToasts())

  React.useEffect(() => {
    const handler = (e: Event) => {
      const event = e as CustomEvent<ToasterToast[]>
      setToasts(event.detail)
    }
    
    emitter.addEventListener("toasts-changed", handler)
    return () => emitter.removeEventListener("toasts-changed", handler)
  }, [])

  const toast = (props: Toast) => {
    const t = emitter.addToast(props)
    return {
      id: t.id,
      dismiss: () => emitter.removeToast(t.id),
      update: (newProps: Toast) => {
        // For now, just show the new toast
        emitter.removeToast(t.id)
        emitter.addToast(newProps)
      },
    }
  }

  return {
    toasts,
    toast,
    dismiss: (toastId?: string) => emitter.removeToast(toastId),
  }
}

export { useToast }
