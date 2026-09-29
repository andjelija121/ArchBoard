export interface MockProject {
  id: string
  name: string
  slug: string
  owner: boolean
}

export const initialOwnedProjects: MockProject[] = [
  { id: "proj-1", name: "Payments Platform", slug: "payments-platform", owner: true },
  { id: "proj-2", name: "Notification Service", slug: "notification-service", owner: true },
]

export const sharedProjects: MockProject[] = [
  { id: "proj-3", name: "Search Infrastructure", slug: "search-infrastructure", owner: false },
]

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
