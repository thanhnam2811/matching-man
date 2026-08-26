import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { apiFetch, getOrganizationSubscription, type OrganizationDetail } from "@/lib/api";
import { BillingView } from "@/components/billing-view";

export const metadata = {
    title: "Billing & Plans - Matching Man",
};

export default async function OrganizationBillingPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = await params;

    let org: OrganizationDetail;
    let subscriptionData;

    try {
        [org, subscriptionData] = await Promise.all([
            apiFetch<OrganizationDetail>(`/organizations/${orgId}`),
            getOrganizationSubscription(orgId),
        ]);
    } catch {
        notFound();
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-2">
                <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link href="/dashboard" className="hover:text-foreground">
                        Organizations
                    </Link>
                    <ChevronRight className="size-3" />
                    <Link href={`/dashboard/organizations/${org.id}`} className="hover:text-foreground">
                        {org.name}
                    </Link>
                    <ChevronRight className="size-3" />
                    <span className="font-medium text-foreground">Billing & Plans</span>
                </nav>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Billing & Quota Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage subscription tier, invoice history, and monitor monthly matchmaking usage limits.
                        </p>
                    </div>
                </div>
            </div>

            <BillingView organizationId={org.id} organizationName={org.name} subscription={subscriptionData} />
        </div>
    );
}
