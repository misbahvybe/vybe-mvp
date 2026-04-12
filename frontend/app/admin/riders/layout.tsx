/**
 * Avoid stale CDN/browser HTML for this route after deploys (admin looked old while rider updated).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminRidersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
