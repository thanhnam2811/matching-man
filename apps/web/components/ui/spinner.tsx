import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-muted-foreground", {
    variants: {
        size: {
            sm: "size-3",
            default: "size-4",
            lg: "size-6",
        },
    },
    defaultVariants: {
        size: "default",
    },
});

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
    className?: string;
}

export function Spinner({ className, size }: SpinnerProps) {
    return <Loader2 aria-hidden className={cn(spinnerVariants({ size }), className)} />;
}
