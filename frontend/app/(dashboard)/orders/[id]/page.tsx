'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OrderDetailRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id;
    if (id) router.replace(`/order/${id}`);
  }, [params?.id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
