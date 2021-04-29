import { useRouter } from 'next/router';

export default function Success() {
  const router = useRouter();

  router.push('https://dashboard.cosmosbots.com/purchase/success?license=' + router.query.license);
}