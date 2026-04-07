'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader } from '@/components/ui/Loader';

export default function OrderDetailRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id;
    if (id) router.replace(`/order/${id}`);
  }, [params?.id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size={44} />
    </div>
  );
}
