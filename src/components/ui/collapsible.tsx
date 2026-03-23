import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

interface CollapsibleProps extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root> {
  children?: React.ReactNode;
}

const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  CollapsibleProps
>(({ children, ...props }, ref) => (
  <CollapsiblePrimitive.Root ref={ref} {...props}>
    {children}
  </CollapsiblePrimitive.Root>
));
Collapsible.displayName = CollapsiblePrimitive.Root.displayName;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
