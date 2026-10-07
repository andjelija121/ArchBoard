// Process health only: external outages should not trigger pod restart loops.
export function GET() {
  return Response.json({ status: "ok" }, {
    headers: { "Cache-Control": "no-store" },
  })
}
