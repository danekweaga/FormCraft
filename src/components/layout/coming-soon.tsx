import { PageHeader } from "./page-header";
import { EmptyState } from "@/components/ui/empty-state";

export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Coming soon"
        description="This area is scaffolded in the FormCraft shell and will be implemented in a later phase. No fake data is shown here."
      />
    </div>
  );
}
