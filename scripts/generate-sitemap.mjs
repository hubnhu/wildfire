import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { publishedProjects, initiators, initiatorProjects } from '../src/lib/content.mjs';

export async function generateSitemap(targetDir = 'dist') {
  const base = 'https://wildfire.hubn.com';
  const urls = [
    `${base}/`,
    `${base}/apply`,
    `${base}/terms`,
  ];

  for (const project of publishedProjects()) {
    if (project.hasDetailPage) {
      urls.push(`${base}/projects/${project.slug}`);
    }
  }

  for (const initiator of initiators) {
    if (initiatorProjects(initiator.slug).length > 0) {
      urls.push(`${base}/initiators/${initiator.slug}`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`)
    .join('\n')}\n</urlset>\n`;

  const outDir = resolve(targetDir);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'sitemap.xml'), xml, 'utf8');
  return urls;
}

if (process.argv[1] && process.argv[1].endsWith('generate-sitemap.mjs')) {
  const target = process.argv[2] || 'dist';
  const urls = await generateSitemap(target);
  console.log(`Sitemap 生成完成（${urls.length} 个页面）：${target}/sitemap.xml`);
}
