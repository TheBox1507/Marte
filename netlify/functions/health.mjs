export default async function handler() {
  return new Response(JSON.stringify({ ok: true, dem: 'MOLA / ArcGIS' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
