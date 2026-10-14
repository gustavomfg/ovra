import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export type ExperimentDefinition = {
  // Used in the URL hash: #/entity-001.
  slug: string;
  // Short index label shown in the header.
  code: string;
  title: string;
  component: LazyExoticComponent<ComponentType>;
};

// Each experiment is a self-contained folder and is loaded only when the visitor
// opens it. Add new experiments here; the shell needs no other change.
export const experiments: ExperimentDefinition[] = [
  {
    slug: "entity-001",
    code: "001",
    title: "ENTITY 001 — AWAKENING",
    component: lazy(() => import("./entity-001/Entity001")),
  },
  {
    slug: "entity-002",
    code: "002",
    title: "ENTITY 002 — UMBRA",
    component: lazy(() => import("./entity-002/Entity002")),
  },
];

export function findExperiment(slug: string) {
  return experiments.find((experiment) => experiment.slug === slug);
}
