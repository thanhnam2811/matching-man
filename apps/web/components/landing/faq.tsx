import { ChevronDown } from "lucide-react";

const FAQS = [
    {
        q: "Do I have to bring my own ratings?",
        a: "No. Each game mode picks its rating behaviour: internal Elo computed for you, an external rating you pass in per enqueue, or disabled for casual play.",
    },
    {
        q: "Does it support teams and free-for-all?",
        a: "Yes. Everything is modelled as slots and groups, so 1v1, 5v5, party-vs-party, and FFA all come from the same engine — solo is just a team of one.",
    },
    {
        q: "How do I get match results?",
        a: "A signed match.created webhook hits your server in real time, with HMAC signatures, exponential-backoff retries, and a delivery log you can inspect in the dashboard.",
    },
    {
        q: "How does skill-based pairing avoid long waits?",
        a: "The rating window starts tight and widens on a fixed cadence, so close matches form first and nobody is stuck in queue forever.",
    },
    {
        q: "Is it multi-tenant?",
        a: "Organizations, projects, environments, API keys, and role-based access are built in, so you can isolate games and teams from day one.",
    },
];

export function Faq() {
    return (
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {FAQS.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
            ))}
        </div>
    );
}
