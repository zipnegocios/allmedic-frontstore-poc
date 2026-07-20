import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  ref,
  className,
  ...props
}: React.ComponentPropsWithRef<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  actions,
  dragHandle,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /** Controles adicionales (ej. un botón "Eliminar") renderizados como hermanos
   * del trigger dentro de la misma cabecera, en vez de anidados dentro de su
   * `<button>` — evita un botón-dentro-de-botón inválido en HTML. */
  actions?: React.ReactNode
  /** Handle de arrastre (ej. `GripVertical` con listeners de dnd-kit) renderizado
   * como hermano ANTES del trigger, dentro de la misma cabecera — mismo motivo
   * que `actions`: no puede ir anidado dentro del `<button>` del trigger, y su
   * `stopPropagation` evita que iniciar un drag también dispare el toggle de
   * abrir/cerrar el acordeón. */
  dragHandle?: React.ReactNode
}) {
  return (
    <AccordionPrimitive.Header className="flex items-center">
      {dragHandle && (
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          {dragHandle}
        </div>
      )}
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
      {actions && (
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
