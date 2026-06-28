import * as React from "react";

// Dependency-free token highlighter for the curl / JSON snippets: strings, HTTP
// verbs, and URLs get token colors; everything else stays muted.
const HIGHLIGHT = /("(?:[^"\\]|\\.)*")|(\b(?:POST|GET|PUT|PATCH|DELETE|curl|Bearer)\b)|(https?:\/\/[^\s"\\]+)/g;

function highlight(line: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    HIGHLIGHT.lastIndex = 0;
    for (let match = HIGHLIGHT.exec(line); match !== null; match = HIGHLIGHT.exec(line)) {
        if (match.index > last) {
            nodes.push(line.slice(last, match.index));
        }
        const className = match[1] ? "text-success" : match[2] ? "text-warning" : "text-primary";
        nodes.push(
            <span key={key} className={className}>
                {match[0]}
            </span>,
        );
        key += 1;
        last = match.index + match[0].length;
    }
    if (last < line.length) {
        nodes.push(line.slice(last));
    }
    return nodes;
}

export function CodeWindow({ title, code }: { title: string; code: string }) {
    return (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-destructive/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">{title}</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/80">
                <code>
                    {code.split("\n").map((line, index) => (
                        <div key={index}>{line.length > 0 ? highlight(line) : " "}</div>
                    ))}
                </code>
            </pre>
        </div>
    );
}
