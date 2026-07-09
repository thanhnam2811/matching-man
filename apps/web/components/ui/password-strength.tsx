import { cn } from "@/lib/utils";

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

function score(password: string): number {
    let value = 0;
    if (password.length >= 8) value += 1;
    if (password.length >= 12) value += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) value += 1;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) value += 1;
    return Math.min(value, 4);
}

// Lightweight visual strength hint (4 bars + label). Advisory only — the API is
// the source of truth for password rules.
export function PasswordStrength({ value }: { value: string }) {
    if (!value) return null;
    const level = score(value);

    return (
        <div className="space-y-1">
            <div className="flex gap-1">
                {[0, 1, 2, 3].map((index) => (
                    <div
                        key={index}
                        className={cn("h-1 flex-1 rounded-full", index < level ? COLORS[level] : "bg-muted")}
                    />
                ))}
            </div>
            <p className="text-xs text-muted-foreground">{LABELS[level]}</p>
        </div>
    );
}
