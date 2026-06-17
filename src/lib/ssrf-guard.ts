/**
 * SSRF 防护：校验 URL 是否为安全的外部地址
 * 禁止内网、本地、链路本地地址
 */
import dns from "dns/promises";
import net from "net";

/**
 * 判断一个 IP 地址是否为私有/内部地址
 * 支持 IPv4 和 IPv6
 */
function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;

  // IPv6 mapped IPv4 (::ffff:x.x.x.x)
  const mappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedMatch) {
    return isPrivateIPv4(mappedMatch[1]);
  }

  // IPv6 link-local (fe80::/10)
  if (/^fe[89ab]/i.test(ip)) return true;

  // IPv6 unique local (fc00::/7, fd00::/7)
  if (/^[fF][cCdD]/.test(ip)) return true;

  // IPv4 embedded in IPv6 (various forms)
  // ::ffff:7f00:1 -> 127.0.0.1
  const hexMappedMatch = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMappedMatch) {
    const high = parseInt(hexMappedMatch[1], 16);
    const low = parseInt(hexMappedMatch[2], 16);
    const octet1 = (high >> 8) & 0xff;
    const octet2 = high & 0xff;
    const octet3 = (low >> 8) & 0xff;
    const octet4 = low & 0xff;
    return isPrivateIPv4(`${octet1}.${octet2}.${octet3}.${octet4}`);
  }

  // Pure IPv4
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }

  return false;
}

/**
 * 判断 IPv4 地址是否为私有/保留地址
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 (multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * 检测非标准 IP 表示形式
 * 返回标准化后的 IP 或 null（如果不是 IP 地址）
 */
function detectNonStandardIP(hostname: string): { isInternal: boolean; reason?: string } | null {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // IPv6 loopback
  if (h === "::1") {
    return { isInternal: true, reason: "禁止 IPv6 本地回环地址" };
  }

  // IPv6 mapped IPv4: ::ffff:127.0.0.1
  const ipv6MappedMatch = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv6MappedMatch) {
    const ipv4 = ipv6MappedMatch[1];
    if (isPrivateIPv4(ipv4)) {
      return { isInternal: true, reason: `禁止 IPv6 映射的内网地址 ::ffff:${ipv4}` };
    }
    return { isInternal: false };
  }

  // IPv6 hex mapped: ::ffff:7f00:1
  const ipv6HexMappedMatch = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (ipv6HexMappedMatch) {
    const high = parseInt(ipv6HexMappedMatch[1], 16);
    const low = parseInt(ipv6HexMappedMatch[2], 16);
    const octet1 = (high >> 8) & 0xff;
    const octet2 = high & 0xff;
    const octet3 = (low >> 8) & 0xff;
    const octet4 = low & 0xff;
    const ipv4 = `${octet1}.${octet2}.${octet3}.${octet4}`;
    if (isPrivateIPv4(ipv4)) {
      return { isInternal: true, reason: `禁止 IPv6 映射的内网地址 ::ffff:${ipv6HexMappedMatch[1]}:${ipv6HexMappedMatch[2]} (解析为 ${ipv4})` };
    }
    return { isInternal: false };
  }

  // Hexadecimal IP: 0x7f000001
  const hexFullMatch = h.match(/^0x([0-9a-f]+)$/i);
  if (hexFullMatch) {
    const num = parseInt(hexFullMatch[1], 16);
    if (num > 0 && num <= 0xffffffff) {
      const octet1 = (num >>> 24) & 0xff;
      const octet2 = (num >>> 16) & 0xff;
      const octet3 = (num >>> 8) & 0xff;
      const octet4 = num & 0xff;
      const ipv4 = `${octet1}.${octet2}.${octet3}.${octet4}`;
      if (isPrivateIPv4(ipv4)) {
        return { isInternal: true, reason: `禁止十六进制内网地址 0x${hexFullMatch[1]} (解析为 ${ipv4})` };
      }
      return { isInternal: false };
    }
  }

  // Hex dotted IP: 0x7f.0x00.0x00.0x01
  const hexDottedMatch = h.match(/^0x([0-9a-f]+)\.0x([0-9a-f]+)\.0x([0-9a-f]+)\.0x([0-9a-f]+)$/i);
  if (hexDottedMatch) {
    const octets = [hexDottedMatch[1], hexDottedMatch[2], hexDottedMatch[3], hexDottedMatch[4]].map((h) => parseInt(h, 16));
    if (octets.every((o) => o >= 0 && o <= 255)) {
      const ipv4 = octets.join(".");
      if (isPrivateIPv4(ipv4)) {
        return { isInternal: true, reason: `禁止十六进制内网地址 ${h} (解析为 ${ipv4})` };
      }
      return { isInternal: false };
    }
  }

  // Decimal IP: 2130706433 (single integer representation of 127.0.0.1)
  const decimalMatch = h.match(/^(\d+)$/);
  if (decimalMatch) {
    const num = parseInt(decimalMatch[1], 10);
    if (num > 0 && num <= 0xffffffff && !h.includes(".")) {
      const octet1 = (num >>> 24) & 0xff;
      const octet2 = (num >>> 16) & 0xff;
      const octet3 = (num >>> 8) & 0xff;
      const octet4 = num & 0xff;
      const ipv4 = `${octet1}.${octet2}.${octet3}.${octet4}`;
      if (isPrivateIPv4(ipv4)) {
        return { isInternal: true, reason: `禁止十进制内网地址 ${decimalMatch[1]} (解析为 ${ipv4})` };
      }
      return { isInternal: false };
    }
  }

  // Octal IP: 0177.0.0.1
  const octalDottedMatch = h.match(/^0[0-7]*(\.[0-7]+){0,3}$/);
  if (octalDottedMatch && h.includes(".")) {
    const parts = h.split(".");
    const octets = parts.map((p) => parseInt(p, 8));
    if (octets.length === 4 && octets.every((o) => o >= 0 && o <= 255)) {
      const ipv4 = octets.join(".");
      if (isPrivateIPv4(ipv4)) {
        return { isInternal: true, reason: `禁止八进制内网地址 ${h} (解析为 ${ipv4})` };
      }
      return { isInternal: false };
    }
  }

  // Mixed octal/decimal IP: 0177.0.0.1 (some octets are octal)
  const mixedOctalMatch = h.match(/^((0[0-7]+|\d+))\.((0[0-7]+|\d+))\.((0[0-7]+|\d+))\.((0[0-7]+|\d+))$/);
  if (mixedOctalMatch) {
    const parts = h.split(".");
    const octets = parts.map((p) => {
      if (/^0[0-7]+$/.test(p)) return parseInt(p, 8);
      return parseInt(p, 10);
    });
    if (octets.length === 4 && octets.every((o) => !isNaN(o) && o >= 0 && o <= 255)) {
      const ipv4 = octets.join(".");
      if (isPrivateIPv4(ipv4)) {
        return { isInternal: true, reason: `禁止八进制/混合内网地址 ${h} (解析为 ${ipv4})` };
      }
      return { isInternal: false };
    }
  }

  return null;
}

/**
 * 同步 SSRF 检查（仅基于 URL 字符串分析，无法防御 DNS 重绑定攻击）
 *
 * ⚠️ 此函数不足以用于生产环境，建议使用 isSafeUrlAsync 进行完整校验
 */
export function isSafeUrl(urlStr: string): { safe: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { safe: false, reason: "URL 格式无效" };
  }

  // 只允许 https 和 http 协议
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { safe: false, reason: "仅允许 http/https 协议" };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 检测非标准 IP 表示形式
  const nonStandardResult = detectNonStandardIP(hostname);
  if (nonStandardResult) {
    if (nonStandardResult.isInternal) {
      return { safe: false, reason: nonStandardResult.reason! };
    }
    // 非标准 IP 但不是内网地址，放行（后续 DNS 解析会进一步校验）
  }

  // 禁止本地地址
  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
  ];
  if (blockedHosts.includes(hostname)) {
    return { safe: false, reason: "禁止本地地址" };
  }

  // 禁止内网 IP（10.x, 172.16-31.x, 192.168.x）
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
    return { safe: false, reason: "禁止内网地址" };
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
    return { safe: false, reason: "禁止内网地址" };
  }

  // 禁止链路本地地址
  if (/^169\.254\./.test(hostname)) {
    return { safe: false, reason: "禁止链路本地地址" };
  }

  // 禁止以 .local, .internal, .localhost 结尾的域名
  if (/\.(local|internal|localhost)$/.test(hostname)) {
    return { safe: false, reason: "禁止内部域名" };
  }

  return { safe: true };
}

/**
 * 异步 SSRF 检查（包含 DNS 解析，可防御 DNS 重绑定攻击）
 *
 * 1. 先执行同步检查（URL 格式、协议、非标准 IP、内网域名等）
 * 2. 再执行 DNS 解析，检查所有解析结果是否为私有 IP
 */
export async function isSafeUrlAsync(urlStr: string): Promise<{ safe: boolean; reason?: string }> {
  // 第一步：同步检查
  const syncResult = isSafeUrl(urlStr);
  if (!syncResult.safe) {
    return syncResult;
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { safe: false, reason: "URL 格式无效" };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 如果 hostname 已经是 IP 地址，同步检查已覆盖，无需 DNS 解析
  if (net.isIPv4(hostname) || net.isIPv6(hostname) || hostname.includes(":")) {
    return { safe: true };
  }

  // 第二步：DNS 解析检查
  try {
    const [ipv4Results, ipv6Results] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    const resolvedIPs: string[] = [];

    if (ipv4Results.status === "fulfilled" && ipv4Results.value) {
      resolvedIPs.push(...ipv4Results.value);
    }
    if (ipv6Results.status === "fulfilled" && ipv6Results.value) {
      resolvedIPs.push(...ipv6Results.value);
    }

    // 如果 DNS 无法解析任何地址，放行（连接时会失败）
    if (resolvedIPs.length === 0) {
      return { safe: true };
    }

    // 检查所有解析出的 IP 是否为私有地址
    for (const ip of resolvedIPs) {
      if (isPrivateIP(ip)) {
        return { safe: false, reason: `域名 ${hostname} 解析到内网地址 ${ip}，疑似 SSRF 攻击` };
      }
    }
  } catch {
    // DNS 解析失败，放行（连接时会失败）
    return { safe: true };
  }

  return { safe: true };
}
