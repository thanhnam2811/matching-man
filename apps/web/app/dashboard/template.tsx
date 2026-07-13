// Remounts on every navigation so page content gets a subtle entrance fade.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
    return <div className="animate-fade-in">{children}</div>;
}
