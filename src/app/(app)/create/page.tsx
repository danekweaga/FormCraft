import { PageHeader } from "@/components/layout/page-header";
import { AddToCanvasButton } from "@/components/canvas/add-to-canvas-button";
import { CreateCaptureForm } from "./create-capture-form";

export default function CreatePage() {
  return (
    <div>
      <PageHeader
        title="Create"
        description="Capture a draft or script seed, then develop it on Canvas with lineage to research and experiments."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <CreateCaptureForm />
        <div className="rounded-xl border border-outline-variant/20 bg-surface-primary p-5 paper-shadow">
          <p className="text-sm text-secondary">
            Full script studio is still light — use Canvas AI on selected nodes
            for combine / generate script / series outlines.
          </p>
          <div className="mt-4">
            <AddToCanvasButton
              nodeType="draft"
              title="Blank draft"
              body="Start drafting here"
              label="Add blank draft to Canvas"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
