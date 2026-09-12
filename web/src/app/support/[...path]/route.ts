import { NextResponse } from "next/server";

/**
 * 反馈服务的同源代理。
 *
 * 为什么要代理而不是直接连 dc-feedback：一是浏览器的广告/隐私拦截器会整个挡掉第三方域名，
 * 那样用户连反馈入口都看不到；二是同源就不需要 CORS。
 *
 * 只放行三条路径。后台接口（/api/admin）永远不经过这里。
 */
const UPSTREAM = process.env.FEEDBACK_ORIGIN ?? "https://dc-feedback-sigma.vercel.app";
const ALLOWED = new Set(["widget.js", "api/feedback", "api/thread", "api/attachment"]);

async function proxy(request: Request, path: string[]): Promise<Response> {
  const route = path.join("/");
  if (!ALLOWED.has(route)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const headers = new Headers();
  const token = request.headers.get("x-feedback-token");
  if (token) headers.set("x-feedback-token", token);
  if (request.method !== "GET") headers.set("content-type", "application/json");
  // 让上游看到真实访客 IP，而不是这层代理的 IP
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  if (forwarded) headers.set("x-forwarded-for", forwarded);

  // 查询串要一起带过去：读图是 /api/attachment?id=…，丢了参数就等于没传
  const query = new URL(request.url).search;
  const upstream = await fetch(`${UPSTREAM}/${route}${query}`, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.text(),
  });

  const body = await upstream.arrayBuffer();
  const out = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    // 脚本可以缓存一会儿，接口一律不缓存
    "cache-control": route === "widget.js" ? "public, max-age=300" : "no-store",
  });
  return new Response(body, { status: upstream.status, headers: out });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
