"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Password field with a show/hide toggle and a Caps Lock warning. Forwards the
// ref and all input props so it drops into existing forms in place of <Input>.
export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function PasswordInput({ className, onKeyUp, onBlur, ...props }, ref) {
        const [show, setShow] = React.useState(false);
        const [caps, setCaps] = React.useState(false);

        return (
            <div className="space-y-1">
                <div className="relative">
                    <Input
                        ref={ref}
                        type={show ? "text" : "password"}
                        className={cn("pr-9", className)}
                        onKeyUp={(event) => {
                            setCaps(event.getModifierState?.("CapsLock") ?? false);
                            onKeyUp?.(event);
                        }}
                        onBlur={(event) => {
                            setCaps(false);
                            onBlur?.(event);
                        }}
                        {...props}
                    />
                    <button
                        type="button"
                        onClick={() => setShow((value) => !value)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-1 flex items-center rounded px-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                </div>
                {caps ? <p className="text-xs text-warning">Caps Lock is on</p> : null}
            </div>
        );
    },
);
